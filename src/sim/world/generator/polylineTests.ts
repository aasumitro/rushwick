import { aabbContains, segmentDistance, type Aabb } from '../../core/segment';
import type { Vec2 } from '../../core/vec2';

/** Minimum distance between two polylines. */
export function polylineDistance(a: readonly Vec2[], b: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      best = Math.min(best, segmentDistance(a[i] as Vec2, a[i + 1] as Vec2, b[j] as Vec2, b[j + 1] as Vec2));
      if (best === 0) return 0;
    }
  }
  return best;
}

/** True when the polyline passes through the box expanded by `margin` (sampled test). */
export function polylineHitsAabb(points: readonly Vec2[], box: Aabb, margin: number): boolean {
  const ex: Aabb = { minX: box.minX - margin, minY: box.minY - margin, maxX: box.maxX + margin, maxY: box.maxY + margin };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Vec2;
    const b = points[i + 1] as Vec2;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      if (aabbContains(ex, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return true;
    }
  }
  return false;
}
