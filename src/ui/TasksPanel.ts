import { GameState } from "../core/GameState";
import { TASKS } from "../content/tasks";
import { el } from "./dom";

/** Petits boulots à réclamer pour de l'argent en jeu — gagné en jouant, pas seulement à la banque. */
export class TasksPanel {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement, private state: GameState) {
    this.root = el("div", { className: "tt-shop-panel tt-tasks-panel tt-hidden" });
    parent.appendChild(this.root);
  }

  get isOpen() {
    return !this.root.classList.contains("tt-hidden");
  }

  open() {
    this.render();
    this.root.classList.remove("tt-hidden");
  }

  close() {
    this.root.classList.add("tt-hidden");
  }

  private render() {
    this.root.innerHTML = "";
    this.root.append(
      el("div", { className: "tt-shop-title", text: "Tâches" }),
      el("div", { className: "tt-shop-sub", text: "Des petits boulots pour gagner quelques dollars en jouant." }),
    );
    for (const task of TASKS) {
      const done = task.check(this.state);
      const claimed = this.state.claimedTaskIds.has(task.id);
      const item = el("div", { className: "tt-task-item" });
      if (done) item.classList.add("tt-task-done");

      const head = el("div", { className: "tt-task-head" });
      head.append(
        el("div", { className: "tt-task-label", text: task.label }),
        el("div", { className: "tt-task-reward", text: `+${task.reward.toLocaleString("fr-FR")} $` }),
      );
      item.append(head, el("div", { className: "tt-task-hint", text: task.hint }));

      if (claimed) {
        item.append(el("div", { className: "tt-task-claimed", text: "✓ Récompense encaissée" }));
      } else if (done) {
        const claim = el("button", { className: "tt-task-claim", text: "Réclamer", attrs: { type: "button" } });
        claim.addEventListener("click", () => {
          this.state.claimTask(task.id, task.label, task.reward);
          this.render();
        });
        item.append(claim);
      } else {
        item.append(el("div", { className: "tt-task-progress", text: task.progress(this.state) }));
      }

      this.root.append(item);
    }
    const close = el("div", { className: "tt-shop-close", text: "Fermer" });
    close.addEventListener("click", () => this.close());
    this.root.append(close);
  }
}
