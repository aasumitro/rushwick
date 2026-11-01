import { Polyline } from '../../core/polyline';
import type { City } from '../../world/types';
import { assembleRoute, type RouteSpan, type RouteStop } from './assembly';

/** Concrete drivable reference path for the ego vehicle, with stop lines and speed limits. */
export class Route {
  readonly path: Polyline;
  readonly stops: readonly RouteStop[];
  readonly spans: readonly RouteSpan[];
  readonly length: number;

  constructor(
    readonly city: City,
    readonly segments: readonly number[],
    startS: number,
    endS: number,
  ) {
    const built = assembleRoute(city, segments, startS, endS);
    this.path = new Polyline(built.points);
    this.stops = built.stops;
    this.spans = built.spans;
    this.length = this.path.length;
  }

  spanAt(s: number): RouteSpan {
    for (const sp of this.spans) if (s <= sp.s1) return sp;
    return this.spans[this.spans.length - 1]!;
  }

  speedLimitAt(s: number): number {
    return this.spanAt(s).speedLimit;
  }

  /** First stop line not yet passed (with 0.5 m tolerance). */
  nextStop(s: number): RouteStop | null {
    for (const st of this.stops) if (st.s >= s - 0.5) return st;
    return null;
  }
}
