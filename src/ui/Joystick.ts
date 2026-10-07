import { InputManager } from "../core/InputManager";
import { el } from "./dom";

const RADIUS = 46; // matches .tt-stick's 92px diameter

/** Drag anywhere on the pad: dx steers, -dy throttles. Same gesture for driving and walking. */
export class Joystick {
  readonly root: HTMLElement;
  private nub: HTMLElement;
  private activeId: number | null = null;
  private originX = 0;
  private originY = 0;

  constructor(parent: HTMLElement, private input: InputManager) {
    this.root = el("div", { className: "tt-stick" });
    this.nub = el("div", { className: "tt-stick-nub" });
    this.root.append(this.nub);
    parent.appendChild(this.root);

    this.root.style.touchAction = "none";
    this.root.addEventListener("pointerdown", (e) => this.start(e));
    window.addEventListener("pointermove", (e) => this.move(e));
    window.addEventListener("pointerup", (e) => this.end(e));
    window.addEventListener("pointercancel", (e) => this.end(e));
    // A dropped pointerup (app switch, notification, screen lock mid-drag —
    // all common on mobile) would otherwise leave touchThrottle/touchSteer
    // stuck at their last value forever, with the vehicle accelerating on
    // its own and no way to stop short of grabbing the stick again. Same
    // safety net InputManager already has for the keyboard (window "blur").
    window.addEventListener("blur", () => this.forceRelease());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.forceRelease();
    });
  }

  private forceRelease() {
    if (this.activeId === null) return;
    this.activeId = null;
    this.nub.style.transform = "translate(0, 0)";
    this.input.touchSteer = 0;
    this.input.touchThrottle = 0;
  }

  private start(e: PointerEvent) {
    if (this.activeId !== null) return;
    this.activeId = e.pointerId;
    // Keep receiving this pointer's events even once the finger drifts over
    // a HUD toast or button layered on top — without this, the drag can
    // get silently orphaned there and never deliver the pointerup that
    // would zero the throttle back out.
    this.root.setPointerCapture(e.pointerId);
    const rect = this.root.getBoundingClientRect();
    this.originX = rect.left + rect.width / 2;
    this.originY = rect.top + rect.height / 2;
    this.move(e);
  }

  private move(e: PointerEvent) {
    if (e.pointerId !== this.activeId) return;
    let dx = e.clientX - this.originX;
    let dy = e.clientY - this.originY;
    const dist = Math.hypot(dx, dy);
    if (dist > RADIUS) {
      dx = (dx / dist) * RADIUS;
      dy = (dy / dist) * RADIUS;
    }
    this.nub.style.transform = `translate(${dx}px, ${dy}px)`;
    this.input.touchSteer = dx / RADIUS;
    this.input.touchThrottle = -dy / RADIUS;
  }

  private end(e: PointerEvent) {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    this.nub.style.transform = "translate(0, 0)";
    this.input.touchSteer = 0;
    this.input.touchThrottle = 0;
  }

  setVisible(visible: boolean) {
    if (!visible) this.forceRelease();
    this.root.style.display = visible ? "flex" : "none";
  }
}
