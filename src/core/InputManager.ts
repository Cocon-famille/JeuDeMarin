/**
 * Keyboard input. Arrow keys are reserved for movement so they never
 * collide with the lettered feature keys (gearbox, blinkers, mode).
 */
export class InputManager {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();

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
    return this.pressedThisFrame.has(code);
  }

  endFrame() {
    this.pressedThisFrame.clear();
  }

  get throttle(): number {
    return (this.isDown("ArrowUp") ? 1 : 0) - (this.isDown("ArrowDown") ? 1 : 0);
  }

  get steer(): number {
    return (this.isDown("ArrowRight") ? 1 : 0) - (this.isDown("ArrowLeft") ? 1 : 0);
  }

  get running(): boolean {
    return this.isDown("ShiftLeft") || this.isDown("ShiftRight");
  }
}
