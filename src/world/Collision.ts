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
    if (pushOutOfCircle(pos, radius, o.x, o.z, o.radius)) blocked = true;
  }
  return blocked;
}

/**
 * Same push-out-of-a-circle math as resolveCollision, but for a single
 * one-off obstacle that isn't in the static registry — e.g. the player's
 * own parked vehicle/trailer, which moves and so can't be pre-registered.
 */
export function resolveAgainst(pos: THREE.Vector3, radius: number, x: number, z: number, obstacleRadius: number): boolean {
  return pushOutOfCircle(pos, radius, x, z, obstacleRadius);
}

function pushOutOfCircle(pos: THREE.Vector3, radius: number, x: number, z: number, obstacleRadius: number): boolean {
  const dx = pos.x - x;
  const dz = pos.z - z;
  const minDist = obstacleRadius + radius;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return false;
  // Dead center of the obstacle (dx=dz=0) has no defined push direction —
  // pick an arbitrary one rather than silently doing nothing.
  const dist = Math.sqrt(distSq);
  const nx = dist > 1e-6 ? dx / dist : 1;
  const nz = dist > 1e-6 ? dz / dist : 0;
  const push = minDist - dist;
  pos.x += nx * push;
  pos.z += nz * push;
  return true;
}
