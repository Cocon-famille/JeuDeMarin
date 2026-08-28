import { VEHICLE_CATALOG, VehicleDef } from "../world/VehicleCatalog";
import { el } from "./dom";

export class ShopUI {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement, private onPick: (def: VehicleDef) => void) {
    this.root = el("div", { className: "tt-shop-panel tt-hidden" });
    parent.appendChild(this.root);
  }

  open(currentId: string) {
    this.root.innerHTML = "";
    this.root.append(
      el("div", { className: "tt-shop-title", text: "Vitrine des engins" }),
      el("div", { className: "tt-shop-sub", text: "Choisis, monte, roule. Rien à payer." }),
    );
    for (const def of VEHICLE_CATALOG) {
      const item = el("button", { className: "tt-shop-item", attrs: { type: "button" } });
      if (def.id === currentId) item.classList.add("tt-current");
      const swatch = el("div", { className: "tt-shop-item-swatch" });
      swatch.style.background = `#${def.color.toString(16).padStart(6, "0")}`;
      const text = el("div");
      text.append(el("div", { className: "tt-shop-item-label", text: def.label }), el("div", { className: "tt-shop-item-kind", text: def.kind }));
      item.append(swatch, text);
      item.addEventListener("click", () => this.onPick(def));
      this.root.append(item);
    }
    this.root.append(el("div", { className: "tt-shop-close", text: "Fermer — E ou Échap" }));
    this.root.classList.remove("tt-hidden");
  }

  close() {
    this.root.classList.add("tt-hidden");
  }

  get isOpen() {
    return !this.root.classList.contains("tt-hidden");
  }
}
