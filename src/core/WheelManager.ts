import { GameState } from "./GameState";
import { copy } from "../content/copy";

const DEADZONE = 0.08;

export type CalibrationStep = 0 | 1 | 2; // tourne | accélérateur | frein
export interface WheelManagerEvents {
  onDetected?: () => void;
  onCalibrationStep?: (step: CalibrationStep, progress: number) => void;
  onCalibrated?: () => void;
}

/**
 * Support silencieux : le matériel est détecté à l'usage, jamais réclamé.
 * Le clavier reste la référence — débrancher ne met jamais le jeu en pause.
 */
export class WheelManager {
  private state: GameState;
  private hooks: WheelManagerEvents;

  private gamepadIndex: number | null = null;
  private baseline: number[] = [];
  private movementSeen = false;

  private calibrating = false;
  private step: CalibrationStep = 0;
  private stepProgress = 0; // 0..1 within the current step
  private axisRange = new Map<number, { min: number; max: number }>();
  private steeringAxis = 0;
  private throttleAxis: number | null = null;
  private brakeAxis: number | null = null;
  private calibrated = false;

  steeringValue = 0;
  throttleValue = 0;
  brakeValue = 0;

  constructor(state: GameState, hooks: WheelManagerEvents = {}) {
    this.state = state;
    this.hooks = hooks;
    window.addEventListener("gamepadconnected", (e) => this.onConnect(e));
    window.addEventListener("gamepaddisconnected", (e) => this.onDisconnect(e));
  }

  private onConnect(e: GamepadEvent) {
    this.gamepadIndex = e.gamepad.index;
    this.baseline = [...e.gamepad.axes];
    this.movementSeen = false;
  }

  private onDisconnect(e: GamepadEvent) {
    if (e.gamepad.index !== this.gamepadIndex) return;
    this.gamepadIndex = null;
    this.calibrating = false;
    this.calibrated = false;
    this.state.setWheelConnected(false);
    this.state.toast(copy.wheel.backToKeyboard);
  }

  private currentPad(): Gamepad | null {
    if (this.gamepadIndex === null) return null;
    return navigator.getGamepads()[this.gamepadIndex] ?? null;
  }

  /** Call once per frame. */
  update() {
    const pad = this.currentPad();
    if (!pad) return;

    if (!this.movementSeen) {
      const moved = pad.axes.some((v, i) => Math.abs(v - (this.baseline[i] ?? 0)) > DEADZONE);
      if (moved) {
        this.movementSeen = true;
        this.state.setWheelConnected(true);
        this.calibrating = true;
        this.step = 0;
        this.stepProgress = 0;
        this.axisRange.clear();
        this.hooks.onDetected?.();
      }
      return;
    }

    if (this.calibrating) {
      this.runCalibrationStep(pad);
      return;
    }

    if (this.calibrated) {
      this.steeringValue = this.applyDeadzone(pad.axes[this.steeringAxis] ?? 0);
      this.throttleValue = this.pedalValue(pad, this.throttleAxis);
      this.brakeValue = this.pedalValue(pad, this.brakeAxis);
    }
  }

  private applyDeadzone(v: number) {
    return Math.abs(v) < DEADZONE ? 0 : v;
  }

  private pedalValue(pad: Gamepad, axis: number | null): number {
    if (axis === null) return 0;
    // Pedal axes commonly rest at -1 and travel to +1; normalize to 0..1.
    const raw = pad.axes[axis] ?? -1;
    return Math.max(0, Math.min(1, (raw + 1) / 2));
  }

  private trackRange(axisIndex: number, value: number) {
    const r = this.axisRange.get(axisIndex) ?? { min: value, max: value };
    r.min = Math.min(r.min, value);
    r.max = Math.max(r.max, value);
    this.axisRange.set(axisIndex, r);
  }

  private runCalibrationStep(pad: Gamepad) {
    pad.axes.forEach((v, i) => this.trackRange(i, v));

    if (this.step === 0) {
      // Étape 1 — tourne à gauche puis à droite : la roue avec la plus
      // grande amplitude symétrique autour de 0 est le volant.
      let best = 0;
      let bestSpan = 0;
      this.axisRange.forEach((r, i) => {
        const span = r.max - r.min;
        if (span > bestSpan) { bestSpan = span; best = i; }
      });
      this.steeringAxis = best;
      this.stepProgress = Math.min(1, bestSpan / 1.5);
      if (this.stepProgress >= 1) this.advanceStep();
    } else if (this.step === 1) {
      // Étape 2 — écrase l'accélérateur : l'axe (hors volant) qui bouge le plus.
      const candidate = this.bestNonSteeringAxis([this.steeringAxis]);
      if (candidate !== null) {
        this.throttleAxis = candidate.axis;
        this.stepProgress = candidate.span / 2;
        if (this.stepProgress >= 1) this.advanceStep();
      }
    } else if (this.step === 2) {
      // Étape 3 — puis le frein : le prochain axe le plus mobile.
      const exclude = [this.steeringAxis, ...(this.throttleAxis !== null ? [this.throttleAxis] : [])];
      const candidate = this.bestNonSteeringAxis(exclude);
      if (candidate !== null) {
        this.brakeAxis = candidate.axis;
        this.stepProgress = candidate.span / 2;
        if (this.stepProgress >= 1) this.finishCalibration();
      }
    }
    this.hooks.onCalibrationStep?.(this.step, Math.max(0, Math.min(1, this.stepProgress)));
  }

  private bestNonSteeringAxis(exclude: number[]): { axis: number; span: number } | null {
    let best: { axis: number; span: number } | null = null;
    this.axisRange.forEach((r, i) => {
      if (exclude.includes(i)) return;
      const span = r.max - r.min;
      if (!best || span > best.span) best = { axis: i, span };
    });
    return best;
  }

  private advanceStep() {
    this.step = (this.step + 1) as CalibrationStep;
    this.stepProgress = 0;
    this.axisRange.clear();
  }

  private finishCalibration() {
    this.calibrating = false;
    this.calibrated = true;
    this.state.toast(copy.wheel.calibrated);
    this.hooks.onCalibrated?.();
  }

  get isCalibrating() {
    return this.calibrating;
  }
  get calibrationStep() {
    return this.step;
  }
}
