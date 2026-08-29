import * as THREE from "three";
import { GameState } from "../core/GameState";
import { InputManager } from "../core/InputManager";
import { VehicleKind } from "./VehicleCatalog";

export type FieldStage = "empty" | "tilled" | "growing" | "ready";

interface FieldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const FIELD_LAYOUT: FieldBounds[] = [
  { minX: -165, maxX: -75, minZ: -90, maxZ: -40 },
  { minX: -165, maxX: -75, minZ: -20, maxZ: 30 },
  { minX: -165, maxX: -75, minZ: 50, maxZ: 100 },
];

const TILL_SECONDS = 1.5; // temps passé dans le champ, tracteur, pour le labourer
const GROW_SECONDS = 45; // du semis à la maturité
const HARVEST_REWARD = 900;

const STAGE_COLOR: Record<FieldStage, number> = {
  empty: 0x7a5a3a,
  tilled: 0x4a3826,
  growing: 0x8fbf4a,
  ready: 0xe8c94a,
};

class Field {
  stage: FieldStage = "empty";
  tillProgress = 0;
  growProgress = 0;
  readonly mesh: THREE.Mesh;

  constructor(readonly bounds: FieldBounds, scene: THREE.Scene) {
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const geo = new THREE.PlaneGeometry(width, depth);
    const mat = new THREE.MeshStandardMaterial({ color: STAGE_COLOR.empty, roughness: 1 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(bounds.minX + width / 2, 0.01, bounds.minZ + depth / 2);
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  contains(x: number, z: number): boolean {
    return x >= this.bounds.minX && x <= this.bounds.maxX && z >= this.bounds.minZ && z <= this.bounds.maxZ;
  }

  private setStage(stage: FieldStage) {
    this.stage = stage;
    (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(STAGE_COLOR[stage]);
  }

  till(dt: number): boolean {
    this.tillProgress += dt;
    if (this.tillProgress < TILL_SECONDS) return false;
    this.setStage("tilled");
    return true;
  }

  sow() {
    this.growProgress = 0;
    this.setStage("growing");
  }

  grow(dt: number): boolean {
    this.growProgress += dt;
    if (this.growProgress < GROW_SECONDS) return false;
    this.setStage("ready");
    return true;
  }

  harvest() {
    this.tillProgress = 0;
    this.setStage("empty");
  }
}

/**
 * Cycle labourer → semer → attendre → moissonner. Un seul geste par étape :
 * le tracteur laboure juste en roulant dessus, sème sur E, la moissonneuse
 * récolte sur E. Pas de gestion fine (irrigation, saisons) — hors périmètre.
 */
export class Farm {
  private fields: Field[];
  /** Champ sous le véhicule actif, s'il y en a un — pour le prompt HUD. */
  activeField: Field | null = null;

  constructor(scene: THREE.Scene) {
    this.fields = FIELD_LAYOUT.map((bounds) => new Field(bounds, scene));
  }

  update(dt: number, vehiclePos: THREE.Vector3, vehicleKind: VehicleKind, input: InputManager, state: GameState) {
    for (const field of this.fields) {
      if (field.stage === "growing") field.grow(dt);
    }

    this.activeField = this.fields.find((f) => f.contains(vehiclePos.x, vehiclePos.z)) ?? null;
    if (!this.activeField) return;
    const field = this.activeField;

    if (field.stage === "empty" && vehicleKind === "tracteur") {
      if (field.till(dt)) state.toast("Champ labouré", "Prêt pour les semis.");
    } else if (field.stage === "tilled" && vehicleKind === "tracteur" && input.justPressed("KeyE")) {
      field.sow();
      state.toast("Champ semé", "Ça pousse — repasse plus tard.");
    } else if (field.stage === "ready" && vehicleKind === "moissonneuse" && input.justPressed("KeyE")) {
      field.harvest();
      state.credit(HARVEST_REWARD);
      state.toast("Récolte vendue", `+${HARVEST_REWARD.toLocaleString("fr-FR")} $`);
    }
  }

  /** Texte + touche à afficher dans le HUD pour le champ actif, s'il y a une action possible. */
  prompt(vehicleKind: VehicleKind): { text: string; key?: string } | null {
    const field = this.activeField;
    if (!field) return null;
    if (field.stage === "empty" && vehicleKind === "tracteur") return { text: "Labourage en cours…" };
    if (field.stage === "tilled" && vehicleKind === "tracteur") return { text: "Semer", key: "E" };
    if (field.stage === "growing") return { text: "Ça pousse encore" };
    if (field.stage === "ready" && vehicleKind === "moissonneuse") return { text: "Moissonner", key: "E" };
    if (field.stage === "ready") return { text: "Prêt pour la moissonneuse-batteuse" };
    return null;
  }
}
