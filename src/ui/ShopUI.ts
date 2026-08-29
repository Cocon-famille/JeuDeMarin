import { GameState } from "../core/GameState";
import { VEHICLE_CATALOG, VehicleDef } from "../world/VehicleCatalog";
import { el } from "./dom";

export class ShopUI {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement, private state: GameState, private onPick: (def: VehicleDef) => void) {
    this.root = el("div", { className: "tt-shop-panel tt-hidden" });
    parent.appendChild(this.root);
  }

  open(currentId: string) {
    this.render(currentId);
    this.root.classList.remove("tt-hidden");
  }

  private render(currentId: string) {
    this.root.innerHTML = "";
    this.root.append(
      el("div", { className: "tt-shop-title", text: "Vitrine des engins" }),
      el("div", { className: "tt-shop-sub", text: `Solde : ${this.state.money.toLocaleString("fr-FR")} $` }),
    );
    for (const def of VEHICLE_CATALOG) {
      const owned = this.state.owns(def.id, def.price);
      const affordable = owned || this.state.money >= def.price;
      const item = el("button", { className: "tt-shop-item", attrs: { type: "button" } });
      if (def.id === currentId) item.classList.add("tt-current");
      if (!affordable) item.style.opacity = "0.55";
      const swatch = el("div", { className: "tt-shop-item-swatch" });
      swatch.style.background = `#${def.color.toString(16).padStart(6, "0")}`;
      const text = el("div", { attrs: { style: "flex:1;" } });
      text.append(el("div", { className: "tt-shop-item-label", text: def.label }), el("div", { className: "tt-shop-item-kind", text: def.kind }));
      const price = el("div", {
        className: "tt-shop-item-kind",
        text: owned ? "Possédé" : `${def.price.toLocaleString("fr-FR")} $`,
      });
      price.style.color = owned ? "#7ce38b" : affordable ? "#ffc02e" : "#ff8a8a";
      item.append(swatch, text, price);
      item.addEventListener("click", () => {
        if (!this.state.purchase(def.id, def.label, def.price)) return;
        this.onPick(def);
        this.render(def.id);
      });
      this.root.append(item);
    }
    this.root.append(el("div", { className: "tt-shop-close", text: "Fermer — E ou Échap" }));
  }

  close() {
    this.root.classList.add("tt-hidden");
  }

  get isOpen() {
    return !this.root.classList.contains("tt-hidden");
  }
}
