import { cubicBezier } from '../../core/bezier';
import { clamp, type Vec2 } from '../../core/vec2';
import type { City, ConnectorSegment, Segment } from '../../world/types';

const LANE_CHANGE_LENGTH = 26;

export interface RouteStop {
  /** Arc length of the stop line along the route. */
  s: number;
  connector: number;
  nodeId: number;
}

export interface RouteSpan {
  s0: number;
  s1: number;
  segment: number;
  speedLimit: number;
}

export interface AssembledRoute {
  points: Vec2[];
  stops: RouteStop[];
  spans: RouteSpan[];
}

/** Collects de-duplicated points while tracking cumulative arc length. */
class PointSink {
  readonly points: Vec2[] = [];
  length = 0;

  push(p: Vec2): void {
    const last = this.points[this.points.length - 1];
    if (last) {
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d < 0.05) return;
      this.length += d;
    }
    this.points.push(p);
  }

  /** Points of `seg` between arc lengths a..b (lanes are straight; connectors densely sampled). */
  pushRange(seg: Segment, a: number, b: number): void {
    this.push(seg.path.sample(a));
    for (let k = 1; k < seg.path.points.length - 1; k++) {
      const sk = seg.path.cum[k]!;
      if (sk > a && sk < b) this.push(seg.path.points[k]!);
    }
    this.push(seg.path.sample(b));
  }
}

/** Where a lane change on `seg` starts (entering at sCursor) and how long it takes. */
function laneChangeWindow(seg: Segment, sCursor: number): { start: number; length: number } {
  const lo = sCursor + 2;
  const hi = seg.path.length - 12 - LANE_CHANGE_LENGTH;
  if (hi < lo) return { start: lo, length: Math.max(10, seg.path.length - 8 - lo) };
  return { start: clamp((sCursor + seg.path.length) / 2 - LANE_CHANGE_LENGTH / 2, lo, hi), length: LANE_CHANGE_LENGTH };
}

/** Turn a planned segment sequence into a smooth drivable reference path. */
export function assembleRoute(city: City, segments: readonly number[], startS: number, endS: number): AssembledRoute {
  const sink = new PointSink();
  const stops: RouteStop[] = [];
  const spans: RouteSpan[] = [];
  let sCursor = startS;
  segments.forEach((id, i) => {
    const seg = city.segments[id] as Segment;
    const nextId = segments[i + 1];
    const next = nextId !== undefined ? (city.segments[nextId] as Segment) : null;
    const spanStart = sink.length;
    const span = () => spans.push({ s0: spanStart, s1: sink.length, segment: seg.id, speedLimit: seg.speedLimit });
    if (next && seg.kind === 'lane' && next.kind === 'lane') {
      const lc = laneChangeWindow(seg, sCursor);
      sink.pushRange(seg, sCursor, lc.start);
      const a = seg.path.sample(lc.start);
      const b = next.path.sample(lc.start + lc.length);
      const h = { x: Math.cos(a.heading) * lc.length * 0.4, y: Math.sin(a.heading) * lc.length * 0.4 };
      for (const p of cubicBezier(a, { x: a.x + h.x, y: a.y + h.y }, { x: b.x - h.x, y: b.y - h.y }, b, 10)) sink.push(p);
      span();
      sCursor = lc.start + lc.length;
      return;
    }
    const isLast = i === segments.length - 1;
    sink.pushRange(seg, sCursor, isLast ? Math.min(Math.max(endS, sCursor + 1), seg.path.length) : seg.path.length);
    span();
    if (seg.kind === 'lane' && next?.kind === 'connector') {
      stops.push({ s: sink.length, connector: next.id, nodeId: (next as ConnectorSegment).nodeId });
    }
    sCursor = 0;
  });
  if (sink.points.length < 2) sink.points.push({ x: sink.points[0]!.x + 0.1, y: sink.points[0]!.y });
  return { points: sink.points, stops, spans };
}
