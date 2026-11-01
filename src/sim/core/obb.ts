import { toLocal, type Vec2 } from './vec2';

/** Oriented bounding box (centre, heading, half extents). */
export interface Obb {
  x: number;
  y: number;
  heading: number;
  halfLength: number;
  halfWidth: number;
}

export function obbCorners(b: Obb): Vec2[] {
  const c = Math.cos(b.heading);
  const s = Math.sin(b.heading);
  const fx = c * b.halfLength;
  const fy = s * b.halfLength;
  const lx = -s * b.halfWidth;
  const ly = c * b.halfWidth;
  return [
    { x: b.x + fx + lx, y: b.y + fy + ly },
    { x: b.x + fx - lx, y: b.y + fy - ly },
    { x: b.x - fx - lx, y: b.y - fy - ly },
    { x: b.x - fx + lx, y: b.y - fy + ly },
  ];
}

function radiusOnAxis(b: Obb, ux: number, uy: number): number {
  const c = Math.cos(b.heading);
  const s = Math.sin(b.heading);
  return b.halfLength * Math.abs(c * ux + s * uy) + b.halfWidth * Math.abs(-s * ux + c * uy);
}

/** Separating-axis overlap test. */
export function obbOverlap(a: Obb, b: Obb): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const reach = Math.hypot(a.halfLength, a.halfWidth) + Math.hypot(b.halfLength, b.halfWidth);
  if (dx * dx + dy * dy > reach * reach) return false;
  for (const ang of [a.heading, a.heading + Math.PI / 2, b.heading, b.heading + Math.PI / 2]) {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    if (Math.abs(dx * ux + dy * uy) > radiusOnAxis(a, ux, uy) + radiusOnAxis(b, ux, uy)) return false;
  }
  return true;
}

/** Distance from a point to the box (0 inside). */
export function pointObbDistance(px: number, py: number, b: Obb): number {
  const p = toLocal(px, py, b.x, b.y, b.heading);
  return Math.hypot(Math.max(Math.abs(p.x) - b.halfLength, 0), Math.max(Math.abs(p.y) - b.halfWidth, 0));
}

export const inflateObb = (b: Obb, margin: number): Obb => ({
  ...b,
  halfLength: b.halfLength + margin,
  halfWidth: b.halfWidth + margin,
});
