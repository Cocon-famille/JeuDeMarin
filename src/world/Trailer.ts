import * as THREE from "three";
import { VehicleDef } from "./VehicleCatalog";
import { buildVehicleMesh } from "./VehicleMeshFactory";

/**
 * A towed trailer: no engine, no steering input of its own — it's dragged
 * behind a tow vehicle on a fixed-length hitch. Each frame it's pulled
 * just enough to keep exactly `hitchLength` away from the tow point,
 * which naturally makes it swing wide on turns and straighten out behind
 * on the straights, like a real trailer.
 */
export class Trailer {
  readonly object = new THREE.Group();
  heading = 0;
  length = 4;
  collisionRadius = 1.2;

  constructor(def: VehicleDef, scene: THREE.Scene) {
    const built = buildVehicleMesh(def);
    this.length = built.length;
    this.collisionRadius = Math.max(1, built.length * 0.24);
    this.object.add(built.group);
    scene.add(this.object);
  }

  placeAt(x: number, z: number, heading: number) {
    this.object.position.set(x, 0, z);
    this.heading = heading;
    this.object.rotation.y = heading;
  }

  update(hitchX: number, hitchZ: number, hitchLength: number) {
    const dx = hitchX - this.object.position.x;
    const dz = hitchZ - this.object.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= hitchLength || dist < 1e-4) return;
    const nx = dx / dist;
    const nz = dz / dist;
    const moveDist = dist - hitchLength;
    this.object.position.x += nx * moveDist;
    this.object.position.z += nz * moveDist;
    this.heading = Math.atan2(nx, nz);
    this.object.rotation.y = this.heading;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.object);
  }
}
