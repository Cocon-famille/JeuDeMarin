import { Terrain } from "../core/GameState";
import { copy } from "../content/copy";
import { el } from "./dom";
import { makeLogoBadge } from "./Logo";

const TERRAIN_TAGS: { id: Terrain; label: string; cls: string }[] = [
  { id: "ferme", label: copy.ui.farm, cls: "tt-tag-ferme" },
  { id: "chantier", label: copy.ui.site, cls: "tt-tag-chantier" },
  { id: "ville", label: copy.ui.city, cls: "tt-tag-ville" },
];

const NAME_KEY = "tractopolis.playerName";
const PLATE_KEY = "tractopolis.plate";

function readStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // stockage indisponible (navigation privée, etc.) — tant pis, pas bloquant
  }
}

export class TitleScreen {
  readonly root: HTMLElement;
  private selected: Terrain = "ferme";

  constructor(parent: HTMLElement, onPlay: (terrain: Terrain, name: string, plate: string) => void) {
    this.root = el("div", { className: "tt-screen" });
    this.root.append(el("div", { className: "tt-screen-grid" }), el("div", { className: "tt-screen-glow" }));

    const brandRow = el("div", { attrs: { style: "position:relative;display:flex;align-items:center;gap:12px;" } });
    brandRow.append(makeLogoBadge(48));
    const logo = el("div", { className: "tt-title-logo" });
    logo.innerHTML = `TRACTO<span style="color:var(--tt-gyrophare);">POLIS</span>`;
    brandRow.append(logo);

    const baseline = el("div", { className: "tt-title-baseline", text: copy.brand.baseline });

    const fields = el("div", { className: "tt-title-fields" });
    const nameInput = el("input", { className: "tt-field", attrs: { type: "text", placeholder: "Ton nom", maxlength: "18" } }) as HTMLInputElement;
    const plateInput = el("input", { className: "tt-field", attrs: { type: "text", placeholder: "Ta plaque (ex: TRACTO-01)", maxlength: "12" } }) as HTMLInputElement;
    nameInput.value = readStored(NAME_KEY);
    plateInput.value = readStored(PLATE_KEY);
    fields.append(nameInput, plateInput);

    const actions = el("div", { className: "tt-title-actions" });
    const play = el("div", { className: "tt-btn-primary", text: copy.ui.play.toUpperCase() });
    const choose = el("div", { className: "tt-btn-secondary", text: copy.ui.chooseTerrain });
    actions.append(play, choose);

    const tags = el("div", { className: "tt-title-tags" });
    const tagEls = TERRAIN_TAGS.map((t) => {
      const tag = el("span", { className: `tt-tag ${t.cls}`, text: t.label.toUpperCase() });
      if (t.id === this.selected) tag.classList.add("tt-selected");
      tag.addEventListener("click", () => {
        this.selected = t.id;
        tagEls.forEach((el2, i) => el2.classList.toggle("tt-selected", TERRAIN_TAGS[i].id === t.id));
      });
      return tag;
    });
    tags.append(...tagEls);

    play.addEventListener("click", () => {
      const name = nameInput.value.trim();
      const plate = plateInput.value.trim();
      writeStored(NAME_KEY, name);
      writeStored(PLATE_KEY, plate);
      onPlay(this.selected, name, plate);
    });
    choose.addEventListener("click", () => tags.scrollIntoView({ behavior: "smooth" }));

    this.root.append(brandRow, baseline, fields, actions, tags);
    parent.appendChild(this.root);
  }

  hide() {
    this.root.classList.add("tt-fade-out");
    setTimeout(() => this.root.remove(), 400);
  }
}
