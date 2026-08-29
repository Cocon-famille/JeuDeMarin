import { GameState } from "../core/GameState";

export interface TaskDef {
  id: string;
  label: string;
  hint: string;
  reward: number;
  check: (state: GameState) => boolean;
  progress: (state: GameState) => string;
}

/** Petits boulots — une fois accomplis, réclamables pour de l'argent en jeu. */
export const TASKS: TaskDef[] = [
  {
    id: "visit-ferme",
    label: "Visite la ferme",
    hint: "Va faire un tour du côté de la ferme.",
    reward: 500,
    check: (s) => s.zonesVisited.has("ferme"),
    progress: (s) => (s.zonesVisited.has("ferme") ? "Fait" : "Pas encore visitée"),
  },
  {
    id: "visit-chantier",
    label: "Visite le chantier",
    hint: "Va faire un tour du côté du chantier.",
    reward: 500,
    check: (s) => s.zonesVisited.has("chantier"),
    progress: (s) => (s.zonesVisited.has("chantier") ? "Fait" : "Pas encore visité"),
  },
  {
    id: "visit-ville",
    label: "Visite la ville",
    hint: "Va faire un tour du côté de la ville.",
    reward: 500,
    check: (s) => s.zonesVisited.has("ville"),
    progress: (s) => (s.zonesVisited.has("ville") ? "Fait" : "Pas encore visitée"),
  },
  {
    id: "first-swim",
    label: "Premier plongeon",
    hint: "Entre dans l'eau, à pied.",
    reward: 1000,
    check: (s) => s.hasSwum,
    progress: (s) => (s.hasSwum ? "Fait" : "Jamais nagé"),
  },
  {
    id: "top-speed",
    label: "Pied au plancher",
    hint: "Atteins 75 km/h.",
    reward: 750,
    check: (s) => s.topSpeedKmh >= 75,
    progress: (s) => `${Math.min(s.topSpeedKmh, 75)} / 75 km/h`,
  },
  {
    id: "road-trip",
    label: "Grand rouleur",
    hint: "Parcours 5 km au total, tous véhicules confondus.",
    reward: 1500,
    check: (s) => s.distanceDrivenKm >= 5,
    progress: (s) => `${Math.min(s.distanceDrivenKm, 5).toFixed(1)} / 5 km`,
  },
];
