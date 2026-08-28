import { GameState, Mode } from "../core/GameState";
import { InputManager } from "../core/InputManager";
import { copy } from "../content/copy";
import { el } from "./dom";
import { Joystick } from "./Joystick";

interface WalkHudConfig {
  mode: Extract<Mode, "pedestrian" | "swim">;
  label: string;
  badgeClass: string;
}

/**
 * Le HUD de nage reprend la géométrie exacte du mode piéton — seule la
 * couleur change (§08). D'où une seule implémentation pour les deux.
 */
export class WalkHud {
  readonly root: HTMLElement;
  private infoCard: HTMLElement;
  private infoTitle: HTMLElement;
  private infoSub: HTMLElement;
  private prompt: HTMLElement;
  private promptKey: string | null = null;
  private gaugeRow: HTMLElement;
  private gaugeFill: HTMLElement;
  private gaugeMeta: HTMLElement;
  readonly joystick: Joystick;

  constructor(parent: HTMLElement, private cfg: WalkHudConfig, private state: GameState, private input: InputManager) {
    this.root = el("div", { className: "tt-hud" });

    const topbar = el("div", { className: "tt-topbar", attrs: { style: "justify-content:flex-end;" } });
    const badge = el("div", { className: `tt-mode-badge ${cfg.badgeClass}` });
    badge.append(el("span", { className: "tt-mode-dot" }), el("span", { text: cfg.label }));
    topbar.append(badge);

    this.gaugeRow = el("div", { className: "tt-gauge-row tt-hidden" });
    const gaugeLabel = el("div", { className: "tt-gauge-label" });
    this.gaugeMeta = el("span", { text: "-0 m" });
    gaugeLabel.append(el("span", { text: "SOUFFLE" }), this.gaugeMeta);
    const track = el("div", { className: "tt-gauge-track" });
    this.gaugeFill = el("div", { className: "tt-gauge-fill" });
    track.append(this.gaugeFill);
    this.gaugeRow.append(gaugeLabel, track);

    this.infoCard = el("div", { className: "tt-info-card tt-hidden" });
    this.infoTitle = el("div", { className: "tt-info-title" });
    this.infoSub = el("div", { className: "tt-info-sub" });
    this.infoCard.append(this.infoTitle, this.infoSub);

    this.prompt = el("div", { className: "tt-prompt tt-hidden" });
    this.prompt.addEventListener("click", () => {
      if (this.promptKey) this.input.pressVirtual(`Key${this.promptKey}`);
    });

    const side = el("div", { className: "tt-side-actions" });
    if (cfg.mode === "pedestrian") {
      const run = el("span", { className: "tt-pill", text: copy.ui.run });
      const interact = el("span", { className: "tt-pill", text: copy.ui.interact });
      run.addEventListener("pointerdown", () => (this.input.touchRunning = true));
      run.addEventListener("pointerup", () => (this.input.touchRunning = false));
      run.addEventListener("pointercancel", () => (this.input.touchRunning = false));
      interact.addEventListener("click", () => this.input.pressVirtual("KeyE"));
      side.append(run, interact);
    } else {
      const dive = el("span", { className: "tt-pill", text: copy.ui.dive });
      const surface = el("span", { className: "tt-pill", text: copy.ui.surface });
      dive.addEventListener("pointerdown", () => (this.input.touchDiving = true));
      dive.addEventListener("pointerup", () => (this.input.touchDiving = false));
      dive.addEventListener("pointercancel", () => (this.input.touchDiving = false));
      surface.addEventListener("click", () => (this.input.touchDiving = false));
      side.append(dive, surface);
    }

    this.root.append(topbar, this.gaugeRow, this.infoCard, this.prompt, side);
    parent.appendChild(this.root);

    this.joystick = new Joystick(this.root, input);
  }

  showInfo(title: string, sub: string) {
    this.infoTitle.textContent = title;
    this.infoSub.textContent = sub;
    this.infoCard.classList.remove("tt-hidden");
  }

  hideInfo() {
    this.infoCard.classList.add("tt-hidden");
  }

  setPrompt(text: string | null, key?: string) {
    this.promptKey = key ?? null;
    if (!text) {
      this.prompt.classList.add("tt-hidden");
      return;
    }
    this.prompt.classList.remove("tt-hidden");
    this.prompt.innerHTML = "";
    this.prompt.append(el("span", { text }));
    if (key) this.prompt.append(el("span", { className: "tt-cta-key", text: key, attrs: { style: "background:rgba(244,241,234,0.14);" } }));
  }

  update() {
    if (this.cfg.mode === "swim") {
      this.gaugeRow.classList.remove("tt-hidden");
      this.gaugeFill.style.width = `${Math.round(this.state.breath * 100)}%`;
      this.gaugeMeta.textContent = `−${this.state.depthM} m`;
    }
  }

  setVisible(visible: boolean) {
    this.root.style.display = visible ? "block" : "none";
  }
}
