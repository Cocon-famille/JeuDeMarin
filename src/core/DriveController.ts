import { GameState } from "./GameState";
import { InputManager } from "./InputManager";

/** Clignotant : 0,9 s, on/off net, jamais de fondu — géré par Vehicle. Ici, juste les intentions du joueur. */
export class DriveController {
  update(input: InputManager, state: GameState) {
    if (input.justPressed("BracketLeft")) state.setBlinker("left");
    if (input.justPressed("BracketRight")) state.setBlinker("right");
    if (input.justPressed("Backslash")) state.setBlinker("warning");
    if (input.justPressed("KeyL")) state.headlightsOn = !state.headlightsOn;
    if (input.justPressed("KeyB")) state.beaconOn = !state.beaconOn;
  }
}
