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
