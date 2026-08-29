export type VehicleKind = "voiture" | "tracteur" | "camion" | "remorque" | "rouleau" | "pelleteuse" | "moissonneuse";

export interface VehicleDef {
  id: string;
  kind: VehicleKind;
  label: string;
  color: number;
  /** Terrain the piece is thematically at home in — flavor only, drivable anywhere. */
  home: "ferme" | "chantier" | "ville";
  /** $ jeu — 0 pour le véhicule de départ, déjà "possédé". */
  price: number;
}

export const VEHICLE_CATALOG: VehicleDef[] = [
  { id: "citadine", kind: "voiture", label: "Citadine", color: 0x5aa9ff, home: "ville", price: 0 },
  { id: "pickup", kind: "voiture", label: "Pick-up", color: 0xe2761b, home: "chantier", price: 2000 },
  { id: "tracteur-ferme", kind: "tracteur", label: "Tracteur", color: 0x8fbf4a, home: "ferme", price: 5000 },
  { id: "camion-benne", kind: "camion", label: "Camion benne", color: 0xe2761b, home: "chantier", price: 8000 },
  { id: "camion-plateau", kind: "camion", label: "Camion plateau", color: 0x2a3345, home: "ville", price: 8000 },
  { id: "remorque-basse", kind: "remorque", label: "Remorque basse", color: 0x6b7686, home: "chantier", price: 3000 },
  { id: "remorque-betaille", kind: "remorque", label: "Remorque à bétail", color: 0xb7a06a, home: "ferme", price: 3000 },
  { id: "rouleau-compresseur", kind: "rouleau", label: "Rouleau compresseur", color: 0xffc02e, home: "chantier", price: 10000 },
  { id: "pelleteuse", kind: "pelleteuse", label: "Pelleteuse", color: 0xe2761b, home: "chantier", price: 15000 },
  { id: "moissonneuse-batteuse", kind: "moissonneuse", label: "Moissonneuse-batteuse", color: 0xe2761b, home: "ferme", price: 20000 },
];
