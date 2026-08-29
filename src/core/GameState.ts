import { EventBus } from "./EventBus";
import { copy } from "../content/copy";
import { loadProfile, saveProfile } from "../lib/tractopolisProfile";

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

  // Tableau de bord façon sim réaliste — décoratif pour l'argent/saison,
  // réel pour l'essence (consommée par Vehicle, rechargée à la boutique).
  fuel = 1; // 0..1
  private fuelWarned = false;
  clockMinutes = 8 * 60; // 08:00 au démarrage
  money: number;
  season = "Sep";

  // Véhicules achetés à la boutique — persistés pour ne pas perdre un
  // achat au rechargement de la page. Un prix à 0 est toujours "possédé".
  ownedVehicleIds: Set<string>;

  // Statistiques suivies pour les tâches (petits boulots à réclamer).
  distanceDrivenKm = 0;
  topSpeedKmh = 0;
  hasSwum = false;
  zonesVisited: Set<Terrain> = new Set();
  claimedTaskIds: Set<string>;

  // Le profil cloud (Supabase, par nom) ne doit pas être écrasé par les
  // valeurs locales par défaut avant d'avoir tenté de le charger.
  private profileHydrated = false;

  constructor() {
    this.money = readStoredNumber("tractopolis.money", 91294);
    this.ownedVehicleIds = new Set(readStoredJson<string[]>("tractopolis.owned", []));
    this.claimedTaskIds = new Set(readStoredJson<string[]>("tractopolis.tasksClaimed", []));
  }

  /** À appeler une fois le nom du joueur connu (écran titre), avant de démarrer la partie. */
  async hydrateProfile(): Promise<void> {
    try {
      if (this.playerName.trim()) {
        const remote = await loadProfile(this.playerName);
        if (remote) {
          this.plate = remote.plate || this.plate;
          this.money = remote.money;
          this.ownedVehicleIds = new Set(remote.ownedVehicleIds);
          this.claimedTaskIds = new Set(remote.claimedTaskIds);
          writeStoredNumber("tractopolis.money", this.money);
          writeStoredJson("tractopolis.owned", remote.ownedVehicleIds);
          writeStoredJson("tractopolis.tasksClaimed", remote.claimedTaskIds);
        }
      }
    } catch {
      // Pas de réseau, ou profil pas encore créé — on continue avec le local.
    } finally {
      this.profileHydrated = true;
    }
  }

  visitZone(t: Terrain) {
    this.zonesVisited.add(t);
  }

  /** Réclame la récompense d'une tâche déjà accomplie. Une seule fois par tâche. */
  claimTask(id: string, label: string, reward: number): boolean {
    if (this.claimedTaskIds.has(id)) return false;
    this.claimedTaskIds.add(id);
    writeStoredJson("tractopolis.tasksClaimed", Array.from(this.claimedTaskIds));
    this.credit(reward);
    this.toast("Tâche accomplie", `${label} — +${reward.toLocaleString("fr-FR")} $`);
    return true;
  }

  private persistWallet() {
    writeStoredNumber("tractopolis.money", this.money);
    writeStoredJson("tractopolis.owned", Array.from(this.ownedVehicleIds));
    this.syncToCloud();
  }

  /** Sauvegarde best-effort vers le profil Supabase — jamais bloquant, jamais d'erreur remontée. */
  private syncToCloud() {
    if (!this.profileHydrated || !this.playerName.trim()) return;
    saveProfile(this.playerName, {
      plate: this.plate,
      money: this.money,
      ownedVehicleIds: Array.from(this.ownedVehicleIds),
      claimedTaskIds: Array.from(this.claimedTaskIds),
    }).catch(() => {
      // Hors-ligne ou Supabase indisponible — le localStorage reste la source de vérité locale.
    });
  }

  owns(vehicleId: string, price: number): boolean {
    return price === 0 || this.ownedVehicleIds.has(vehicleId);
  }

  /** Retourne false (et prévient) si l'achat n'est pas possible faute d'argent. */
  purchase(vehicleId: string, label: string, price: number): boolean {
    if (this.owns(vehicleId, price)) return true;
    if (this.money < price) {
      this.toast("Pas assez d'argent", `Il manque ${(price - this.money).toLocaleString("fr-FR")} $.`);
      return false;
    }
    this.money -= price;
    this.ownedVehicleIds.add(vehicleId);
    this.persistWallet();
    this.toast("Achat confirmé", `${label} — ${price.toLocaleString("fr-FR")} $`);
    return true;
  }

  credit(amount: number) {
    this.money += amount;
    this.persistWallet();
  }

  refuel() {
    this.fuel = 1;
    this.fuelWarned = false;
    this.toast("Plein d'essence", "Le réservoir est plein.");
  }

  checkFuelWarning() {
    if (this.fuel <= 0.15 && !this.fuelWarned) {
      this.fuelWarned = true;
      this.toast("Réservoir presque vide", "Direction la pompe la plus proche.");
    }
  }

  tick(dt: number) {
    // 1 seconde réelle = 1 minute in-game — une journée dure 24 min.
    this.clockMinutes = (this.clockMinutes + dt * 60) % 1440;
  }

  get clockLabel(): string {
    const h = Math.floor(this.clockMinutes / 60);
    const m = Math.floor(this.clockMinutes % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

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
      this.hasSwum = true;
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

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}
function writeStoredNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // stockage indisponible — tant pis
  }
}
function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStoredJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible — tant pis
  }
}
