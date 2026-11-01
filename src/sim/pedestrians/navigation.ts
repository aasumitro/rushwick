import { clamp, leftNormal } from '../core/vec2';
import { beginJaywalkWait, maybePlanJaywalk } from './jaywalk';
import { edgeAt, nodePos, type PedWorld } from './pedWorld';
import type { Pedestrian } from './types';

/** Walk along a sidewalk edge towards `toNode`, keeping the personal lateral offset. */
export function followEdge(w: PedWorld, p: Pedestrian, edgeId: number, toNode: number, allowJaywalk: boolean): void {
  const e = edgeAt(w, edgeId);
  const a = nodePos(w, e.a === toNode ? e.b : e.a);
  const b = nodePos(w, toNode);
  const n = leftNormal(a, b);
  p.edge = edgeId;
  p.toNode = toNode;
  p.target = { x: b.x + n.x * p.offset, y: b.y + n.y * p.offset };
  p.jaywalkAt = null;
  if (!allowJaywalk) return;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const along = len > 0 ? ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len) : 0;
  maybePlanJaywalk(w, p, e, clamp(along, 0, 1));
}

/** At a corner: pick the next edge at random (not straight back); crosswalks mean waiting first. */
export function chooseNext(w: PedWorld, p: Pedestrian): void {
  const node = w.city.pedNodes[p.toNode]!;
  let options = node.edges.filter((id) => id !== p.edge);
  if (options.length === 0) options = node.edges;
  const weights = options.map((id) => (edgeAt(w, id).kind === 'crosswalk' ? 1 : 1.3));
  const next = edgeAt(w, options[w.rng.weightedIndex(weights)] as number);
  const other = next.a === p.toNode ? next.b : next.a;
  if (next.kind === 'crosswalk') {
    const from = nodePos(w, p.toNode);
    const to = nodePos(w, other);
    const n = leftNormal(from, to);
    const off = clamp(p.offset, -0.8, 0.8);
    p.edge = next.id;
    p.crossing = {
      kind: 'crosswalk',
      crosswalkId: next.crosswalkId,
      from: { x: p.x, y: p.y },
      to: { x: to.x + n.x * off, y: to.y + n.y * off },
      thenEdge: -1,
      thenNode: -1,
    };
    p.toNode = other;
    p.state = 'wait';
    p.waitTime = 0;
    return;
  }
  followEdge(w, p, next.id, other, true);
  if (w.rng.chance(0.04)) {
    p.state = 'idle';
    p.idleTime = w.rng.range(2, 9);
  }
}

/** Reached the current target point. */
export function arrive(w: PedWorld, p: Pedestrian): void {
  if (p.state === 'cross') {
    const c = p.crossing!;
    p.state = 'walk';
    p.onRoad = false;
    p.crossing = null;
    if (c.kind === 'jaywalk') followEdge(w, p, c.thenEdge, c.thenNode, false);
    else chooseNext(w, p);
    return;
  }
  if (p.jaywalkAt && p.target === p.jaywalkAt) beginJaywalkWait(w, p);
  else chooseNext(w, p);
}
