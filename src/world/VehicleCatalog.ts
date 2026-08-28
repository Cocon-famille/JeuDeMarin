export type VehicleKind = "voiture" | "tracteur" | "camion" | "remorque" | "rouleau" | "pelleteuse";

export interface VehicleDef {
  id: string;
  kind: VehicleKind;
  label: string;
  color: number;
  /** Terrain the piece is thematically at home in — flavor only, drivable anywhere. */
  home: "ferme" | "chantier" | "ville";
}

// Pas d'économie, pas de prix : on choisit, on monte. (Fonctionnalités à
// venir §11 exclut explicitement toute gestion complexe.)
export const VEHICLE_CATALOG: VehicleDef[] = [
  { id: "citadine", kind: "voiture", label: "Citadine", color: 0x5aa9ff, home: "ville" },
  { id: "pickup", kind: "voiture", label: "Pick-up", color: 0xe2761b, home: "chantier" },
  { id: "tracteur-ferme", kind: "tracteur", label: "Tracteur", color: 0x8fbf4a, home: "ferme" },
  { id: "camion-benne", kind: "camion", label: "Camion benne", color: 0xe2761b, home: "chantier" },
  { id: "camion-plateau", kind: "camion", label: "Camion plateau", color: 0x2a3345, home: "ville" },
  { id: "remorque-basse", kind: "remorque", label: "Remorque basse", color: 0x6b7686, home: "chantier" },
  { id: "remorque-betaille", kind: "remorque", label: "Remorque à bétail", color: 0xb7a06a, home: "ferme" },
  { id: "rouleau-compresseur", kind: "rouleau", label: "Rouleau compresseur", color: 0xffc02e, home: "chantier" },
  { id: "pelleteuse", kind: "pelleteuse", label: "Pelleteuse", color: 0xe2761b, home: "chantier" },
];
