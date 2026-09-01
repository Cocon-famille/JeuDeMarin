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
import { wrapWorld } from "./Terrain";
import { buildExtendedWorld } from "./ExtendedWorld";
import { Vehicle } from "./Vehicle";
import { Walker } from "./Walker";
import { Trailer } from "./Trailer";
import { Farm } from "./Farm";
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
  readonly farm: Farm;
  private drive = new DriveController();
  private gearbox: GearboxController;
  private water: ReturnType<typeof buildWater>;

  nearVehicle = false;
  nearShop = false;
  trailer: Trailer | null = null;
  trailerDef: VehicleDef | null = null;
  onWheelDetected?: () => void;
  onWheelCalibrated?: () => void;
  onWheelStep?: (step: 0 | 1 | 2, progress: number) => void;

  /** Vue conducteur : caméra rigide, fixée au pare-brise, plutôt que la caméra suiveuse orbitable. */
  viewMode: "chase" | "cockpit" = "chase";

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
    buildExtendedWorld(this.rig.scene);
    this.farm = new Farm(this.rig.scene);
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
    // Une remorque n'a pas de moteur — la traîner attelée derrière un
    // véhicule qui ne peut plus la tracter n'a pas de sens.
    if (this.trailer && !def.canTow) this.detachTrailer();

    if (this.state.mode === "drive") {
      const { x, z } = this.vehicle.object.position;
      this.vehicle.swapTo(def, this.rig.scene);
      this.vehicle.respawnAt(x, z, this.vehicle.heading);
    } else {
      this.vehicle.swapTo(def, this.rig.scene);
    }
  }

  /** Attèle (ou détache si déjà attelée) une remorque possédée derrière le véhicule tracteur actuel. */
  attachTrailer(def: VehicleDef) {
    if (this.trailerDef?.id === def.id) {
      this.detachTrailer();
      return;
    }
    if (this.trailer) this.trailer.dispose(this.rig.scene);
    this.trailer = new Trailer(def, this.rig.scene);
    this.trailerDef = def;
    const hitchLength = this.vehicle.length / 2 + this.trailer.length / 2 + 0.4;
    const forward = new THREE.Vector3(Math.sin(this.vehicle.heading), 0, Math.cos(this.vehicle.heading));
    const behind = this.vehicle.object.position.clone().addScaledVector(forward, -hitchLength);
    this.trailer.placeAt(behind.x, behind.z, this.vehicle.heading);
    this.state.toast(`${def.label} attelée`, "Elle suit le véhicule — reviens la choisir dans la boutique pour la détacher.");
  }

  detachTrailer() {
    if (!this.trailer) return;
    this.trailer.dispose(this.rig.scene);
    this.trailer = null;
    this.trailerDef = null;
    this.state.toast("Remorque détachée");
  }

  update(dt: number) {
    this.wheel.update();
    this.water.animate();
    this.state.tick(dt);

    if (this.state.mode === "drive") {
      this.vehicle.update(dt, this.input, this.wheel, this.state);
      this.drive.update(this.input, this.state);
      this.gearbox.update(this.input);
      this.farm.update(dt, this.vehicle.object.position, this.vehicle.def.kind, this.input, this.state);

      if (this.trailer) {
        // The tow vehicle can jump ~1800 units in one frame when it wraps
        // around the world edge (Terrain.wrapWorld) — shift the trailer by
        // the same delta first, or it'd see a huge gap open up and rush
        // to close it instead of wrapping invisibly like everything else.
        if (this.vehicle.wrapDeltaX !== 0 || this.vehicle.wrapDeltaZ !== 0) {
          this.trailer.object.position.x += this.vehicle.wrapDeltaX;
          this.trailer.object.position.z += this.vehicle.wrapDeltaZ;
        }
        const hitchLength = this.vehicle.length / 2 + this.trailer.length / 2 + 0.4;
        this.trailer.update(this.vehicle.object.position.x, this.vehicle.object.position.z, hitchLength);
      }

      if (this.input.justPressed("KeyV")) this.toggleView();
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
        const wrapped = wrapWorld(this.walker.object.position.x, this.walker.object.position.z);
        this.walker.object.position.x = wrapped.x;
        this.walker.object.position.z = wrapped.z;
      }
    }

    this.updateCamera(dt);
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

  toggleView() {
    this.viewMode = this.viewMode === "chase" ? "cockpit" : "chase";
    this.state.toast(this.viewMode === "cockpit" ? "Vue conducteur" : "Vue extérieure");
  }

  private updateCamera(dt: number) {
    const isDrive = this.state.mode === "drive";
    const inCockpit = isDrive && this.viewMode === "cockpit";
    // Real Kenney models are double-sided — sitting the camera inside the
    // shell (no interior is modeled) would render the inside of the paint
    // job filling the whole frame instead of the world outside. Hiding the
    // vehicle's own mesh while its camera looks out is the standard
    // first-person-vehicle trick when there's no dashboard to show.
    this.vehicle.object.visible = !inCockpit;
    if (inCockpit) {
      this.updateCockpitCamera();
      return;
    }

    // Une fois qu'on relâche le glissé, la caméra revient d'elle-même
    // derrière le véhicule/personnage — sinon un angle laissé de travers
    // (même par un glissement accidentel) fait croire que les commandes se
    // sont inversées, alors qu'elles n'ont jamais bougé : seule la vue a
    // tourné, et "avancer" s'affiche désormais comme un mouvement vers soi.
    if (!this.orbitDragging) {
      const pull = Math.min(1, dt * 2.5);
      this.orbitYaw = THREE.MathUtils.lerp(this.orbitYaw, 0, pull);
      this.orbitPitch = THREE.MathUtils.lerp(this.orbitPitch, 0, pull);
    }

    const target = isDrive ? this.vehicle.object : this.walker.object;
    const heading = isDrive ? this.vehicle.heading : this.walker.heading;

    // Le monde boucle sur lui-même (Terrain.wrapWorld) : quand la position
    // suivie saute d'un bord à l'autre, on décale la caméra du même vecteur
    // pour que le bouclage soit invisible plutôt qu'un grand panoramique.
    const wrapDeltaX = isDrive ? this.vehicle.wrapDeltaX : this.walker.wrapDeltaX;
    const wrapDeltaZ = isDrive ? this.vehicle.wrapDeltaZ : this.walker.wrapDeltaZ;
    if (wrapDeltaX !== 0 || wrapDeltaZ !== 0) {
      this.rig.camera.position.x += wrapDeltaX;
      this.rig.camera.position.z += wrapDeltaZ;
    }

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

  /**
   * Vue conducteur : la caméra est rigidement attachée à peu près là où
   * serait la tête du conducteur (pas d'interpolation — un hood cam qui
   * traîne derrière le véhicule serait faux), toujours droit devant.
   * Comme le véhicule n'a pas d'habitacle modélisé, se placer "dedans"
   * laisse simplement les faces (culled, tournées vers l'extérieur) de la
   * carrosserie invisibles depuis l'intérieur plutôt que de les afficher
   * à l'envers.
   */
  private updateCockpitCamera() {
    const v = this.vehicle;
    const forward = new THREE.Vector3(Math.sin(v.heading), 0, Math.cos(v.heading));
    const seatHeight = 1.2 + v.length * 0.045;
    const seatForward = v.length * 0.08;
    const eye = v.object.position.clone().addScaledVector(forward, seatForward).add(new THREE.Vector3(0, seatHeight, 0));
    this.rig.camera.position.copy(eye);
    this.rig.camera.lookAt(eye.clone().addScaledVector(forward, 10));
  }
}
