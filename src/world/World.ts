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
import { resolveAgainst } from "./Collision";
import { CHANTIER_CRATES, PlacedProp } from "./Terrain";
import {
  buildHouse,
  HOUSE_DOOR_POSITION,
  HOUSE_DOOR_RADIUS,
  INTERIOR_BED_ZONE,
  INTERIOR_BOUNDS,
  INTERIOR_EXIT_ZONE,
  INTERIOR_SPAWN,
} from "./House";
import { VEHICLE_CATALOG, VehicleDef } from "./VehicleCatalog";
import { copy } from "../content/copy";

const ENTER_EXIT_RADIUS = 3.5;
const GRAB_RADIUS = 4.5;
const CARRY_HEIGHT = 1.6;

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
  nearHouseDoor = false;
  nearBed = false;
  nearHouseExit = false;
  indoors = false;
  trailer: Trailer | null = null;
  trailerDef: VehicleDef | null = null;
  private carrying: PlacedProp | null = null;
  private nearGrabbable: PlacedProp | null = null;
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
  private snapCameraNextFrame = false;

  constructor(canvas: HTMLCanvasElement, state: GameState) {
    this.state = state;
    this.gearbox = new GearboxController(this.state);
    this.rig = new SceneRig(canvas);
    buildTerrain(this.rig.scene);
    this.water = buildWater(this.rig.scene);
    buildShop(this.rig.scene);
    buildExtendedWorld(this.rig.scene);
    buildHouse(this.rig.scene);
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
    if (this.carrying && def.kind !== "pelleteuse") this.dropCarried();

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

  /**
   * Pelleteuse-only: while carrying, the crate is rigidly welded to a
   * point in front of the bucket (no physics — it's "held", not dragged
   * like the trailer) and its collision obstacle moves with it, so it
   * still blocks things at wherever it currently is. Otherwise, look for
   * the nearest grabbable crate within reach.
   */
  private updatePelleteuse() {
    const forward = new THREE.Vector3(Math.sin(this.vehicle.heading), 0, Math.cos(this.vehicle.heading));
    if (this.carrying) {
      const carryPos = this.vehicle.object.position.clone().addScaledVector(forward, this.vehicle.length / 2 + 1.2);
      this.carrying.object.position.set(carryPos.x, CARRY_HEIGHT, carryPos.z);
      this.carrying.object.rotation.y = this.vehicle.heading;
      this.carrying.obstacle.x = carryPos.x;
      this.carrying.obstacle.z = carryPos.z;
      this.nearGrabbable = null;
      if (this.input.justPressed("KeyE")) this.dropCarried();
      return;
    }

    const pos = this.vehicle.object.position;
    let nearest: PlacedProp | null = null;
    let nearestDist = GRAB_RADIUS;
    for (const crate of CHANTIER_CRATES) {
      const d = Math.hypot(crate.object.position.x - pos.x, crate.object.position.z - pos.z);
      if (d < nearestDist) {
        nearest = crate;
        nearestDist = d;
      }
    }
    this.nearGrabbable = nearest;
    if (nearest && this.input.justPressed("KeyE")) {
      this.carrying = nearest;
      this.state.toast("Chargement attrapé", "Repose-le avec E.");
    }
  }

  private dropCarried() {
    if (!this.carrying) return;
    this.carrying.object.position.y = 0;
    this.carrying.obstacle.x = this.carrying.object.position.x;
    this.carrying.obstacle.z = this.carrying.object.position.z;
    this.state.toast("Chargement posé");
    this.carrying = null;
  }

  /** Texte + touche pour le CTA du HUD pendant qu'on conduit la pelleteuse. */
  grabPrompt(): { text: string; key?: string } | null {
    if (this.vehicle.def.kind !== "pelleteuse") return null;
    if (this.carrying) return { text: "Poser le chargement", key: "E" };
    if (this.nearGrabbable) return { text: "Attraper", key: "E" };
    return null;
  }

  private enterHouse() {
    this.indoors = true;
    this.walker.indoors = true;
    this.walker.respawnAt(INTERIOR_SPAWN.x, INTERIOR_SPAWN.z, Math.PI);
    this.snapCameraNextFrame = true;
    this.state.toast("Bienvenue chez toi", "Le lit est au fond à gauche.");
  }

  private exitHouse() {
    this.indoors = false;
    this.walker.indoors = false;
    this.walker.respawnAt(HOUSE_DOOR_POSITION.x, HOUSE_DOOR_POSITION.z, 0);
    this.snapCameraNextFrame = true;
  }

  private sleep() {
    this.state.clockMinutes = 8 * 60;
    this.state.toast("Bonne nuit !", "Tu te réveilles à 8h00.");
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

        // The leash constraint above only pulls the trailer back toward the
        // vehicle when it's too far — it never stops the vehicle itself from
        // backing up into the trailer it's towing, so that needs its own
        // collision check here, same damping idiom as Vehicle's own collision.
        if (
          resolveAgainst(
            this.vehicle.object.position,
            this.vehicle.collisionRadius,
            this.trailer.object.position.x,
            this.trailer.object.position.z,
            this.trailer.collisionRadius,
          )
        ) {
          this.vehicle.speed *= 0.3;
        }
      }

      if (this.vehicle.def.kind === "pelleteuse") this.updatePelleteuse();
      else if (this.carrying) this.dropCarried();

      if (this.input.justPressed("KeyV")) this.toggleView();
      if (this.input.justPressed("KeyF")) {
        if (this.carrying) this.dropCarried();
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
      // The parked vehicle (and trailer) can't be a static Collision
      // obstacle — it moves — so it never blocked the pedestrian from
      // just walking into it. Resolved here, not inside Walker, since
      // it needs to stay well under ENTER_EXIT_RADIUS or the "remonter"
      // prompt would never trigger.
      resolveAgainst(this.walker.object.position, 0.4, this.vehicle.object.position.x, this.vehicle.object.position.z, this.vehicle.collisionRadius);
      if (this.trailer) {
        resolveAgainst(this.walker.object.position, 0.4, this.trailer.object.position.x, this.trailer.object.position.z, this.trailer.collisionRadius);
      }
      const wp = this.walker.object.position;

      if (this.indoors) {
        wp.x = THREE.MathUtils.clamp(wp.x, INTERIOR_BOUNDS.minX, INTERIOR_BOUNDS.maxX);
        wp.z = THREE.MathUtils.clamp(wp.z, INTERIOR_BOUNDS.minZ, INTERIOR_BOUNDS.maxZ);
        this.nearVehicle = false;
        this.nearShop = false;
        this.nearHouseDoor = false;
        this.nearBed = Math.hypot(wp.x - INTERIOR_BED_ZONE.x, wp.z - INTERIOR_BED_ZONE.z) < INTERIOR_BED_ZONE.radius;
        this.nearHouseExit =
          Math.hypot(wp.x - INTERIOR_EXIT_ZONE.x, wp.z - INTERIOR_EXIT_ZONE.z) < INTERIOR_EXIT_ZONE.radius;
        if (this.nearBed && this.input.justPressed("KeyE")) this.sleep();
        else if (this.nearHouseExit && this.input.justPressed("KeyE")) this.exitHouse();
      } else {
        const vp = this.vehicle.object.position;
        this.nearVehicle = wp.distanceTo(vp) < ENTER_EXIT_RADIUS && this.state.mode === "pedestrian";
        this.nearShop = this.state.mode === "pedestrian" && isNearShop(wp.x, wp.z);
        this.nearHouseDoor =
          this.state.mode === "pedestrian" &&
          Math.hypot(wp.x - HOUSE_DOOR_POSITION.x, wp.z - HOUSE_DOOR_POSITION.z) < HOUSE_DOOR_RADIUS;
        this.nearBed = false;
        this.nearHouseExit = false;

        if (this.nearVehicle && this.input.justPressed("KeyE")) {
          this.vehicle.respawnAt(wp.x, wp.z, this.walker.heading);
          this.walker.object.visible = false;
          this.state.setMode("drive");
        } else if (this.nearHouseDoor && this.input.justPressed("KeyE")) {
          this.enterHouse();
        }
        if (this.nearShop) {
          this.state.toast(copy.terrain.somethingShines);
        }
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
    // The house interior is a small room (House.ts) — the usual outdoor
    // chase distance/height would put the camera outside its walls (there's
    // no ceiling, so a camera high enough looks straight over them).
    const distance = this.indoors ? 4 : 8;
    const vertBase = this.indoors ? 2.6 : 4.5;
    const horiz = distance * Math.cos(pitch);
    const vert = vertBase + distance * Math.sin(pitch);
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(-horiz);
    const desired = target.position.clone().add(back).add(new THREE.Vector3(0, vert, 0));
    if (this.snapCameraNextFrame) {
      // A teleport across a huge gap (entering/exiting the house interior,
      // which lives ~3000 units away from the outdoor world) can't be
      // covered by the usual per-frame lerp — the camera would spend many
      // frames crawling across empty space, rendering nothing but fog.
      this.rig.camera.position.copy(desired);
      this.snapCameraNextFrame = false;
    } else {
      this.rig.camera.position.lerp(desired, 0.15);
    }
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
