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

  constructor(canvas: HTMLCanvasElement, state: GameState) {
    this.state = state;
    this.gearbox = new GearboxController(this.state);
    this.rig = new SceneRig(canvas);
    buildTerrain(this.rig.scene);
    this.water = buildWater(this.rig.scene);
    buildShop(this.rig.scene);

    this.vehicle = new Vehicle(VEHICLE_CATALOG[0], this.rig.scene);
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
    }

    this.updateCamera();
    this.rig.render();
  }

  private updateCamera() {
    const target = this.state.mode === "drive" ? this.vehicle.object : this.walker.object;
    const heading = this.state.mode === "drive" ? this.vehicle.heading : this.walker.heading;
    const back = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(-8);
    const desired = target.position.clone().add(back).add(new THREE.Vector3(0, 4.5, 0));
    this.rig.camera.position.lerp(desired, 0.08);
    const lookAt = target.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.rig.camera.lookAt(lookAt);
  }
}
