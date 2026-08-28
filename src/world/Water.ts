import * as THREE from "three";
import { WATER_BOUNDS } from "./Terrain";

export function buildWater(scene: THREE.Scene) {
  const width = WATER_BOUNDS.maxX - WATER_BOUNDS.minX;
  const depth = WATER_BOUNDS.maxZ - WATER_BOUNDS.minZ;
  const geo = new THREE.PlaneGeometry(width, depth, 24, 24);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x37b6f0,
    transparent: true,
    opacity: 0.75,
    roughness: 0.2,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((WATER_BOUNDS.minX + WATER_BOUNDS.maxX) / 2, WATER_BOUNDS.surfaceY, (WATER_BOUNDS.minZ + WATER_BOUNDS.maxZ) / 2);
  scene.add(mesh);

  const start = performance.now();
  return {
    mesh,
    animate() {
      const t = (performance.now() - start) / 1000;
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setZ(i, Math.sin(x * 0.4 + t) * 0.06 + Math.cos(y * 0.5 + t * 0.8) * 0.06);
      }
      pos.needsUpdate = true;
    },
  };
}
