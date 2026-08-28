import { GameState, GearboxMode } from "./GameState";
import { InputManager } from "./InputManager";

const MODES: GearboxMode[] = ["auto", "manual-sequential", "manual-h"];
const H_GRID_KEYS: Record<string, number | "R"> = {
  Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit6: 6, Digit0: "R",
};

/** Auto par défaut ; passer en manuel est un choix de joueur (touche G), jamais un prérequis. */
export class GearboxController {
  constructor(private state: GameState) {}

  update(input: InputManager) {
    if (input.justPressed("KeyG")) {
      const idx = MODES.indexOf(this.state.gearboxMode);
      this.state.setGearboxMode(MODES[(idx + 1) % MODES.length]);
    }

    if (this.state.gearboxMode === "manual-sequential") {
      if (input.justPressed("KeyA")) this.state.shift(1);
      if (input.justPressed("KeyQ")) this.state.shift(-1);
    }

    if (this.state.gearboxMode === "manual-h") {
      for (const [code, gear] of Object.entries(H_GRID_KEYS)) {
        if (input.justPressed(code)) this.state.setGear(gear);
      }
    }
  }
}
