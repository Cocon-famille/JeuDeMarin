import * as THREE from "three";
import type { VehicleDef } from "./VehicleCatalog";

const WHITE = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x161c26, roughness: 0.7 });

function wheel(radius = 0.45, width = 0.35): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, width, 16);
  const mesh = new THREE.Mesh(geo, DARK);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  return mesh;
}

/** A named, emissive-capable light dot used for blinkers/headlights/beacon. */
function lightDot(name: string, color: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat);
  mesh.name = name;
  return mesh;
}

export interface BuiltVehicle {
  group: THREE.Group;
  length: number;
  hasCabin: boolean;
}

export function buildVehicleMesh(def: VehicleDef): BuiltVehicle {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.55, metalness: 0.1 });
  let length = 4;
  let hasCabin = true;

  switch (def.kind) {
    case "voiture": {
      length = 4;
      const body = box(1.9, 0.7, length, bodyMat);
      body.position.y = 0.6;
      const cabin = box(1.6, 0.55, 2, bodyMat.clone());
      cabin.position.set(0, 1.15, -0.2);
      group.add(body, cabin);
      addWheels(group, 1.9, length, 0.42);
      addLights(group, 0.95, 0.55, length / 2);
      break;
    }
    case "tracteur": {
      length = 4.2;
      hasCabin = true;
      const body = box(1.6, 1, 2.6, bodyMat);
      body.position.set(0, 0.75, 0.4);
      const cabin = box(1.4, 1.1, 1.3, new THREE.MeshStandardMaterial({ color: 0xdfe6f2, roughness: 0.4 }));
      cabin.position.set(0, 1.7, 0.6);
      const bucket = box(1.5, 0.5, 0.6, DARK);
      bucket.position.set(0, 0.4, -2.1);
      group.add(body, cabin, bucket);
      const rear = wheel(0.75, 0.5);
      const front = wheel(0.4, 0.32);
      [-1, 1].forEach((side) => {
        const r = rear.clone();
        r.position.set(side * 0.95, 0.75, 0.9);
        const f = front.clone();
        f.position.set(side * 0.85, 0.4, -1.4);
        group.add(r, f);
      });
      addLights(group, 0.8, 1, length / 2);
      break;
    }
    case "camion": {
      length = 6.5;
      const cab = box(2.1, 1.2, 1.8, bodyMat);
      cab.position.set(0, 0.95, length / 2 - 1);
      const bed = box(2.1, 0.9, length - 2, new THREE.MeshStandardMaterial({ color: 0x6b7686, roughness: 0.8 }));
      bed.position.set(0, 0.75, -1);
      group.add(cab, bed);
      addWheels(group, 2.1, length, 0.5, 3);
      addLights(group, 1.05, 0.7, length / 2);
      break;
    }
    case "remorque": {
      length = 6;
      hasCabin = false;
      const bed = box(2.1, 0.6, length, new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.85 }));
      bed.position.y = 0.7;
      const hitch = box(0.15, 0.15, 1, DARK);
      hitch.position.set(0, 0.5, length / 2 + 0.5);
      group.add(bed, hitch);
      addWheels(group, 2.1, length, 0.45, 2, true);
      break;
    }
    case "rouleau": {
      length = 4.4;
      const body = box(1.5, 1, 2, bodyMat);
      body.position.set(0, 1, -0.6);
      const cabin = box(1.2, 0.9, 1, new THREE.MeshStandardMaterial({ color: 0xdfe6f2, roughness: 0.4 }));
      cabin.position.set(0, 1.7, -0.6);
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.65, 1.7, 20),
        new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.3, metalness: 0.4 }),
      );
      drum.rotation.z = Math.PI / 2;
      drum.position.set(0, 0.65, 1.6);
      group.add(body, cabin, drum);
      const rear = wheel(0.5, 0.4);
      [-1, 1].forEach((side) => {
        const r = rear.clone();
        r.position.set(side * 0.9, 0.5, -1.6);
        group.add(r);
      });
      addLights(group, 0.75, 1, 2.2);
      break;
    }
    case "pelleteuse": {
      length = 4.6;
      const body = box(2, 1, 2.6, bodyMat);
      body.position.y = 0.85;
      const track = new THREE.MeshStandardMaterial({ color: 0x0c1017, roughness: 0.9 });
      [-1, 1].forEach((side) => {
        const t = box(0.5, 0.6, 3.2, track);
        t.position.set(side * 1.05, 0.4, 0);
        group.add(t);
      });
      const turret = box(1.3, 0.7, 1.6, bodyMat.clone());
      turret.position.set(0, 1.55, 0.2);
      const boom = box(0.3, 0.3, 2.4, DARK);
      boom.position.set(0, 1.9, -1.6);
      boom.rotation.x = -0.4;
      const bucket = box(0.7, 0.5, 0.6, DARK);
      bucket.position.set(0, 1.1, -2.9);
      group.add(body, turret, boom, bucket);
      addLights(group, 1, 0.9, 2.3);
      break;
    }
    case "moissonneuse": {
      length = 7.5;
      const body = box(2.3, 1.3, 4, bodyMat);
      body.position.set(0, 1.1, -1);
      const tank = box(1.8, 0.9, 2, new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.4, metalness: 0.2 }));
      tank.position.set(0, 2.2, -1.6);
      const cabin = box(1.3, 1.1, 1.2, new THREE.MeshStandardMaterial({ color: 0xdfe6f2, roughness: 0.35 }));
      cabin.position.set(0, 2.1, 0.9);
      const header = box(2.9, 0.5, 1.4, DARK);
      header.position.set(0, 0.55, 3.3);
      const reel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 2.7, 12),
        new THREE.MeshStandardMaterial({ color: 0xffc02e, roughness: 0.5 }),
      );
      reel.rotation.z = Math.PI / 2;
      reel.position.set(0, 1.05, 3.6);
      group.add(body, tank, cabin, header, reel);

      const driveWheel = wheel(0.85, 0.55);
      const rearWheel = wheel(0.4, 0.32);
      [-1, 1].forEach((side) => {
        const d = driveWheel.clone();
        d.position.set(side * 1.05, 0.85, 0.6);
        const r = rearWheel.clone();
        r.position.set(side * 0.9, 0.4, -2.6);
        group.add(d, r);
      });
      addLights(group, 1.05, 1.1, length / 2 - 1);
      break;
    }
  }

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true;
  });

  return { group, length, hasCabin };
}

function addWheels(group: THREE.Group, track: number, length: number, radius: number, pairs = 2, trailer = false) {
  const half = length / 2 - radius - 0.3;
  const positions: number[] = [];
  for (let i = 0; i < pairs; i++) {
    const t = pairs === 1 ? 0 : i / (pairs - 1);
    positions.push(THREE.MathUtils.lerp(trailer ? half * 0.6 : half, -half, t));
  }
  for (const z of positions) {
    for (const side of [-1, 1]) {
      const w = wheel(radius, radius * 0.7);
      w.position.set((side * track) / 2, radius, z);
      group.add(w);
    }
  }
}

/**
 * Lights on both ends: the chase camera sits behind the vehicle (facing
 * +z, the direction of travel) so it mostly sees the REAR (-z) face —
 * front-only lights are invisible from the default view. Blinkers and
 * headlights/taillights are duplicated front+rear so the signal reads
 * from whichever side the player is looking from.
 */
function addLights(group: THREE.Group, halfWidth: number, height: number, halfLength: number) {
  const lf = lightDot("blinkerL_front", 0xffc02e);
  lf.position.set(-halfWidth, height, halfLength - 0.08);
  const rf = lightDot("blinkerR_front", 0xffc02e);
  rf.position.set(halfWidth, height, halfLength - 0.08);
  const lr = lightDot("blinkerL_rear", 0xffc02e);
  lr.position.set(-halfWidth, height, -halfLength + 0.08);
  const rr = lightDot("blinkerR_rear", 0xffc02e);
  rr.position.set(halfWidth, height, -halfLength + 0.08);
  group.add(lf, rf, lr, rr);

  const headL = lightDot("headlightL", 0xf4f1ea);
  headL.scale.setScalar(1.6);
  headL.position.set(-halfWidth * 0.55, height, halfLength);
  const headR = lightDot("headlightR", 0xf4f1ea);
  headR.scale.setScalar(1.6);
  headR.position.set(halfWidth * 0.55, height, halfLength);
  group.add(headL, headR);

  const tailL = lightDot("taillightL", 0xff3b3b);
  tailL.scale.setScalar(1.3);
  tailL.position.set(-halfWidth * 0.55, height, -halfLength);
  const tailR = lightDot("taillightR", 0xff3b3b);
  tailR.scale.setScalar(1.3);
  tailR.position.set(halfWidth * 0.55, height, -halfLength);
  group.add(tailL, tailR);

  // Real light cast forward so "phares" read even when the headlamp dot
  // itself is on the far side of the vehicle from the camera.
  const spot = new THREE.SpotLight(0xfff4d6, 0, 26, Math.PI / 6, 0.5, 1.2);
  spot.name = "headlightSpot";
  spot.position.set(0, height, halfLength);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0, halfLength + 10);
  group.add(spot, spotTarget, spot.target);
  spot.target = spotTarget;

  const beacon = lightDot("beacon", 0xffc02e);
  beacon.scale.setScalar(1.5);
  beacon.position.set(0, height + 0.7, 0);
  group.add(beacon);
}

export { WHITE, DARK };
