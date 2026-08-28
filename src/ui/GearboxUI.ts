import { GameState } from "../core/GameState";
import { el } from "./dom";

const GRID_LAYOUT: (number | "R" | null)[] = [1, 3, 5, null, 2, 4, 6, "R"];

export class GearboxUI {
  private cellValue: HTMLElement;
  private cellTag: HTMLElement;
  private grid: HTMLElement;
  private gridButtons = new Map<number | "R", HTMLButtonElement>();
  private lastChange = 0;

  constructor(parent: HTMLElement, private state: GameState) {
    const row = el("div", { className: "tt-gear-row" });
    const cell = el("div", { className: "tt-gear-cell" });
    this.cellValue = el("div", { className: "tt-gear-value" });
    this.cellTag = el("div", { className: "tt-gear-tag" });
    cell.append(this.cellValue, this.cellTag);
    row.append(cell);
    parent.appendChild(row);

    this.grid = el("div", { className: "tt-hgrid" });
    for (const g of GRID_LAYOUT) {
      if (g === null) {
        this.grid.append(el("div"));
        continue;
      }
      const btn = el("button", { text: String(g), attrs: { type: "button" } });
      if (g === "R") btn.classList.add("tt-r");
      btn.addEventListener("click", () => this.state.setGear(g));
      this.gridButtons.set(g, btn);
      this.grid.append(btn);
    }
    parent.appendChild(this.grid);

    state.events.on("gear", () => (this.lastChange = performance.now()));
  }

  update() {
    const { gearboxMode, gearAuto } = this.state;
    this.cellValue.textContent = String(gearAuto);
    this.cellValue.classList.toggle("tt-reverse", gearAuto === "R");
    this.cellValue.classList.toggle("tt-forward", typeof gearAuto === "number");
    this.cellTag.textContent = gearboxMode === "auto" ? "AUTO" : gearboxMode === "manual-sequential" ? "SÉQUENTIEL" : "GRILLE H";

    const showGrid = gearboxMode === "manual-h";
    this.grid.style.display = showGrid ? "grid" : "none";
    if (showGrid) {
      this.gridButtons.forEach((btn, g) => btn.classList.toggle("tt-engaged", gearAuto === g));
      const idle = performance.now() - this.lastChange > 4000;
      this.grid.style.opacity = idle ? "0.4" : "1";
    }
  }
}
