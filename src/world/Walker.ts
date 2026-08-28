import * as THREE from "three";
import { GameState } from "../core/GameState";
import { InputManager } from "../core/InputManager";
import { isInWater } from "./Terrain";
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

  constructor(scene: THREE.Scene) {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.1, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6 }),
    );
    body.position.y = 0.9;
    body.castShadow = true;
    this.object.add(body);
    scene.add(this.object);
  }

  respawnAt(x: number, z: number, heading = 0) {
    this.object.position.set(x, 0, z);
    this.heading = heading;
    this.object.rotation.y = heading;
    this.depth = 0;
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

    if (state.mode === "swim") {
      const diving = input.isDown("Space");
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
