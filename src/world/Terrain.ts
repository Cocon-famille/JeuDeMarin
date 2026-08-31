import * as THREE from "three";
import type { Terrain as TerrainZone } from "../core/GameState";
import { registerObstacle } from "./Collision";
import { attachRealModelReplacing } from "./ModelLoader";

const CRATE_MODEL_URL = "/models/cars/box.glb";
// Mêmes variantes que la banlieue étendue (ExtendedWorld.ts) — dupliqué
// plutôt qu'importé pour éviter un cycle (ExtendedWorld dépend déjà de
// Terrain pour CORE_BOUNDS/WORLD_HALF).
const BUILDING_MODEL_URLS = "abcdefghij".split("").map((letter) => `/models/buildings/building-type-${letter}.glb`);

// Trois terrains côte à côte le long de X. Une couleur par terrain — elle
// colore le décor et le titre de zone, jamais un bouton (règle palette §03).
export const ZONE_BOUNDS: Record<TerrainZone, { minX: number; maxX: number; color: number }> = {
  ferme: { minX: -180, maxX: -60, color: 0x8fbf4a },
  chantier: { minX: -60, maxX: 60, color: 0xe2761b },
  ville: { minX: 60, maxX: 180, color: 0x5aa9ff },
};

export const WATER_BOUNDS = { minX: 90, maxX: 175, minZ: 40, maxZ: 100, surfaceY: -0.15 };

// Les trois terrains ne couvrent que le centre (x: -180..180, z: -110..110).
// Au-delà, plutôt qu'un mur invisible ou le vide, le monde continue : sol
// générique + maisons + routes jusqu'à WORLD_HALF, puis on boucle sur le
// bord opposé — jamais de bord qu'on puisse atteindre.
export const CORE_BOUNDS = { minX: -180, maxX: 180, minZ: -110, maxZ: 110 };
export const WORLD_HALF = 900;

export function wrapWorld(x: number, z: number): { x: number; z: number } {
  return { x: wrapAxis(x, WORLD_HALF), z: wrapAxis(z, WORLD_HALF) };
}

function wrapAxis(v: number, half: number): number {
  const span = half * 2;
  return ((((v + half) % span) + span) % span) - half;
}

export function zoneAt(x: number): TerrainZone {
  if (x < ZONE_BOUNDS.ferme.maxX) return "ferme";
  if (x < ZONE_BOUNDS.chantier.maxX) return "chantier";
  return "ville";
}

export function isInWater(x: number, z: number): boolean {
  return (
    x >= WATER_BOUNDS.minX && x <= WATER_BOUNDS.maxX && z >= WATER_BOUNDS.minZ && z <= WATER_BOUNDS.maxZ
  );
}

const GROUND_MIN_Z = -110;
const GROUND_MAX_Z = 110;

function addGroundPlane(group: THREE.Group, minX: number, maxX: number, minZ: number, maxZ: number, color: number) {
  const width = maxX - minX;
  const depth = maxZ - minZ;
  if (width <= 0 || depth <= 0) return;
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(minX + width / 2, 0, minZ + depth / 2);
  mesh.receiveShadow = true;
  group.add(mesh);
}

export function buildTerrain(scene: THREE.Scene) {
  const group = new THREE.Group();

  for (const [id, zone] of Object.entries(ZONE_BOUNDS) as [TerrainZone, typeof ZONE_BOUNDS.ferme][]) {
    if (id !== "ville") {
      addGroundPlane(group, zone.minX, zone.maxX, GROUND_MIN_Z, GROUND_MAX_Z, zone.color);
      continue;
    }
    // La ville a un trou exact aux dimensions du lac : un plan plein
    // dessinerait par-dessus l'eau et la rendrait invisible (bug initial).
    // On carrelle le pourtour en 4 bandes autour du rectangle du lac.
    const w = WATER_BOUNDS;
    addGroundPlane(group, zone.minX, w.minX, GROUND_MIN_Z, GROUND_MAX_Z, zone.color); // gauche
    addGroundPlane(group, w.maxX, zone.maxX, GROUND_MIN_Z, GROUND_MAX_Z, zone.color); // droite
    addGroundPlane(group, w.minX, w.maxX, GROUND_MIN_Z, w.minZ, zone.color); // devant le lac
    addGroundPlane(group, w.minX, w.maxX, w.maxZ, GROUND_MAX_Z, zone.color); // derrière le lac
  }

  // Quelques accessoires low-poly par terrain, pour lire l'espace sans assets d'art.
  addProps(group, ZONE_BOUNDS.ferme, () => makeHayBale(), 1.3);
  addProps(group, ZONE_BOUNDS.chantier, () => makeCrate(), 1.4);
  addProps(group, ZONE_BOUNDS.ville, () => makeBuilding(), 3.2);

  // Fosse du lac (légèrement encaissée) sous la zone d'eau. Le dessus de
  // la fosse doit rester SOUS la surface de l'eau (WATER_BOUNDS.surfaceY),
  // sinon la fosse (opaque) passe devant l'eau (transparente) et la cache.
  const pitHeight = 3;
  const pitTopY = WATER_BOUNDS.surfaceY - 0.25;
  const pit = new THREE.Mesh(
    new THREE.BoxGeometry(WATER_BOUNDS.maxX - WATER_BOUNDS.minX, pitHeight, WATER_BOUNDS.maxZ - WATER_BOUNDS.minZ),
    new THREE.MeshStandardMaterial({ color: 0x1a2a1e, roughness: 1 }),
  );
  pit.position.set(
    (WATER_BOUNDS.minX + WATER_BOUNDS.maxX) / 2,
    pitTopY - pitHeight / 2,
    (WATER_BOUNDS.minZ + WATER_BOUNDS.maxZ) / 2,
  );
  group.add(pit);

  scene.add(group);
  return group;
}

// Chaque terrain fait réapparaître le joueur au milieu de sa plage en X, z=0
// (World.spawnAt) — les props (maintenant solides, voir Collision.ts) ne
// doivent jamais y atterrir, sous peine de coincer le joueur dès l'arrivée.
const SPAWN_CLEAR_RADIUS = 16;

function addProps(group: THREE.Group, zone: { minX: number; maxX: number }, make: () => THREE.Object3D, obstacleRadius: number) {
  const spawnX = (zone.minX + zone.maxX) / 2;
  for (let i = 0; i < 6; i++) {
    let x = 0;
    let z = 0;
    let attempts = 0;
    do {
      x = zone.minX + 12 + Math.random() * (zone.maxX - zone.minX - 24);
      z = -80 + Math.random() * 160;
      attempts++;
    } while (Math.hypot(x - spawnX, z) < SPAWN_CLEAR_RADIUS && attempts < 20);
    if (Math.hypot(x - spawnX, z) < SPAWN_CLEAR_RADIUS) continue;
    const prop = make();
    if (isInWater(x, z)) continue;
    prop.position.set(x, prop.position.y, z);
    prop.rotation.y = Math.random() * Math.PI * 2;
    prop.castShadow = true;
    group.add(prop);
    registerObstacle(x, z, obstacleRadius);
  }
}

function makeHayBale(): THREE.Object3D {
  const geo = new THREE.CylinderGeometry(1.4, 1.4, 2, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd6b24a, roughness: 1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.z = Math.PI / 2;
  mesh.position.y = 1.4;
  return mesh;
}

function makeCrate(): THREE.Object3D {
  const height = 2.2;
  const geo = new THREE.BoxGeometry(height, height, height);
  const mat = new THREE.MeshStandardMaterial({ color: 0xb8631f, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = height / 2;
  mesh.castShadow = true;

  const group = new THREE.Group();
  group.add(mesh);
  attachRealModelReplacing(group, mesh, CRATE_MODEL_URL, height);
  return group;
}

function makeBuilding(): THREE.Object3D {
  const h = 8 + Math.random() * 20;
  const geo = new THREE.BoxGeometry(6, h, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a3345, roughness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = h / 2;
  mesh.castShadow = true;

  const group = new THREE.Group();
  group.add(mesh);
  const url = BUILDING_MODEL_URLS[Math.floor(Math.random() * BUILDING_MODEL_URLS.length)];
  attachRealModelReplacing(group, mesh, url, h);
  return group;
}
