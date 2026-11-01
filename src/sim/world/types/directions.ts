import type { Vec2 } from '../../core/vec2';

/** Arm directions of a grid intersection. */
export type Dir = 0 | 1 | 2 | 3;
export const Dir = { N: 0, E: 1, S: 2, W: 3 } as const;
export const DIRS: readonly Dir[] = [Dir.N, Dir.E, Dir.S, Dir.W];
export const DIR_VEC: readonly Vec2[] = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
];
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const isVertical = (d: Dir): boolean => d === Dir.N || d === Dir.S;

export type DrivingSide = 'left' | 'right';

/**
 * Turn class relative to the driving side. "near" does not cross opposing
 * traffic (right turn in right-hand traffic, left turn in left-hand traffic
 * such as Indonesia); "far" crosses opposing traffic.
 */
export type TurnType = 'straight' | 'near' | 'far';

/** Unit normal pointing to the driving side of travel direction u. */
export function drivingSideNormal(u: Vec2, side: DrivingSide): Vec2 {
  return side === 'right' ? { x: u.y, y: -u.x } : { x: -u.y, y: u.x };
}
