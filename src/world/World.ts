import * as THREE from "three";
import { GameState } from "../core/GameState";
import { InputManager } from "../core/InputManager";
import { WheelManager } from "../core/WheelManager";
import { DriveController } from "../core/DriveController";
import { GearboxController } from "../core/GearboxController";
import { SceneRig } from "./Scene";
import { buildTerrain } from "./Terrain";
import { buildWater } from "./Water";
import { buildShop, isNearShop, PARKING_SPOT } from "./Shop";
import { clampToWorld } from "./Terrain";
import { Vehicle } from "./Vehicle";
import { Walker } from "./Walker";
import { VEHICLE_CATALOG, VehicleDef } from "./VehicleCatalog";
import { copy } from "../content/copy";

const ENTER_EXIT_RADIUS = 3.5;

export class World {
  readonly rig: SceneRig;
  readonly vehicle: Vehicle;
  readonly walker: Walker;
  readonly state: GameState;
  readonly input = new InputManager();
  readonly wheel: WheelManager;
  private drive = new DriveController();
  private gearbox: GearboxController;
  private water: ReturnType<typeof buildWater>;

  nearVehicle = false;
  nearShop = false;
  onWheelDetected?: () => void;
  onWheelCalibrated?: () => void;
  onWheelStep?: (step: 0 | 1 | 2, progress: number) => void;

  // Caméra suiveuse orbitable : glisser sur le décor tourne autour du
  // véhicule/personnage pour voir l'avant comme l'arrière.
  private orbitYaw = 0;
  private orbitPitch = 0;
  private orbitDragging = false;
  private lastPointer = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, state: GameState) {
    this.state = state;
    this.gearbox = new GearboxController(this.state);
    this.rig = new SceneRig(canvas);
    buildTerrain(this.rig.scene);
    this.water = buildWater(this.rig.scene);
    buildShop(this.rig.scene);
    this.setupOrbitDrag(canvas);

    this.vehicle = new Vehicle(VEHICLE_CATALOG[0], this.rig.scene, state);
    this.vehicle.respawnAt(PARKING_SPOT.x, PARKING_SPOT.z, 0);

    this.walker = new Walker(this.rig.scene);
    this.walker.respawnAt(PARKING_SPOT.x + 4, PARKING_SPOT.z, 0);
    this.walker.object.visible = false;

    this.wheel = new WheelManager(state, {
      onDetected: () => this.onWheelDetected?.(),
      onCalibrationStep: (step, progress) => this.onWheelStep?.(step, progress),
      onCalibrated: () => this.onWheelCalibrated?.(),
    });
  }

  spawnAt(terrain: "ferme" | "chantier" | "ville") {
    const x = terrain === "ferme" ? -120 : terrain === "chantier" ? 0 : 120;
    this.vehicle.respawnAt(x, 0, 0);
    this.walker.object.visible = false;
    this.state.setMode("drive");
  }

  swapVehicle(def: VehicleDef) {
    if (this.state.mode === "drive") {
      const { x, z } = this.vehicle.object.position;
      this.vehicle.swapTo(def, this.rig.scene);
      this.vehicle.respawnAt(x, z, this.vehicle.heading);
    } else {
      this.vehicle.swapTo(def, this.rig.scene);
    }
  }

  update(dt: number) {
    this.wheel.update();
    this.water.animate();
    this.state.tick(dt);

    if (this.state.mode === "drive") {
      this.vehicle.update(dt, this.input, this.wheel, this.state);
      this.drive.update(this.input, this.state);
      this.gearbox.update(this.input);

      if (this.input.justPressed("KeyF")) {
        this.state.setMode("pedestrian");
        const side = new THREE.Vector3(Math.cos(this.vehicle.heading), 0, -Math.sin(this.vehicle.heading));
        const p = this.vehicle.object.position.clone().addScaledVector(side, 2.4);
        this.walker.respawnAt(p.x, p.z, this.vehicle.heading);
        this.walker.object.visible = true;
      }
      this.nearVehicle = false;
      this.nearShop = false;
    } else {
      this.walker.update(dt, this.input, this.state);
      const wp = this.walker.object.position;
      const vp = this.vehicle.object.position;
      this.nearVehicle = wp.distanceTo(vp) < ENTER_EXIT_RADIUS && this.state.mode === "pedestrian";
      this.nearShop = this.state.mode === "pedestrian" && isNearShop(wp.x, wp.z);

      if (this.nearVehicle && this.input.justPressed("KeyE")) {
        this.vehicle.respawnAt(wp.x, wp.z, this.walker.heading);
        this.walker.object.visible = false;
        this.state.setMode("drive");
      }
      if (this.nearShop) {
        this.state.toast(copy.terrain.somethingShines);
      }
      if (this.state.mode === "swim" && this.input.justPressed("KeyF")) {
        const dir = new THREE.Vector3(Math.sin(this.walker.heading), 0, Math.cos(this.walker.heading));
        this.walker.object.position.addScaledVector(dir, 3);
        const clamped = clampToWorld(this.walker.object.position.x, this.walker.object.position.z);
        this.walker.object.position.x = clamped.x;
        this.walker.object.position.z = clamped.z;
      }
    }

    this.updateCamera();
    this.rig.render();
  }

  private setupOrbitDrag(canvas: HTMLCanvasElement) {
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => {
      this.orbitDragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener("pointermove", (e) => {
      if (!this.orbitDragging) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.orbitYaw -= dx * 0.012;
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * 0.008, -0.45, 0.85);
    });
    window.addEventListener("pointerup", () => (this.orbitDragging = false));
    window.addEventListener("pointercancel", () => (this.orbitDragging = false));
  }

  private updateCamera() {
    const target = this.state.mode === "drive" ? this.vehicle.object : this.walker.object;
    const heading = this.state.mode === "drive" ? this.vehicle.heading : this.walker.heading;
    const yaw = heading + this.orbitYaw;
    const pitch = this.orbitPitch;
    const distance = 8;
    const horiz = distance * Math.cos(pitch);
    const vert = 4.5 + distance * Math.sin(pitch);
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(-horiz);
    const desired = target.position.clone().add(back).add(new THREE.Vector3(0, vert, 0));
    this.rig.camera.position.lerp(desired, 0.15);
    const lookAt = target.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.rig.camera.lookAt(lookAt);
  }
}
