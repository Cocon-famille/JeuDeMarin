import { GameState, ToastEvent } from "../core/GameState";
import { el } from "./dom";

/** Message in-game — règle des 5 mots, tutoiement, jamais de jargon. */
export class ToastStack {
  private root: HTMLElement;

  constructor(parent: HTMLElement, state: GameState) {
    this.root = el("div", { className: "tt-toast-stack" });
    parent.appendChild(this.root);
    state.events.on("toast", (e) => this.push(e));
  }

  private push(e: ToastEvent) {
    const node = el("div", { className: "tt-toast" });
    node.append(el("div", { text: e.title }));
    if (e.sub) node.append(el("div", { className: "tt-toast-sub", text: e.sub }));
    this.root.appendChild(node);
    setTimeout(() => node.classList.add("tt-fade-out"), 2400);
    setTimeout(() => node.remove(), 2800);
  }
}
