import { copy } from "../content/copy";
import { el } from "./dom";

export class LoadingScreen {
  readonly root: HTMLElement;
  private fill: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el("div", { className: "tt-screen", attrs: { style: "justify-content:flex-end;" } });
    this.root.append(
      el("div", { className: "tt-loading-title", text: copy.ui.loadingTitle.toUpperCase() }),
      el("div", { className: "tt-loading-tip", text: copy.ui.loadingTip }),
    );
    const track = el("div", { className: "tt-loading-track" });
    this.fill = el("div", { className: "tt-loading-fill" });
    track.append(this.fill);
    this.root.append(track);
    parent.appendChild(this.root);
  }

  async run(minMs = 700): Promise<void> {
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / minMs);
        this.fill.style.width = `${Math.round(t * 100)}%`;
        if (t < 1) requestAnimationFrame(tick);
        else {
          this.root.classList.add("tt-fade-out");
          setTimeout(() => {
            this.root.remove();
            resolve();
          }, 400);
        }
      };
      requestAnimationFrame(tick);
    });
  }
}
