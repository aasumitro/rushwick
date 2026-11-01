import type { Obb } from './obb';
import { toLocal } from './vec2';

/** Ray vs axis-aligned box (slab method): entry distance along the unit ray, or Infinity. */
export function rayAabb(ox: number, oy: number, dx: number, dy: number, minX: number, minY: number, maxX: number, maxY: number): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  const slab = (o: number, d: number, lo: number, hi: number): boolean => {
    if (Math.abs(d) < 1e-12) return o >= lo && o <= hi;
    const t1 = (lo - o) / d;
    const t2 = (hi - o) / d;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
    return true;
  };
  if (!slab(ox, dx, minX, maxX) || !slab(oy, dy, minY, maxY)) return Infinity;
  if (tmax < Math.max(tmin, 0)) return Infinity;
  return tmin >= 0 ? tmin : 0;
}

export function rayObb(ox: number, oy: number, dx: number, dy: number, b: Obb): number {
  const o = toLocal(ox, oy, b.x, b.y, b.heading);
  const c = Math.cos(b.heading);
  const s = Math.sin(b.heading);
  return rayAabb(o.x, o.y, dx * c + dy * s, -dx * s + dy * c, -b.halfLength, -b.halfWidth, b.halfLength, b.halfWidth);
}

export function rayCircle(ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, r: number): number {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : Infinity;
}
