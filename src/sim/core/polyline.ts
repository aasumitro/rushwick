import { clamp, type Vec2 } from './vec2';

export interface PathSample {
  x: number;
  y: number;
  heading: number;
}

export interface Projection {
  s: number;
  /** Signed offset, positive to the left of the travel direction. */
  lateral: number;
  distance: number;
}

/**
 * Arc-length parameterised polyline. Lanes, intersection connectors and the
 * ego route are Polylines; positions along them are expressed as `s` (m).
 */
export class Polyline {
  readonly points: readonly Vec2[];
  /** Cumulative arc length at each point. */
  readonly cum: Float64Array;
  readonly length: number;

  constructor(points: readonly Vec2[]) {
    if (points.length < 2) throw new Error('Polyline needs at least two points');
    this.points = points;
    this.cum = new Float64Array(points.length);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1] as Vec2;
      const b = points[i] as Vec2;
      this.cum[i] = (this.cum[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y);
    }
    this.length = this.cum[points.length - 1] as number;
  }

  /** Index i such that cum[i] <= s < cum[i + 1]. */
  private segmentIndex(s: number): number {
    let lo = 0;
    let hi = this.points.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.cum[mid] as number) <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  sample(s: number): PathSample {
    const sc = clamp(s, 0, this.length);
    const i = this.segmentIndex(sc);
    const a = this.points[i] as Vec2;
    const b = this.points[i + 1] as Vec2;
    const segLen = (this.cum[i + 1] as number) - (this.cum[i] as number);
    const t = segLen > 1e-9 ? (sc - (this.cum[i] as number)) / segLen : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, heading: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  /** Closest point, optionally restricted to the arc-length window [sMin, sMax]. */
  project(p: Vec2, sMin = 0, sMax = this.length): Projection {
    let best: Projection = { s: 0, lateral: 0, distance: Infinity };
    const iEnd = this.segmentIndex(clamp(sMax, 0, this.length));
    for (let i = this.segmentIndex(clamp(sMin, 0, this.length)); i <= iEnd; i++) {
      const a = this.points[i] as Vec2;
      const b = this.points[i + 1] as Vec2;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const l2 = abx * abx + aby * aby;
      const t = l2 > 0 ? clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, 0, 1) : 0;
      const d = Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
      if (d < best.distance) {
        const l = Math.sqrt(l2);
        const lateral = l > 0 ? (abx * (p.y - a.y) - aby * (p.x - a.x)) / l : 0;
        best = { s: (this.cum[i] as number) + t * l, lateral, distance: d };
      }
    }
    return best;
  }
}
