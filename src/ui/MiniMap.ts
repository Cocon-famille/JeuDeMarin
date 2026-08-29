import { ZONE_BOUNDS, WATER_BOUNDS } from "../world/Terrain";
import { SHOP_POSITION } from "../world/Shop";
import { World } from "../world/World";
import { el } from "./dom";

const MAP_W = 132;
const MAP_H = 82;
const WORLD_MIN_X = ZONE_BOUNDS.ferme.minX;
const WORLD_W = ZONE_BOUNDS.ville.maxX - ZONE_BOUNDS.ferme.minX;
const WORLD_MIN_Z = -110;
const WORLD_D = 220;

function project(x: number, z: number): [number, number] {
  return [((x - WORLD_MIN_X) / WORLD_W) * MAP_W, ((z - WORLD_MIN_Z) / WORLD_D) * MAP_H];
}

/** Minimap façon sim réaliste : bandes de terrain, lac, boutique, position du joueur. */
export class MiniMap {
  readonly root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(parent: HTMLElement) {
    this.root = el("div", { className: "tt-minimap-wrap" });
    this.canvas = el("canvas", { attrs: { width: String(MAP_W), height: String(MAP_H) } });
    this.root.append(this.canvas);
    parent.appendChild(this.root);
    this.ctx = this.canvas.getContext("2d")!;
  }

  update(world: World) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, MAP_W, MAP_H);

    for (const zone of Object.values(ZONE_BOUNDS)) {
      const [x0] = project(zone.minX, 0);
      const [x1] = project(zone.maxX, 0);
      ctx.fillStyle = `#${zone.color.toString(16).padStart(6, "0")}`;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x0, 0, x1 - x0, MAP_H);
    }
    ctx.globalAlpha = 1;

    const [wx0, wz0] = project(WATER_BOUNDS.minX, WATER_BOUNDS.minZ);
    const [wx1, wz1] = project(WATER_BOUNDS.maxX, WATER_BOUNDS.maxZ);
    ctx.fillStyle = "#37b6f0";
    ctx.fillRect(wx0, wz0, wx1 - wx0, wz1 - wz0);

    this.diamond(project(SHOP_POSITION.x, SHOP_POSITION.z), "#ffc02e");

    const target = world.state.mode === "drive" ? world.vehicle.object : world.walker.object;
    const heading = world.state.mode === "drive" ? world.vehicle.heading : world.walker.heading;
    const [px, py] = project(target.position.x, target.position.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3.5, 4);
    ctx.lineTo(-3.5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private diamond([x, y]: [number, number], color: string) {
    const ctx = this.ctx;
    const r = 3.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
  }
}
