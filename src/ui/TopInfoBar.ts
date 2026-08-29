import { GameState } from "../core/GameState";
import { el } from "./dom";
import { icons } from "./icons";

export interface TopInfoBarActions {
  onHelp: () => void;
  onMap: () => void;
  onShop: () => void;
  onMenu: () => void;
  onMoney: () => void;
}

/** Barre du haut façon tableau de bord de sim réaliste : date/heure/argent/essence + accès rapides. */
export class TopInfoBar {
  readonly root: HTMLElement;
  private fuelChip: HTMLElement;
  private fuelText: HTMLElement;
  private clockText: HTMLElement;
  private moneyText: HTMLElement;

  constructor(parent: HTMLElement, private state: GameState, actions: TopInfoBarActions) {
    this.root = el("div", { className: "tt-topinfo" });

    const chips = el("div", { className: "tt-info-chips" });
    chips.append(el("span", { className: "tt-info-chip", html: `${icons.calendar}${state.season}` }));
    this.clockText = el("span", { text: state.clockLabel });
    chips.append(this.wrapChip(icons.clock, this.clockText));
    this.moneyText = el("span", { text: state.money.toLocaleString("fr-FR") });
    const moneyChip = this.wrapChip(icons.coin, this.moneyText);
    moneyChip.style.cursor = "pointer";
    moneyChip.addEventListener("click", actions.onMoney);
    chips.append(moneyChip);
    this.fuelText = el("span", { text: "100%" });
    this.fuelChip = this.wrapChip(icons.fuel, this.fuelText);
    chips.append(this.fuelChip);

    const iconRow = el("div", { className: "tt-icon-row" });
    const help = this.iconButton(icons.help);
    const map = this.iconButton(icons.pin);
    const shop = this.iconButton(icons.basket);
    const menu = this.iconButton(icons.menu);
    help.addEventListener("click", actions.onHelp);
    map.addEventListener("click", actions.onMap);
    shop.addEventListener("click", actions.onShop);
    menu.addEventListener("click", actions.onMenu);
    iconRow.append(help, map, shop, menu);

    this.root.append(chips, iconRow);
    parent.appendChild(this.root);
  }

  private wrapChip(icon: string, valueEl: HTMLElement): HTMLElement {
    const chip = el("span", { className: "tt-info-chip" });
    chip.innerHTML = icon;
    chip.append(valueEl);
    return chip;
  }

  private iconButton(icon: string): HTMLButtonElement {
    const btn = el("button", { className: "tt-icon-btn", attrs: { type: "button" } });
    btn.innerHTML = icon;
    return btn;
  }

  update() {
    this.clockText.textContent = this.state.clockLabel;
    this.moneyText.textContent = this.state.money.toLocaleString("fr-FR");
    const pct = Math.round(this.state.fuel * 100);
    this.fuelText.textContent = `${pct}%`;
    this.fuelChip.classList.toggle("tt-fuel-low", this.state.fuel <= 0.15);
  }
}
