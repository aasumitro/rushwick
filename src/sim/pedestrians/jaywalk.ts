import { projectOnSegment } from '../core/segment';
import { leftNormal } from '../core/vec2';
import type { PedEdge } from '../world/types';
import { edgeAt, nodePos, type PedWorld } from './pedWorld';
import type { Pedestrian } from './types';

/** Possibly pick a mid-block point (still ahead on edge `e`) where this pedestrian will jaywalk. */
export function maybePlanJaywalk(w: PedWorld, ped: Pedestrian, e: PedEdge, fromFraction: number): void {
  ped.jaywalkAt = null;
  if (e.roadId < 0 || e.oppositeEdge < 0 || e.length < 40) return;
  if (!w.rng.chance(w.jaywalkProbability)) return;
  const f = w.rng.range(0.3, 0.7);
  if (f <= fromFraction + 0.05) return; // fractions are measured from the start node
  const pa = nodePos(w, ped.toNode === e.b ? e.a : e.b);
  const pb = nodePos(w, ped.toNode);
  const n = leftNormal(pa, pb);
  ped.jaywalkAt = { x: pa.x + (pb.x - pa.x) * f + n.x * ped.offset, y: pa.y + (pb.y - pa.y) * f + n.y * ped.offset };
  ped.target = ped.jaywalkAt;
}

/** Arrived at the jaywalk point: wait at the curb for a gap to the opposite sidewalk. */
export function beginJaywalkWait(w: PedWorld, p: Pedestrian): void {
  const opp = edgeAt(w, edgeAt(w, p.edge).oppositeEdge);
  const to = projectOnSegment({ x: p.x, y: p.y }, nodePos(w, opp.a), nodePos(w, opp.b), 0.05, 0.95);
  const thenNode = w.rng.chance(0.5) ? opp.a : opp.b;
  p.jaywalkAt = null;
  p.crossing = { kind: 'jaywalk', crosswalkId: -1, from: { x: p.x, y: p.y }, to, thenEdge: opp.id, thenNode };
  p.state = 'wait';
  p.waitTime = 0;
}
