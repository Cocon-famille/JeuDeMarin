import { GameState } from "./core/GameState";
import { World } from "./world/World";
import { GameHud } from "./ui/GameHud";
import { TitleScreen } from "./ui/TitleScreen";
import { LoadingScreen } from "./ui/LoadingScreen";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const hudRoot = document.getElementById("hud-root")!;
const screenRoot = document.getElementById("screen-root")!;

const state = new GameState();

const title = new TitleScreen(screenRoot, async (terrain, name, plate) => {
  state.playerName = name;
  state.plate = plate;
  title.hide();
  const loading = new LoadingScreen(screenRoot);
  await Promise.all([loading.run(800), state.hydrateProfile()]);

  const world = new World(canvas, state);
  world.spawnAt(terrain);
  const hud = new GameHud(hudRoot, world);
  if (name) state.toast(`Salut ${name} !`, "Ta plaque est posée sur le pare-chocs.");

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (!hud.shopOpen) world.update(dt);
    else world.rig.render();
    hud.update();
    world.input.endFrame();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
