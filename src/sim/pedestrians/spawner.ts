import { leftNormal } from '../core/vec2';
import type { PedEdge } from '../world/types';
import { drawTraits } from './appearance';
import { maybePlanJaywalk } from './jaywalk';
import { nodePos, type PedWorld } from './pedWorld';
import type { Pedestrian } from './types';

/** Scatter pedestrians over sidewalks (weighted by length), walking in random directions. */
export function spawnPedestrians(w: PedWorld, count: number, firstId: number): Pedestrian[] {
  const sidewalks = w.city.pedEdges.filter((e) => e.kind === 'sidewalk' && e.length > 5);
  const weights = sidewalks.map((e) => e.length);
  const out: Pedestrian[] = [];
  for (let i = 0; i < count; i++) {
    const e = sidewalks[w.rng.weightedIndex(weights)] as PedEdge;
    const forward = w.rng.chance(0.5);
    const to = forward ? e.b : e.a;
    const pa = nodePos(w, forward ? e.a : e.b);
    const pb = nodePos(w, to);
    const f = w.rng.range(0.05, 0.95);
    const offset = w.rng.range(-0.7, 0.7);
    const n = leftNormal(pa, pb);
    const traits = drawTraits(w.rng);
    const x = pa.x + (pb.x - pa.x) * f + n.x * offset;
    const y = pa.y + (pb.y - pa.y) * f + n.y * offset;
    const heading = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    const ped: Pedestrian = {
      id: firstId + i,
      x,
      y,
      heading,
      prevX: x,
      prevY: y,
      prevHeading: heading,
      speed: 0,
      ...traits,
      state: 'walk',
      onRoad: false,
      edge: e.id,
      toNode: to,
      offset,
      target: { x: pb.x + n.x * offset, y: pb.y + n.y * offset },
      crossing: null,
      jaywalkAt: null,
      waitTime: 0,
      idleTime: 0,
      blockedTime: 0,
      walkPhase: w.rng.range(0, Math.PI * 2),
      crosswalkId: -1,
      waiting: false,
    };
    maybePlanJaywalk(w, ped, e, f);
    out.push(ped);
  }
  return out;
}
