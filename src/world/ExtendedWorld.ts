import * as THREE from "three";
import { CORE_BOUNDS, WORLD_HALF } from "./Terrain";

const SUBURB_COLOR = 0x6f9a54;
const ROAD_COLOR = 0x484d55;
const ROAD_WIDTH = 6;
const BLOCK = 90;
const HOUSE_COLORS = [0xe8d9c0, 0xd9c6a5, 0xc9b896, 0xefe3d0, 0xd8cdb8, 0xc7d6c2];

/**
 * Au-delà des trois terrains (x/z dans CORE_BOUNDS), le monde continue :
 * sol générique, pâtés de maisons et grille de routes jusqu'à WORLD_HALF.
 * Rien n'y est interactif — c'est du décor pour qu'il n'y ait jamais de
 * vide, combiné au bouclage des coordonnées (Terrain.wrapWorld).
 */
export function buildExtendedWorld(scene: THREE.Scene) {
  const group = new THREE.Group();
  addGroundFrame(group);
  addRoadGrid(group);
  addHouses(group);
  scene.add(group);
  return group;
}

function addGroundFrame(group: THREE.Group) {
  const c = CORE_BOUNDS;
  addPlane(group, -WORLD_HALF, c.minX, -WORLD_HALF, WORLD_HALF, SUBURB_COLOR, 0);
  addPlane(group, c.maxX, WORLD_HALF, -WORLD_HALF, WORLD_HALF, SUBURB_COLOR, 0);
  addPlane(group, c.minX, c.maxX, -WORLD_HALF, c.minZ, SUBURB_COLOR, 0);
  addPlane(group, c.minX, c.maxX, c.maxZ, WORLD_HALF, SUBURB_COLOR, 0);
}

function addRoadGrid(group: THREE.Group) {
  const c = CORE_BOUNDS;
  const half = ROAD_WIDTH / 2;
  for (let gx = -WORLD_HALF + BLOCK; gx < WORLD_HALF; gx += BLOCK) {
    if (gx > c.minX && gx < c.maxX) {
      addPlane(group, gx - half, gx + half, -WORLD_HALF, c.minZ, ROAD_COLOR, 0.02);
      addPlane(group, gx - half, gx + half, c.maxZ, WORLD_HALF, ROAD_COLOR, 0.02);
    } else {
      addPlane(group, gx - half, gx + half, -WORLD_HALF, WORLD_HALF, ROAD_COLOR, 0.02);
    }
  }
  for (let gz = -WORLD_HALF + BLOCK; gz < WORLD_HALF; gz += BLOCK) {
    if (gz > c.minZ && gz < c.maxZ) {
      addPlane(group, -WORLD_HALF, c.minX, gz - half, gz + half, ROAD_COLOR, 0.02);
      addPlane(group, c.maxX, WORLD_HALF, gz - half, gz + half, ROAD_COLOR, 0.02);
    } else {
      addPlane(group, -WORLD_HALF, WORLD_HALF, gz - half, gz + half, ROAD_COLOR, 0.02);
    }
  }
}

function addPlane(group: THREE.Group, minX: number, maxX: number, minZ: number, maxZ: number, color: number, y: number) {
  const width = maxX - minX;
  const depth = maxZ - minZ;
  if (width <= 0 || depth <= 0) return;
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(minX + width / 2, y, minZ + depth / 2);
  mesh.receiveShadow = true;
  group.add(mesh);
}

function addHouses(group: THREE.Group) {
  const c = CORE_BOUNDS;
  const bodyMatrices: THREE.Matrix4[] = [];
  const roofMatrices: THREE.Matrix4[] = [];
  const bodyColors: THREE.Color[] = [];

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (let gx = -WORLD_HALF + BLOCK / 2; gx < WORLD_HALF; gx += BLOCK) {
    for (let gz = -WORLD_HALF + BLOCK / 2; gz < WORLD_HALF; gz += BLOCK) {
      if (gx > c.minX - BLOCK && gx < c.maxX + BLOCK && gz > c.minZ - BLOCK && gz < c.maxZ + BLOCK) continue;

      for (let i = 0; i < 2; i++) {
        const offsetX = (i === 0 ? -1 : 1) * BLOCK * 0.22;
        const x = gx + offsetX + (Math.random() - 0.5) * 10;
        const z = gz + (Math.random() - 0.5) * (BLOCK - ROAD_WIDTH - 16);
        const w = 5 + Math.random() * 3;
        const d = 5 + Math.random() * 3;
        const h = 3.5 + Math.random() * 2.5;
        const rotY = Math.random() * Math.PI * 2;
        quat.setFromEuler(new THREE.Euler(0, rotY, 0));

        pos.set(x, h / 2, z);
        scale.set(w, h, d);
        m.compose(pos, quat, scale);
        bodyMatrices.push(m.clone());
        bodyColors.push(new THREE.Color(HOUSE_COLORS[Math.floor(Math.random() * HOUSE_COLORS.length)]));

        pos.set(x, h + 0.6, z);
        scale.set(w * 0.88, 1.2, d * 0.88);
        m.compose(pos, quat, scale);
        roofMatrices.push(m.clone());
      }
    }
  }

  const bodyMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    bodyMatrices.length,
  );
  bodyMatrices.forEach((mat, i) => bodyMesh.setMatrixAt(i, mat));
  bodyColors.forEach((color, i) => bodyMesh.setColorAt(i, color));
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  const roofMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.7 }),
    roofMatrices.length,
  );
  roofMatrices.forEach((mat, i) => roofMesh.setMatrixAt(i, mat));
  roofMesh.castShadow = true;
  group.add(roofMesh);
}
