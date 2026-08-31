import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Group | null>>();

/**
 * Loads a .glb and resolves the scene root — or null on any failure.
 * Never throws: callers keep their procedural placeholder as a safety
 * net when a real asset can't be fetched (offline, missing file, etc.).
 */
export function loadModel(url: string): Promise<THREE.Group | null> {
  let entry = cache.get(url);
  if (!entry) {
    entry = new Promise((resolve) => {
      loader.load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        () => resolve(null),
      );
    });
    cache.set(url, entry);
  }
  return entry.then((scene) => (scene ? scene.clone(true) : null));
}

/**
 * Fire-and-forget: loads a real model, scales it uniformly to match
 * `targetHeight`, sits it on the ground, and hides `proceduralVisual`
 * once it's in — the shared pattern behind every procedural-placeholder
 * swap in this game. If the load fails, the placeholder just stays up.
 */
export function attachRealModelReplacing(container: THREE.Object3D, proceduralVisual: THREE.Object3D, url: string, targetHeight: number) {
  loadModel(url).then((model) => {
    if (!model) return;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.y <= 0) return;
    const scale = targetHeight / size.y;
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    model.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.castShadow = true;
    });
    proceduralVisual.visible = false;
    container.add(model);
  });
}
