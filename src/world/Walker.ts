import * as THREE from "three";
import { GameState } from "../core/GameState";
import { InputManager } from "../core/InputManager";
import { isInWater, wrapWorld, zoneAt } from "./Terrain";
import { resolveCollision } from "./Collision";
import { copy } from "../content/copy";

const WALK_SPEED = 4.5;
const RUN_SPEED = 8;
const TURN_RATE = 3;
const BREATH_DRAIN = 1 / 18; // ~18s of breath when diving
const BREATH_REGEN = 1 / 3; // fast regen at the surface

/** Pedestrian & swimmer share one body — the spec keeps swim-HUD geometry
 * identical to the pedestrian HUD, only the color changes, so the
 * underlying controller stays the same too. */
export class Walker {
  readonly object = new THREE.Group();
  heading = 0;
  depth = 0; // 0 = surface/ground, up to 3 = fully submerged
  wrapDeltaX = 0;
  wrapDeltaZ = 0;

  constructor(scene: THREE.Scene) {
    this.object.add(buildFigure());
    scene.add(this.object);
  }

  respawnAt(x: number, z: number, heading = 0) {
    this.object.position.set(x, 0, z);
    this.heading = heading;
    this.object.rotation.y = heading;
    this.depth = 0;
    this.wrapDeltaX = 0;
    this.wrapDeltaZ = 0;
  }

  update(dt: number, input: InputManager, state: GameState) {
    const inWater = isInWater(this.object.position.x, this.object.position.z);
    const wasSwim = state.mode === "swim";

    if (inWater && state.mode !== "swim") state.setMode("swim");
    else if (!inWater && state.mode === "swim") {
      state.setMode("pedestrian");
      this.depth = 0;
    }

    const running = input.running;
    const speed = running ? RUN_SPEED : WALK_SPEED;
    this.heading -= input.steer * TURN_RATE * dt;
    this.object.rotation.y = this.heading;
    const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.object.position.addScaledVector(dir, input.throttle * speed * dt);
    resolveCollision(this.object.position, 0.4);
    const wrapped = wrapWorld(this.object.position.x, this.object.position.z);
    this.wrapDeltaX = wrapped.x - this.object.position.x;
    this.wrapDeltaZ = wrapped.z - this.object.position.z;
    this.object.position.x = wrapped.x;
    this.object.position.z = wrapped.z;
    state.terrain = zoneAt(this.object.position.x);
    state.visitZone(state.terrain);

    if (state.mode === "swim") {
      const diving = input.isDown("Space") || input.touchDiving;
      this.depth = THREE.MathUtils.clamp(this.depth + (diving ? 1 : -1) * dt * 1.5, 0, 3);
      state.depthM = Math.round(this.depth * 10) / 10;
      if (this.depth > 0.05) {
        state.breath = Math.max(0, state.breath - BREATH_DRAIN * dt);
        if (state.breath === 0) {
          this.depth = 0;
          state.toast(copy.swim.surfaceUp, copy.swim.surfaceUpSub);
        }
      } else {
        state.breath = Math.min(1, state.breath + BREATH_REGEN * dt);
      }
      this.object.position.y = -this.depth;
    } else {
      this.object.position.y = 0;
      if (wasSwim) state.breath = 1;
    }
  }
}

/**
 * No character asset was supplied in any of the Kenney packs (Car Kit and
 * City Kit Suburban are vehicles/buildings; the farm pack is 2D sprites) —
 * so this is still procedural, but a jointed head/torso/arms/legs reads as
 * a person at a glance instead of the single beige capsule it replaces.
 */
function buildFigure(): THREE.Group {
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0a877, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xdb5a3c, roughness: 0.6 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2f3b52, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 });

  const figure = new THREE.Group();

  const legGeo = new THREE.CapsuleGeometry(0.13, 0.62, 4, 8);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, pants);
    leg.position.set(side * 0.12, 0.4, 0);
    figure.add(leg);
  }

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 4, 8), shirt);
  torso.position.y = 1.05;
  figure.add(torso);

  const armGeo = new THREE.CapsuleGeometry(0.09, 0.5, 4, 8);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, skin);
    arm.position.set(side * 0.36, 1.02, 0);
    arm.rotation.z = side * 0.15;
    figure.add(arm);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin);
  head.position.y = 1.55;
  figure.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.position.y = 1.58;
  figure.add(hairCap);

  figure.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true;
  });
  return figure;
}
