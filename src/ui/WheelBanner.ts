import { WheelManager, CalibrationStep } from "../core/WheelManager";
import { copy } from "../content/copy";
import { el } from "./dom";

const STEP_LABELS = [copy.wheel.stepTurn, copy.wheel.stepGas, copy.wheel.stepBrake];

export class WheelBannerUI {
  private banner: HTMLElement;
  private calibration: HTMLElement;
  private steps: { row: HTMLElement; fill: HTMLElement }[] = [];
  private hideAt = 0;

  constructor(parent: HTMLElement, private wheel: WheelManager) {
    this.banner = el("div", { className: "tt-wheel-banner tt-hidden" });
    const icon = el("div", { className: "tt-wheel-icon" });
    const text = el("div");
    text.append(
      el("div", { className: "tt-wheel-title", text: copy.wheel.detected }),
      el("div", { className: "tt-wheel-sub", text: copy.wheel.detectedSub }),
    );
    this.banner.append(icon, text);
    parent.appendChild(this.banner);

    this.calibration = el("div", { className: "tt-calibration tt-hidden" });
    STEP_LABELS.forEach((label, i) => {
      const row = el("div", { className: "tt-cal-step" });
      const num = el("span", { className: "tt-cal-num", text: String(i + 1) });
      const body = el("div", { className: "tt-cal-label" });
      body.append(el("div", { text: label }));
      const track = el("div", { className: "tt-cal-track" });
      const fill = el("div", { className: "tt-cal-fill" });
      track.append(fill);
      body.append(track);
      row.append(num, body);
      this.calibration.append(row);
      this.steps.push({ row, fill });
    });
    parent.appendChild(this.calibration);
  }

  showDetected() {
    this.banner.classList.remove("tt-hidden");
    this.hideAt = performance.now() + 3000;
    this.calibration.classList.remove("tt-hidden");
  }

  update() {
    if (this.hideAt && performance.now() > this.hideAt) {
      this.banner.classList.add("tt-hidden");
      this.hideAt = 0;
    }
    if (!this.wheel.isCalibrating) {
      if (!this.hideAt) this.calibration.classList.add("tt-hidden");
      return;
    }
    const active = this.wheel.calibrationStep as CalibrationStep;
    this.steps.forEach((s, i) => {
      s.row.classList.toggle("tt-active", i === active);
      s.fill.style.width = i < active ? "100%" : i === active ? "0%" : "0%";
    });
  }

  setStepProgress(step: CalibrationStep, progress: number) {
    this.steps[step]?.fill.style.setProperty("width", `${Math.round(progress * 100)}%`);
  }

  hideCalibration() {
    setTimeout(() => this.calibration.classList.add("tt-hidden"), 900);
  }
}
