import * as THREE from "three";

export const SHOP_POSITION = new THREE.Vector3(40, 0, -60);
export const SHOP_RADIUS = 6;
export const PARKING_SPOT = new THREE.Vector3(40, 0, -50);

/** Un kiosque simple : la vitrine où on choisit l'engin, jamais où on paie. */
export function buildShop(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.position.copy(SHOP_POSITION);

  const postMat = new THREE.MeshStandardMaterial({ color: 0x2a3345, roughness: 0.7 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xffc02e, roughness: 0.5 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0x171d28, roughness: 0.6 });

  const positions: [number, number][] = [
    [-4, -3], [4, -3], [-4, 3], [4, 3],
  ];
  for (const [x, z] of positions) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4, 8), postMat);
    post.position.set(x, 2, z);
    post.castShadow = true;
    group.add(post);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 7), roofMat);
  roof.position.y = 4.1;
  roof.castShadow = true;
  group.add(roof);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 0.15), signMat);
  sign.position.set(0, 4.9, -3.2);
  group.add(sign);

  scene.add(group);
  return group;
}

export function isNearShop(x: number, z: number): boolean {
  const dx = x - SHOP_POSITION.x;
  const dz = z - SHOP_POSITION.z;
  return Math.sqrt(dx * dx + dz * dz) <= SHOP_RADIUS;
}
