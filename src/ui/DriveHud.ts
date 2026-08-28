import { GameState, Terrain } from "../core/GameState";
import { VehicleDef } from "../world/VehicleCatalog";
import { copy } from "../content/copy";
import { el } from "./dom";
import { GearboxUI } from "./GearboxUI";

const ZONE_LABEL: Record<Terrain, string> = { ferme: "FERME", chantier: "CHANTIER", ville: "VILLE" };
const ZONE_COLOR: Record<Terrain, string> = { ferme: "#8fbf4a", chantier: "#e2761b", ville: "#5aa9ff" };

export class DriveHud {
  readonly root: HTMLElement;
  private zoneTag: HTMLElement;
  private vehicleBadge: HTMLElement;
  private arrowL: HTMLElement;
  private arrowR: HTMLElement;
  private speedValue: HTMLElement;
  private cta: HTMLElement;
  private btnLeft: HTMLElement;
  private btnWarn: HTMLElement;
  private btnHead: HTMLElement;
  private btnRight: HTMLElement;
  private controlsRow!: HTMLElement;
  readonly gearbox: GearboxUI;

  constructor(parent: HTMLElement, private state: GameState) {
    this.root = el("div", { className: "tt-hud" });

    const topbar = el("div", { className: "tt-topbar" });
    this.zoneTag = el("span", { className: "tt-zone-tag" });
    this.vehicleBadge = el("div", { className: "tt-mode-badge tt-badge-drive" });
    topbar.append(this.zoneTag, this.vehicleBadge);

    const speedRow = el("div", { className: "tt-speed-row" });
    this.arrowL = el("div", { className: "tt-arrow tt-arrow-left" });
    const pill = el("div", { className: "tt-speed-pill" });
    this.speedValue = el("span", { className: "tt-speed-value", text: "0" });
    pill.append(this.speedValue, el("span", { className: "tt-speed-unit", text: "KM/H" }));
    this.arrowR = el("div", { className: "tt-arrow tt-arrow-right" });
    speedRow.append(this.arrowL, pill, this.arrowR);

    this.cta = el("div", { className: "tt-cta" });
    const ctaLabel = el("span", { text: copy.modeChange.exitVehicle });
    const ctaKey = el("span", { className: "tt-cta-key", text: "F" });
    this.cta.append(ctaLabel, ctaKey);
    this.cta.style.background = "var(--tt-pieton)";
    this.cta.style.color = "#0c1017";
    ctaKey.style.background = "rgba(12,16,23,0.22)";
    ctaKey.style.color = "#0c1017";

    this.controlsRow = el("div", { className: "tt-controls-row" });
    const controls = this.controlsRow;
    this.btnLeft = this.makeControlBtn(copy.ui.left, el("div", { className: "tt-control-icon-blinker" }));
    this.btnWarn = this.makeControlBtn(copy.ui.warnings, this.warningIcon());
    this.btnHead = this.makeControlBtn(copy.ui.headlights, el("div", { className: "tt-control-icon-dot" }));
    this.btnRight = this.makeControlBtn(copy.ui.right, el("div", { className: "tt-control-icon-blinker tt-flip" }));
    controls.append(this.btnLeft, this.btnWarn, this.btnHead, this.btnRight);

    this.btnLeft.addEventListener("click", () => state.setBlinker("left"));
    this.btnRight.addEventListener("click", () => state.setBlinker("right"));
    this.btnWarn.addEventListener("click", () => state.setBlinker("warning"));
    this.btnHead.addEventListener("click", () => (state.headlightsOn = !state.headlightsOn));

    this.root.append(topbar, speedRow, this.cta, controls);
    parent.appendChild(this.root);

    this.gearbox = new GearboxUI(this.root, state);
  }

  private warningIcon(): HTMLElement {
    const wrap = el("div", { attrs: { style: "display:flex;gap:3px;" } });
    wrap.innerHTML =
      '<div style="width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:7px solid currentColor;"></div>' +
      '<div style="width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:7px solid currentColor;"></div>';
    return wrap;
  }

  private makeControlBtn(label: string, icon: HTMLElement): HTMLElement {
    const btn = el("button", { className: "tt-control-btn", attrs: { type: "button" } });
    btn.append(icon, el("span", { text: label.toUpperCase() }));
    return btn;
  }

  updateVehicleLabel(def: VehicleDef) {
    this.vehicleBadge.innerHTML = "";
    this.vehicleBadge.append(el("span", { className: "tt-mode-dot" }), el("span", { text: def.label }));
  }

  update() {
    const zone = this.state.terrain;
    this.zoneTag.textContent = ZONE_LABEL[zone];
    this.zoneTag.style.color = ZONE_COLOR[zone];

    this.speedValue.textContent = String(this.state.speedKmh);
    const left = this.state.blinker === "left" || this.state.blinker === "warning";
    const right = this.state.blinker === "right" || this.state.blinker === "warning";
    this.arrowL.classList.toggle("tt-on", left);
    this.arrowR.classList.toggle("tt-on", right);
    this.btnLeft.classList.toggle("tt-active", this.state.blinker === "left");
    this.btnRight.classList.toggle("tt-active", this.state.blinker === "right");
    this.btnWarn.classList.toggle("tt-active", this.state.blinker === "warning");
    this.btnHead.classList.toggle("tt-active", this.state.headlightsOn);

    this.gearbox.update();

    // Volant branché : le HUD s'allège, les 4 boutons tactiles s'effacent,
    // seuls les témoins de clignotants/phares restent visibles.
    this.controlsRow.classList.toggle("tt-hidden", this.state.wheelConnected);
  }

  setVisible(visible: boolean) {
    this.root.style.display = visible ? "block" : "none";
  }
}
