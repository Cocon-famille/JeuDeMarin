import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CORE_BOUNDS, WORLD_HALF } from "./Terrain";
import { loadModel } from "./ModelLoader";
import { registerObstacle } from "./Collision";

const BUILDING_TYPES = "abcdefghij".split("").map((letter) => `/models/buildings/building-type-${letter}.glb`);
const ROAD_TEXTURE_URL = "/textures/road-straight.png";

const SUBURB_COLOR = 0x6f9a54;
const ROAD_COLOR = 0x434e54; // asphalt color sampled from the road texture, used for plain intersection squares
const ROAD_WIDTH = 6;
const BLOCK = 90;
const HOUSE_COLORS = [0xe8d9c0, 0xd9c6a5, 0xc9b896, 0xefe3d0, 0xd8cdb8, 0xc7d6c2];

const roadTexture = new THREE.TextureLoader().load(ROAD_TEXTURE_URL);
roadTexture.colorSpace = THREE.SRGBColorSpace;
roadTexture.wrapS = THREE.RepeatWrapping;
roadTexture.wrapT = THREE.RepeatWrapping;

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
  const gxList: number[] = [];
  const gzList: number[] = [];
  for (let gx = -WORLD_HALF + BLOCK; gx < WORLD_HALF; gx += BLOCK) gxList.push(gx);
  for (let gz = -WORLD_HALF + BLOCK; gz < WORLD_HALF; gz += BLOCK) gzList.push(gz);

  // Each line is built as short segments between consecutive crossings
  // (never one long strip through all of them) — two full-length textured
  // strips overlapping at every crossing z-fought against each other,
  // rendering as a dashed, flickering mess right where roads meet.
  for (const gx of gxList) {
    if (gx > c.minX && gx < c.maxX) {
      addVerticalSegments(group, gx, -WORLD_HALF, c.minZ, gzList);
      addVerticalSegments(group, gx, c.maxZ, WORLD_HALF, gzList);
    } else {
      addVerticalSegments(group, gx, -WORLD_HALF, WORLD_HALF, gzList);
    }
  }
  for (const gz of gzList) {
    if (gz > c.minZ && gz < c.maxZ) {
      addHorizontalSegments(group, gz, -WORLD_HALF, c.minX, gxList);
      addHorizontalSegments(group, gz, c.maxX, WORLD_HALF, gxList);
    } else {
      addHorizontalSegments(group, gz, -WORLD_HALF, WORLD_HALF, gxList);
    }
  }
  // A plain asphalt square wherever a vertical and horizontal strip actually
  // cross (skipped only where both fall inside the core zone, where
  // neither strip is drawn at all).
  for (const gx of gxList) {
    const gxInCore = gx > c.minX && gx < c.maxX;
    for (const gz of gzList) {
      const gzInCore = gz > c.minZ && gz < c.maxZ;
      if (gxInCore && gzInCore) continue;
      addPlane(group, gx - half, gx + half, gz - half, gz + half, ROAD_COLOR, 0.025);
    }
  }
}

/** Splits one vertical line's span into straight segments, stopping half a road-width short of every crossing along it so the segment never overlaps that crossing's asphalt square. */
function addVerticalSegments(group: THREE.Group, gx: number, spanMinZ: number, spanMaxZ: number, gzList: number[]) {
  const half = ROAD_WIDTH / 2;
  const crossings = gzList.filter((gz) => gz > spanMinZ && gz < spanMaxZ).sort((a, b) => a - b);
  const points = [spanMinZ, ...crossings, spanMaxZ];
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i] + (i === 0 ? 0 : half);
    const segEnd = points[i + 1] - (i + 2 === points.length ? 0 : half);
    addRoadStrip(group, gx - half, gx + half, segStart, segEnd, true);
  }
}

/** Same as addVerticalSegments, for a horizontal line. */
function addHorizontalSegments(group: THREE.Group, gz: number, spanMinX: number, spanMaxX: number, gxList: number[]) {
  const half = ROAD_WIDTH / 2;
  const crossings = gxList.filter((gx) => gx > spanMinX && gx < spanMaxX).sort((a, b) => a - b);
  const points = [spanMinX, ...crossings, spanMaxX];
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i] + (i === 0 ? 0 : half);
    const segEnd = points[i + 1] - (i + 2 === points.length ? 0 : half);
    addRoadStrip(group, segStart, segEnd, gz - half, gz + half, false);
  }
}

/** A straight asphalt strip, textured and tiled along its length (the Kenney road texture repeats cleanly top-to-bottom). */
function addRoadStrip(group: THREE.Group, minX: number, maxX: number, minZ: number, maxZ: number, vertical: boolean) {
  const width = maxX - minX;
  const depth = maxZ - minZ;
  if (width <= 0 || depth <= 0) return;
  const length = vertical ? depth : width;
  // Always build the geometry in the texture's own orientation (narrow
  // ROAD_WIDTH across local X, the repeating road running along local Y) and
  // spin the whole mesh for horizontal strips, rather than rotating the
  // texture itself — combining a 90° texture.rotation with a highly
  // non-uniform repeat (1 vs. up to a few hundred) shears the UVs instead of
  // swapping axes, which rendered as a diagonal dashed mess.
  const geo = new THREE.PlaneGeometry(ROAD_WIDTH, length);
  const tex = roadTexture.clone();
  tex.needsUpdate = true;
  tex.repeat.set(1, length / ROAD_WIDTH);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  if (!vertical) mesh.rotateZ(Math.PI / 2);
  mesh.position.set(minX + width / 2, 0.02, minZ + depth / 2);
  mesh.receiveShadow = true;
  group.add(mesh);
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

interface HousePlacement {
  x: number;
  z: number;
  h: number;
  w: number;
  d: number;
  rotY: number;
}

function addHouses(group: THREE.Group) {
  const c = CORE_BOUNDS;
  const placements: HousePlacement[] = [];

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
        placements.push({ x, z, h, w, d, rotY });
        registerObstacle(x, z, (Math.max(w, d) / 2) * 0.85);
      }
    }
  }

  const boxes = buildBoxHouses(placements);
  group.add(boxes);
  attachRealBuildings(group, boxes, placements);
}

/** Instant low-poly placeholder — box body + roof cap, same as before. */
function buildBoxHouses(placements: HousePlacement[]): THREE.Group {
  const wrap = new THREE.Group();
  wrap.name = "proceduralHouses";
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const bodyColors: THREE.Color[] = [];

  const bodyMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), placements.length);
  const roofMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.7 }),
    placements.length,
  );

  placements.forEach((p, i) => {
    quat.setFromEuler(new THREE.Euler(0, p.rotY, 0));
    pos.set(p.x, p.h / 2, p.z);
    scale.set(p.w, p.h, p.d);
    m.compose(pos, quat, scale);
    bodyMesh.setMatrixAt(i, m);
    bodyColors.push(new THREE.Color(HOUSE_COLORS[Math.floor(Math.random() * HOUSE_COLORS.length)]));

    pos.set(p.x, p.h + 0.6, p.z);
    scale.set(p.w * 0.88, 1.2, p.d * 0.88);
    m.compose(pos, quat, scale);
    roofMesh.setMatrixAt(i, m);
  });
  bodyColors.forEach((color, i) => bodyMesh.setColorAt(i, color));
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  roofMesh.castShadow = true;
  wrap.add(bodyMesh, roofMesh);
  return wrap;
}

/**
 * Fire-and-forget: loads the 10 real Kenney City Kit building models and,
 * once all are in, merges one clone per placement (scaled to the same
 * random height the box placeholder used) into a single static mesh — one
 * draw call for the whole suburb instead of hundreds. If any model fails
 * to load (offline, missing file) the box placeholders stay up forever.
 */
function attachRealBuildings(group: THREE.Group, fallback: THREE.Group, placements: HousePlacement[]) {
  Promise.all(BUILDING_TYPES.map((url) => loadModel(url))).then((models) => {
    const loaded = models.filter((m): m is THREE.Group => m !== null);
    if (loaded.length === 0) return;

    const findMesh = (model: THREE.Group): THREE.Mesh | undefined => {
      let found: THREE.Mesh | undefined;
      model.traverse((obj) => {
        if (!found && obj instanceof THREE.Mesh) found = obj;
      });
      return found;
    };
    const naturalGeometries = loaded.map((model) => findMesh(model)?.geometry ?? null);
    const material = findMesh(loaded[0])?.material as THREE.Material | undefined;
    if (!material) return;

    const m = new THREE.Matrix4();
    const pieces: THREE.BufferGeometry[] = [];
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    placements.forEach((p) => {
      const geo = naturalGeometries[Math.floor(Math.random() * naturalGeometries.length)];
      if (!geo) return;
      box.setFromBufferAttribute(geo.attributes.position as THREE.BufferAttribute);
      box.getSize(size);
      box.getCenter(center);
      if (size.y <= 0 || size.x <= 0 || size.z <= 0) return;
      // Scaling uniformly by height alone left the footprint tied to
      // whatever aspect ratio the model happened to have — a tall
      // building would end up far wider than intended, wider than the
      // small collision circle already registered for it in addHouses
      // (which sized itself off p.w/p.d, not the model). Scaling each
      // axis independently to match p.w/p.h/p.d keeps the real model's
      // footprint exactly the one that was actually made solid.
      const scaleX = p.w / size.x;
      const scaleY = p.h / size.y;
      const scaleZ = p.d / size.z;

      m.compose(
        new THREE.Vector3(p.x, 0, p.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rotY, 0)),
        new THREE.Vector3(scaleX, scaleY, scaleZ),
      );
      const piece = geo.clone();
      piece.translate(-center.x, -box.min.y, -center.z);
      piece.applyMatrix4(m);
      pieces.push(piece);
    });

    const merged = mergeGeometries(pieces, false);
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    fallback.visible = false;
  });
}
