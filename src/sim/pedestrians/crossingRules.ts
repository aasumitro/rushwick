import { inflateObb, obbOverlap, type Obb } from '../core/obb';
import { rayObb } from '../core/ray';
import type { Crossing, MovingBox, PedStepContext, Pedestrian } from './types';
import type { PedWorld } from './pedWorld';

/** May the waiting pedestrian step onto the road now? */
export function mayCross(w: PedWorld, p: Pedestrian, ctx: PedStepContext): boolean {
  const c = p.crossing!;
  if (c.kind === 'crosswalk') {
    const st = w.signals.crosswalkState(w.city.crosswalks[c.crosswalkId]!);
    if (st === null) return crossingClear(c, ctx, 5, 35); // unsignalised: gap acceptance
    return st === 'walk' && crossingClear(c, ctx, 2.5, 25);
  }
  if (p.waitTime < 1) return false;
  const length = Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y);
  return crossingClear(c, ctx, length / (p.desiredSpeed * 1.25) + 2.5, 75);
}

/** No vehicle on, or arriving within `horizon` seconds at, the crossing corridor. */
function crossingClear(c: Crossing, ctx: PedStepContext, horizon: number, radius: number): boolean {
  const mx = (c.from.x + c.to.x) / 2;
  const my = (c.from.y + c.to.y) / 2;
  const len = Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y);
  const corridor: Obb = { x: mx, y: my, heading: Math.atan2(c.to.y - c.from.y, c.to.x - c.from.x), halfLength: len / 2 + 0.5, halfWidth: 1.8 };
  const blocks = (v: MovingBox): boolean => {
    if (obbOverlap(inflateObb(v.obb, 1.0), corridor)) return true;
    if (v.speed < 0.3) return false;
    const t = rayObb(v.obb.x, v.obb.y, Math.cos(v.heading), Math.sin(v.heading), corridor);
    return Number.isFinite(t) && (t - v.obb.halfLength) / v.speed < horizon;
  };
  let clear = true;
  ctx.vehicleGrid.query(mx, my, radius, (i) => {
    if (clear && blocks(ctx.vehicles[i]!)) clear = false;
  });
  const e = ctx.ego;
  if (clear && e && Math.hypot(e.obb.x - mx, e.obb.y - my) < radius && blocks(e)) clear = false;
  return clear;
}
