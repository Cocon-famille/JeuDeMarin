import * as THREE from "three";
import { registerObstacle } from "./Collision";
import { attachRealModelReplacing } from "./ModelLoader";
import { PARKING_SPOT } from "./Shop";

const HOUSE_MODEL_URL = "/models/buildings/building-type-a.glb";
const HOUSE_HEIGHT = 5;
const HOUSE_FOOTPRINT = 6;
const HOUSE_COLLISION_RADIUS = 3.2;

export const HOUSE_POSITION = new THREE.Vector3(PARKING_SPOT.x + 15, 0, PARKING_SPOT.z + 10);
// Point purement indicatif pour l'icône "regarde ici" — la vraie détection
// d'entrée est un cercle autour de TOUTE la maison (voir HOUSE_ENTER_RADIUS),
// pas seulement de ce côté-là : un joueur qui marche en ligne droite depuis
// le spawn arrive en diagonale et se fait arrêter par la collision bien
// avant d'atteindre un point calé sur un seul côté (bug rapporté : "je peux
// pas rentrer" alors qu'il était juste devant la porte visible).
export const HOUSE_DOOR_POSITION = HOUSE_POSITION.clone().add(new THREE.Vector3(-6, 0, 0));
// Un peu plus large que le rayon de collision (3.2) : où que la collision
// arrête le joueur autour du bâtiment, il reste dans ce cercle.
export const HOUSE_ENTER_RADIUS = HOUSE_COLLISION_RADIUS + 1.5;

// L'intérieur vit dans sa propre poche de la scène, loin de tout (le monde
// extérieur boucle à ±900 — WORLD_HALF) pour ne jamais chevaucher un autre
// décor ni se faire ramener dedans par wrapWorld.
const INTERIOR_ORIGIN = new THREE.Vector3(0, 0, -3000);
const ROOM_HALF_X = 5;
const ROOM_HALF_Z = 4.5;
const WALL_HEIGHT = 3.2;
const BED_LOCAL = new THREE.Vector2(-ROOM_HALF_X + 1.9, -ROOM_HALF_Z + 1.9);

// Le point d'apparition est au centre de la pièce, pas collé à l'entrée —
// une caméra suiveuse classique a besoin de recul derrière le joueur, et
// collée au mur elle se retrouverait dehors dès l'entrée.
export const INTERIOR_SPAWN = INTERIOR_ORIGIN.clone();
const EXIT_LOCAL = new THREE.Vector2(0, ROOM_HALF_Z - 1);
export const INTERIOR_EXIT_ZONE = {
  x: INTERIOR_ORIGIN.x + EXIT_LOCAL.x,
  z: INTERIOR_ORIGIN.z + EXIT_LOCAL.y,
  radius: 2.2,
};
export const INTERIOR_BED_ZONE = {
  x: INTERIOR_ORIGIN.x + BED_LOCAL.x,
  z: INTERIOR_ORIGIN.z + BED_LOCAL.y,
  radius: 1.7,
};
export const INTERIOR_BOUNDS = {
  minX: INTERIOR_ORIGIN.x - ROOM_HALF_X + 0.6,
  maxX: INTERIOR_ORIGIN.x + ROOM_HALF_X - 0.6,
  minZ: INTERIOR_ORIGIN.z - ROOM_HALF_Z + 0.6,
  maxZ: INTERIOR_ORIGIN.z + ROOM_HALF_Z - 0.6,
};

export function buildHouse(scene: THREE.Scene) {
  buildExterior(scene);
  buildInterior(scene);
}

function buildExterior(scene: THREE.Scene) {
  const h = HOUSE_HEIGHT;
  const geo = new THREE.BoxGeometry(HOUSE_FOOTPRINT, h, HOUSE_FOOTPRINT);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = h / 2;
  mesh.castShadow = true;

  const group = new THREE.Group();
  group.position.copy(HOUSE_POSITION);
  group.add(mesh);
  attachRealModelReplacing(group, mesh, HOUSE_MODEL_URL, h, HOUSE_FOOTPRINT);
  scene.add(group);

  registerObstacle(HOUSE_POSITION.x, HOUSE_POSITION.z, HOUSE_COLLISION_RADIUS);
}

function buildInterior(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.position.copy(INTERIOR_ORIGIN);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.85 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF_X * 2, ROOM_HALF_Z * 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const rugMat = new THREE.MeshStandardMaterial({ color: 0xb4483f, roughness: 0.9 });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.4, 0.01, 0.4);
  group.add(rug);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8ddc8, roughness: 0.9 });
  const wallThickness = 0.3;
  const walls: [number, number, number, number][] = [
    [0, -ROOM_HALF_Z, ROOM_HALF_X * 2, wallThickness],
    [0, ROOM_HALF_Z, ROOM_HALF_X * 2, wallThickness],
    [-ROOM_HALF_X, 0, wallThickness, ROOM_HALF_Z * 2],
    [ROOM_HALF_X, 0, wallThickness, ROOM_HALF_Z * 2],
  ];
  for (const [cx, cz, sx, sz] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, WALL_HEIGHT, sz), wallMat);
    wall.position.set(cx, WALL_HEIGHT / 2, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  addBed(group, BED_LOCAL);
  addTableAndChairs(group, new THREE.Vector2(ROOM_HALF_X - 2.2, -ROOM_HALF_Z + 2));
  addDoormat(group, EXIT_LOCAL);

  const light = new THREE.PointLight(0xfff1d8, 0.9, 14);
  light.position.set(0, WALL_HEIGHT - 0.3, 0);
  group.add(light);

  scene.add(group);
}

function addBed(parent: THREE.Group, at: THREE.Vector2) {
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x5b3d28, roughness: 0.7 });
  const mattressMat = new THREE.MeshStandardMaterial({ color: 0xf4ede0, roughness: 0.8 });
  const blanketMat = new THREE.MeshStandardMaterial({ color: 0x3f6d8f, roughness: 0.8 });
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });

  const bed = new THREE.Group();
  bed.position.set(at.x, 0, at.y);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 3.2), frameMat);
  frame.position.y = 0.3;
  bed.add(frame);

  const mattress = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 3), mattressMat);
  mattress.position.y = 0.65;
  bed.add(mattress);

  const blanket = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 1.8), blanketMat);
  blanket.position.set(0, 0.85, 0.5);
  bed.add(blanket);

  const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.6), pillowMat);
  pillow.position.set(0, 0.9, -1.15);
  bed.add(pillow);

  const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.15), frameMat);
  headboard.position.set(0, 0.9, -1.6);
  bed.add(headboard);

  bed.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  parent.add(bed);
}

function addTableAndChairs(parent: THREE.Group, at: THREE.Vector2) {
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5033, roughness: 0.75 });
  const table = new THREE.Group();
  table.position.set(at.x, 0, at.y);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 16), woodMat);
  top.position.y = 0.75;
  table.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.75, 8), woodMat);
  leg.position.y = 0.375;
  table.add(leg);
  table.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  parent.add(table);

  for (const angle of [0, Math.PI]) {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.55), woodMat);
    seat.position.y = 0.5;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.1), woodMat);
    back.position.set(0, 0.8, -0.25);
    chair.add(back);
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
    for (const [lx, lz] of [
      [-0.22, -0.22],
      [0.22, -0.22],
      [-0.22, 0.22],
      [0.22, 0.22],
    ]) {
      const l = new THREE.Mesh(legGeo, woodMat);
      l.position.set(lx, 0.25, lz);
      chair.add(l);
    }
    chair.position.set(at.x + Math.sin(angle) * 1.3, 0, at.y + Math.cos(angle) * 1.3);
    chair.rotation.y = angle;
    chair.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    parent.add(chair);
  }
}

function addDoormat(parent: THREE.Group, at: THREE.Vector2) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(at.x, 0.015, at.y);
  parent.add(mesh);
}
