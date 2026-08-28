/**
 * Keyboard + touch input. Arrow keys are reserved for movement so they
 * never collide with the lettered feature keys (gearbox, blinkers, mode).
 * A virtual joystick (touch/mouse) drives the same throttle/steer axes —
 * whichever source is active wins, so keyboard testing still works.
 */
export class InputManager {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private virtualPressed = new Set<string>();

  touchThrottle = 0;
  touchSteer = 0;
  touchRunning = false;
  touchDiving = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (!this.down.has(e.code)) this.pressedThisFrame.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True only on the frame the key transitioned from up to down. Call once per frame per key. */
  justPressed(code: string): boolean {
    return this.pressedThisFrame.has(code) || this.virtualPressed.has(code);
  }

  /** Lets a touch button fake a one-frame key press (e.g. the exit/enter CTA). */
  pressVirtual(code: string) {
    this.virtualPressed.add(code);
  }

  endFrame() {
    this.pressedThisFrame.clear();
    this.virtualPressed.clear();
  }

  get throttle(): number {
    const kb = (this.isDown("ArrowUp") ? 1 : 0) - (this.isDown("ArrowDown") ? 1 : 0);
    return kb !== 0 ? kb : this.touchThrottle;
  }

  get steer(): number {
    const kb = (this.isDown("ArrowRight") ? 1 : 0) - (this.isDown("ArrowLeft") ? 1 : 0);
    return kb !== 0 ? kb : this.touchSteer;
  }

  get running(): boolean {
    return this.isDown("ShiftLeft") || this.isDown("ShiftRight") || this.touchRunning;
  }
}
