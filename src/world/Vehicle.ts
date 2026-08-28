import * as THREE from "three";
import { GameState } from "../core/GameState";
import { InputManager } from "../core/InputManager";
import { WheelManager } from "../core/WheelManager";
import { VehicleDef } from "./VehicleCatalog";
import { buildVehicleMesh } from "./VehicleMeshFactory";
import { isInWater, zoneAt } from "./Terrain";

const MAX_SPEED = 22; // m/s casual arcade top speed, not a real vehicle's
const ACCEL = 10;
const BRAKE = 16;
const DRAG = 6;
const TURN_RATE = 1.8; // rad/s at speed

export class Vehicle {
  readonly object = new THREE.Group();
  def: VehicleDef;
  speed = 0;
  heading = 0;
  private blinkerPhase = 0;
  private beaconAngle = 0;

  constructor(def: VehicleDef, scene: THREE.Scene) {
    this.def = def;
    const built = buildVehicleMesh(def);
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
    this.object.add(built.group);
    scene.add(this.object);
  }

  update(dt: number, input: InputManager, wheel: WheelManager, state: GameState) {
    const throttle = state.wheelConnected ? wheel.throttleValue - wheel.brakeValue : input.throttle;
    const steer = state.wheelConnected ? wheel.steeringValue : input.steer;

    const inWater = isInWater(this.object.position.x, this.object.position.z);
    const topSpeed = inWater ? MAX_SPEED * 0.25 : MAX_SPEED;

    if (throttle > 0) this.speed += ACCEL * throttle * dt;
    else if (throttle < 0) this.speed += BRAKE * throttle * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), DRAG * dt);
    this.speed = THREE.MathUtils.clamp(this.speed, -topSpeed * 0.4, topSpeed);

    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 6, 0, 1);
    this.heading -= steer * TURN_RATE * speedFactor * Math.sign(this.speed || 1) * dt;
    this.object.rotation.y = this.heading;

    const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.object.position.addScaledVector(dir, this.speed * dt);
    if (inWater) this.object.position.y = -0.05 + Math.sin(performance.now() / 300) * 0.03;
    else this.object.position.y = 0;

    state.speedKmh = Math.round(Math.abs(this.speed) * 3.6);
    state.terrain = zoneAt(this.object.position.x);

    this.updateLights(dt, state);
  }

  private updateLights(dt: number, state: GameState) {
    this.blinkerPhase = (this.blinkerPhase + dt) % 0.9;
    const blinkOn = this.blinkerPhase < 0.45;
    const l = this.object.getObjectByName("blinkerL") as THREE.Mesh | undefined;
    const r = this.object.getObjectByName("blinkerR") as THREE.Mesh | undefined;
    const head = this.object.getObjectByName("headlight") as THREE.Mesh | undefined;
    const beacon = this.object.getObjectByName("beacon") as THREE.Mesh | undefined;

    const leftOn = (state.blinker === "left" || state.blinker === "warning") && blinkOn;
    const rightOn = (state.blinker === "right" || state.blinker === "warning") && blinkOn;
    setEmissive(l, leftOn ? 2.2 : 0);
    setEmissive(r, rightOn ? 2.2 : 0);
    setEmissive(head, state.headlightsOn ? 1.5 : 0);

    if (beacon) {
      this.beaconAngle += dt * 6;
      setEmissive(beacon, state.beaconOn ? (Math.sin(this.beaconAngle) > 0 ? 2.5 : 0.2) : 0);
    }
  }
}

function setEmissive(mesh: THREE.Mesh | undefined, intensity: number) {
  if (!mesh) return;
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.emissiveIntensity = intensity;
}
