/**
 * 2D vectors in the simulation frame: x = east, y = north, headings CCW from
 * +x in radians. The renderer maps (x, y) -> (x, 0, -y).
 */
export interface Vec2 {
  x: number;
  y: number;
}

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Wrap an angle into [-PI, PI]. */
export function wrapAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= 2 * Math.PI;
  while (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

/** Unit normal pointing to the left of the direction a -> b. */
export function leftNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: -dy / l, y: dx / l };
}

/** Express world point p in the local frame of a pose (forward = +x, left = +y). */
export function toLocal(px: number, py: number, ox: number, oy: number, heading: number): Vec2 {
  const dx = px - ox;
  const dy = py - oy;
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}
