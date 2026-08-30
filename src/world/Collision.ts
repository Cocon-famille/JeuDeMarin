import * as THREE from "three";

interface Obstacle {
  x: number;
  z: number;
  radius: number;
}

const obstacles: Obstacle[] = [];

/** Registers a circular footprint (house, crate, building…) that blocks movement. */
export function registerObstacle(x: number, z: number, radius: number) {
  obstacles.push({ x, z, radius });
}

/**
 * Pushes `pos` back out of any obstacle it now overlaps, given the mover's
 * own radius. Approximates every obstacle as a circle — plenty for arcade
 * driving/walking, and cheap enough to check against hundreds of them
 * every frame with a flat scan (no spatial index needed at this scale).
 * Returns true if a push happened, so callers can kill their speed too.
 */
export function resolveCollision(pos: THREE.Vector3, radius: number): boolean {
  let blocked = false;
  for (const o of obstacles) {
    const dx = pos.x - o.x;
    const dz = pos.z - o.z;
    const minDist = o.radius + radius;
    const distSq = dx * dx + dz * dz;
    if (distSq >= minDist * minDist) continue;
    const dist = Math.sqrt(distSq) || 0.001;
    const push = minDist - dist;
    pos.x += (dx / dist) * push;
    pos.z += (dz / dist) * push;
    blocked = true;
  }
  return blocked;
}
