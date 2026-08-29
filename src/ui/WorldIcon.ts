import * as THREE from "three";
import { el } from "./dom";
import { icons } from "./icons";

/** A floating circular icon anchored to a 3D point — the shop/vehicle prompts, in-world. */
export class WorldIcon {
  readonly root: HTMLElement;
  private tmp = new THREE.Vector3();

  constructor(parent: HTMLElement, icon: string = icons.arrowInBox) {
    this.root = el("div", { className: "tt-world-icon tt-hidden" });
    this.root.innerHTML = icon;
    parent.appendChild(this.root);
  }

  update(camera: THREE.Camera, worldPosition: THREE.Vector3 | null) {
    if (!worldPosition) {
      this.root.classList.add("tt-hidden");
      return;
    }
    this.tmp.copy(worldPosition).project(camera);
    if (this.tmp.z > 1) {
      this.root.classList.add("tt-hidden");
      return;
    }
    const x = ((this.tmp.x + 1) / 2) * window.innerWidth;
    const y = ((1 - this.tmp.y) / 2) * window.innerHeight;
    this.root.classList.remove("tt-hidden");
    this.root.style.left = `${x}px`;
    this.root.style.top = `${y}px`;
  }
}
