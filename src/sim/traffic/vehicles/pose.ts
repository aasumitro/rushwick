import type { Obb } from '../../core/obb';
import type { PathSample } from '../../core/polyline';
import type { ConnectorSegment } from '../../world/types';
import type { TrafficState } from './trafficState';
import { TUNING } from './tuning';
import type { Vehicle } from './types';

/** Point on the travelled path `back` metres behind the front bumper (may be on the previous segment). */
function pathPointBehind(ts: TrafficState, v: Vehicle, back: number): PathSample {
  const s = v.s - back;
  if (s >= 0 || v.prevSeg < 0) return ts.seg(v.route[0] as number).path.sample(Math.max(0, s));
  const prev = ts.seg(v.prevSeg);
  return prev.path.sample(Math.max(0, prev.path.length + s));
}

/** Smooth (cosine) lateral offset during a lane change and its rate (m/s). */
export function laneChangeOffset(v: Vehicle): { offset: number; rate: number } {
  if (v.laneChangeProgress >= 1) return { offset: 0, rate: 0 };
  const p = v.laneChangeProgress;
  const A = v.laneChangeOffset0;
  return {
    offset: (A * (1 + Math.cos(Math.PI * p))) / 2,
    rate: (-A * Math.PI * Math.sin(Math.PI * p)) / (2 * TUNING.laneChangeTime),
  };
}

/**
 * Body centre rides on the path (on an arc the front-rear chord is parallel
 * to the tangent at the arc midpoint), which keeps long vehicles off the
 * inside curb; heading follows the front-rear chord.
 */
export function updatePose(ts: TrafficState, v: Vehicle): void {
  const front = ts.seg(v.route[0] as number).path.sample(v.s);
  const rear = pathPointBehind(ts, v, v.length);
  const mid = pathPointBehind(ts, v, v.length / 2);
  let { x, y } = mid;
  let heading = Math.atan2(front.y - rear.y, front.x - rear.x);
  if (Math.hypot(front.x - rear.x, front.y - rear.y) < 1e-3) heading = front.heading;
  const lc = laneChangeOffset(v);
  if (lc.offset !== 0) {
    x += -Math.sin(heading) * lc.offset;
    y += Math.cos(heading) * lc.offset;
    heading += Math.atan2(lc.rate, Math.max(v.speed, 1));
  }
  v.x = x;
  v.y = y;
  v.heading = heading;
}

/** Turn-signal state for rendering. */
export function updateIndicator(ts: TrafficState, v: Vehicle): void {
  v.indicator = 0;
  if (v.laneChangeProgress < 1) {
    v.indicator = v.laneChangeOffset0 > 0 ? 1 : -1;
    return;
  }
  const cur = ts.seg(v.route[0] as number);
  let conn: ConnectorSegment | null = null;
  if (cur.kind === 'connector') conn = cur;
  else if (cur.path.length - v.s < 35) conn = ts.seg(v.route[1] as number) as ConnectorSegment;
  if (!conn || conn.turn === 'straight') return;
  const a = ts.seg(conn.fromLane).path.sample(0).heading;
  const b = ts.seg(conn.toLane).path.sample(0).heading;
  v.indicator = Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) > 0 ? -1 : 1;
}

export function vehicleObb(v: Vehicle, shrink = 1): Obb {
  return { x: v.x, y: v.y, heading: v.heading, halfLength: (v.length / 2) * shrink, halfWidth: (v.width / 2) * shrink };
}
