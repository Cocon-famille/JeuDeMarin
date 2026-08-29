import * as THREE from "three";
import { GameState } from "../core/GameState";
import { InputManager } from "../core/InputManager";
import { WheelManager } from "../core/WheelManager";
import { VehicleDef } from "./VehicleCatalog";
import { buildVehicleMesh } from "./VehicleMeshFactory";
import { addPlates } from "./Plate";
import { isInWater, zoneAt, clampToWorld } from "./Terrain";

const MAX_SPEED = 22; // m/s casual arcade top speed, not a real vehicle's
const ACCEL = 10;
const BRAKE = 16;
const DRAG = 6;
const TURN_RATE = 1.8; // rad/s at speed
const FUEL_DRAIN_PER_KM = 0.006; // ~165 km on a full tank — a session-length range, not a chore

export class Vehicle {
  readonly object = new THREE.Group();
  def: VehicleDef;
  speed = 0;
  heading = 0;
  private blinkerPhase = 0;
  private beaconAngle = 0;
  private state: GameState;

  constructor(def: VehicleDef, scene: THREE.Scene, state: GameState) {
    this.def = def;
    this.state = state;
    const built = buildVehicleMesh(def);
    addPlates(built.group, built.length / 2, state.playerName, state.plate);
    this.object.add(built.group);
    scene.add(this.object);
  }

  respawnAt(x: number, z: number, heading = 0) {
    this.object.position.set(x, 0, z);
    this.heading = heading;
    this.object.rotation.y = heading;
    this.speed = 0;
  }

  swapTo(def: VehicleDef, scene: THREE.Scene) {
    scene.remove(this.object);
    this.object.clear();
    this.def = def;
    const built = buildVehicleMesh(def);
    addPlates(built.group, built.length / 2, this.state.playerName, this.state.plate);
    this.object.add(built.group);
    scene.add(this.object);
  }

  /** Re-draws the front/rear plate textures after the player edits name/plate. */
  refreshPlate() {
    const front = this.object.getObjectByName("plateFront") as THREE.Mesh | undefined;
    const rear = this.object.getObjectByName("plateRear") as THREE.Mesh | undefined;
    if (!front || !rear) return;
    const halfLength = front.position.z;
    this.object.remove(front, rear);
    front.geometry.dispose();
    (front.material as THREE.MeshBasicMaterial).map?.dispose();
    (front.material as THREE.Material).dispose();
    (rear.material as THREE.Material).dispose();
    addPlates(this.object, halfLength, this.state.playerName, this.state.plate);
  }

  update(dt: number, input: InputManager, wheel: WheelManager, state: GameState) {
    const throttle = state.wheelConnected ? wheel.throttleValue - wheel.brakeValue : input.throttle;
    const steer = state.wheelConnected ? wheel.steeringValue : input.steer;

    const inWater = isInWater(this.object.position.x, this.object.position.z);
    const outOfFuel = state.fuel <= 0;
    const topSpeed = (inWater ? MAX_SPEED * 0.25 : MAX_SPEED) * (outOfFuel ? 0.12 : 1);

    if (throttle > 0) this.speed += ACCEL * throttle * dt;
    else if (throttle < 0) this.speed += BRAKE * throttle * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), DRAG * dt);
    this.speed = THREE.MathUtils.clamp(this.speed, -topSpeed * 0.4, topSpeed);

    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 6, 0, 1);
    this.heading -= steer * TURN_RATE * speedFactor * Math.sign(this.speed || 1) * dt;
    this.object.rotation.y = this.heading;

    const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.object.position.addScaledVector(dir, this.speed * dt);
    const clamped = clampToWorld(this.object.position.x, this.object.position.z);
    if (clamped.x !== this.object.position.x || clamped.z !== this.object.position.z) this.speed *= 0.5;
    this.object.position.x = clamped.x;
    this.object.position.z = clamped.z;
    if (inWater) this.object.position.y = -0.05 + Math.sin(performance.now() / 300) * 0.03;
    else this.object.position.y = 0;

    state.speedKmh = Math.round(Math.abs(this.speed) * 3.6);
    state.terrain = zoneAt(this.object.position.x);

    const distanceKm = (Math.abs(this.speed) * dt) / 1000;
    state.fuel = Math.max(0, state.fuel - distanceKm * FUEL_DRAIN_PER_KM);
    state.checkFuelWarning();

    this.updateLights(dt, state);
  }

  private updateLights(dt: number, state: GameState) {
    this.blinkerPhase = (this.blinkerPhase + dt) % 0.9;
    const blinkOn = this.blinkerPhase < 0.45;

    const leftOn = (state.blinker === "left" || state.blinker === "warning") && blinkOn;
    const rightOn = (state.blinker === "right" || state.blinker === "warning") && blinkOn;
    for (const suffix of ["_front", "_rear"]) {
      setEmissive(this.object.getObjectByName(`blinkerL${suffix}`), leftOn ? 2.4 : 0);
      setEmissive(this.object.getObjectByName(`blinkerR${suffix}`), rightOn ? 2.4 : 0);
    }

    setEmissive(this.object.getObjectByName("headlightL"), state.headlightsOn ? 2 : 0);
    setEmissive(this.object.getObjectByName("headlightR"), state.headlightsOn ? 2 : 0);
    setEmissive(this.object.getObjectByName("taillightL"), state.headlightsOn ? 1.6 : 0.2);
    setEmissive(this.object.getObjectByName("taillightR"), state.headlightsOn ? 1.6 : 0.2);

    const spot = this.object.getObjectByName("headlightSpot") as THREE.SpotLight | undefined;
    if (spot) spot.intensity = state.headlightsOn ? 4 : 0;

    const beacon = this.object.getObjectByName("beacon");
    if (beacon) {
      this.beaconAngle += dt * 6;
      setEmissive(beacon, state.beaconOn ? (Math.sin(this.beaconAngle) > 0 ? 3 : 0.2) : 0);
    }
  }
}

function setEmissive(obj: THREE.Object3D | null | undefined, intensity: number) {
  const mesh = obj as THREE.Mesh | undefined;
  if (!mesh || !("material" in mesh)) return;
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.emissiveIntensity = intensity;
}
