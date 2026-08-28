import { EventBus } from "./EventBus";
import { copy } from "../content/copy";

export type Mode = "drive" | "pedestrian" | "swim";
export type Terrain = "ferme" | "chantier" | "ville";
export type GearboxMode = "auto" | "manual-sequential" | "manual-h";
export type Blinker = "off" | "left" | "right" | "warning";

export interface ToastEvent {
  title: string;
  sub?: string;
}

interface StateEvents {
  mode: { mode: Mode; previous: Mode };
  toast: ToastEvent;
  gear: { gear: number | "R" | "D"; mode: GearboxMode };
  wheelConnected: { connected: boolean };
}

/**
 * Single source of truth for the game. Only one mode signal is ever
 * active at a time (amber = engin, green = à pied, bleu = nage) —
 * enforced here rather than left to each HUD to coordinate.
 */
export class GameState {
  readonly events = new EventBus<StateEvents>();

  mode: Mode = "drive";
  terrain: Terrain = "ferme";

  // Vehicle signals
  blinker: Blinker = "off";
  headlightsOn = false;
  beaconOn = false;
  speedKmh = 0;

  // Gearbox — auto by default, manual is an opt-in tap, never a prerequisite.
  gearboxMode: GearboxMode = "auto";
  gearAuto: number | "D" | "R" = "D";

  // Swim
  breath = 1; // 0..1
  depthM = 0;

  // Wheel / pedals
  wheelConnected = false;

  // Personnalisation
  playerName = "";
  plate = "";

  setMode(next: Mode) {
    if (next === this.mode) return;
    const previous = this.mode;
    this.mode = next;
    this.events.emit("mode", { mode: next, previous });
    if (next === "pedestrian" && previous === "drive") {
      this.toast(copy.modeChange.pedestrianOn);
    } else if (next === "drive" && previous === "pedestrian") {
      this.toast(copy.modeChange.backInVehicle);
    } else if (next === "swim") {
      this.toast(copy.swim.swimOn, copy.swim.takeABreath);
    } else if (previous === "swim" && next === "pedestrian") {
      this.toast(copy.swim.exitWater);
    }
  }

  toast(title: string, sub?: string) {
    this.events.emit("toast", { title, sub });
  }

  setBlinker(next: Blinker) {
    this.blinker = this.blinker === next ? "off" : next;
  }

  setGearboxMode(mode: GearboxMode) {
    this.gearboxMode = mode;
    if (mode === "auto") this.gearAuto = "D";
    this.toast(copy.gearbox.manualOn);
    this.events.emit("gear", { gear: this.gearAuto, mode });
  }

  shift(delta: 1 | -1) {
    if (this.gearboxMode === "auto") return;
    const current = typeof this.gearAuto === "number" ? this.gearAuto : delta > 0 ? 1 : 0;
    const next = Math.max(0, Math.min(6, current + delta));
    this.gearAuto = next === 0 ? "R" : next;
    this.events.emit("gear", { gear: this.gearAuto, mode: this.gearboxMode });
    if (this.gearAuto === "R") this.toast(copy.gearbox.reverse);
    else this.toast(copy.gearbox.engaged(this.gearAuto));
  }

  setGear(n: number | "R") {
    if (this.gearboxMode !== "manual-h") return;
    this.gearAuto = n;
    this.events.emit("gear", { gear: n, mode: this.gearboxMode });
    if (n === "R") this.toast(copy.gearbox.reverse);
    else this.toast(copy.gearbox.engaged(n));
  }

  setWheelConnected(connected: boolean) {
    if (this.wheelConnected === connected) return;
    this.wheelConnected = connected;
    this.events.emit("wheelConnected", { connected });
  }
}
