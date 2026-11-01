import { cubicBezier } from '../../core/bezier';
import { Polyline } from '../../core/polyline';
import { add, dist, scale, type Vec2 } from '../../core/vec2';
import { DIR_VEC, type ConnectorSegment, type Dir, type Intersection, type LaneSegment, type TurnType } from '../types';
import type { GenContext } from './context';

const TURN_LAT_ACCEL = 2.5;
/** Control-point factor that makes a cubic Bézier approximate a quarter circle. */
const BEZIER_K = 0.5523;
const TURN_SAMPLE_SPACING = 0.5;

/** Path through the junction from the end of one lane to the start of another. */
function connectorPath(from: LaneSegment, to: LaneSegment, turn: TurnType): { points: Vec2[]; radius: number } {
  const p0 = from.path.points[from.path.points.length - 1] as Vec2;
  const p3 = to.path.points[0] as Vec2;
  const d0 = DIR_VEC[from.dir]!;
  const d1 = DIR_VEC[to.dir]!;
  if (turn === 'straight') {
    const L = dist(p0, p3);
    const lateral = Math.abs((p3.x - p0.x) * d0.y - (p3.y - p0.y) * d0.x);
    if (lateral < 0.05) return { points: [p0, p3], radius: Infinity };
    return { points: cubicBezier(p0, add(p0, scale(d0, L / 3)), add(p3, scale(d1, -L / 3)), p3, 12), radius: Infinity };
  }
  // Corner = intersection of the incoming and outgoing tangent lines.
  const c: Vec2 = d0.x !== 0 ? { x: p3.x, y: p0.y } : { x: p0.x, y: p3.y };
  const r0 = dist(p0, c);
  const r1 = dist(p3, c);
  // Dense sampling (~0.5 m) so curvature estimated from nearby points is smooth, not vertex spikes.
  const segments = Math.max(14, Math.ceil(((r0 + r1) * Math.PI) / 4 / TURN_SAMPLE_SPACING));
  const points = cubicBezier(p0, add(p0, scale(d0, r0 * BEZIER_K)), add(p3, scale(d1, -r1 * BEZIER_K)), p3, segments);
  return { points, radius: Math.min(r0, r1) };
}

export function makeConnector(
  ctx: GenContext,
  node: Intersection,
  move: { from: number; to: number; approach: Dir; exit: Dir; turn: TurnType },
): ConnectorSegment {
  const from = ctx.segments[move.from] as LaneSegment;
  const to = ctx.segments[move.to] as LaneSegment;
  const { points, radius } = connectorPath(from, to, move.turn);
  let speed = Math.min(from.speedLimit, to.speedLimit);
  if (move.turn !== 'straight') speed = Math.min(speed, Math.sqrt(TURN_LAT_ACCEL * radius));
  const conn: ConnectorSegment = {
    id: ctx.segments.length,
    kind: 'connector',
    path: new Polyline(points),
    speedLimit: speed,
    next: [to.id],
    prev: [from.id],
    nodeId: node.id,
    fromLane: from.id,
    toLane: to.id,
    turn: move.turn,
    approachArm: move.approach,
    exitArm: move.exit,
    conflicts: [],
    wideConflicts: [],
    siblings: [],
    crosswalks: [],
    stage: -1,
    yieldTo: [],
  };
  ctx.segments.push(conn);
  from.next.push(conn.id);
  to.prev.push(conn.id);
  node.connectors.push(conn.id);
  return conn;
}
