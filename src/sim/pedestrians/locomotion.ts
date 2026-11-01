import { pointObbDistance, type Obb } from '../core/obb';
import { clamp, wrapAngle } from '../core/vec2';
import { arrive } from './navigation';
import type { PedWorld } from './pedWorld';
import type { MovingBox, PedStepContext, Pedestrian } from './types';

/** Walk towards the current target with smooth speed and heading changes. */
export function move(w: PedWorld, p: Pedestrian, dt: number): void {
  let speed = p.desiredSpeed;
  if (p.state === 'cross' && p.crossing?.kind === 'crosswalk') {
    const st = w.signals.crosswalkState(w.city.crosswalks[p.crossing.crosswalkId]!);
    if (st === 'flash' || st === 'dont') speed *= 1.35; // hurry on a flashing signal
  } else if (p.state === 'cross') speed *= 1.25;
  p.speed += clamp(speed - p.speed, -2.5 * dt, 1.5 * dt);
  const dx = p.target.x - p.x;
  const dy = p.target.y - p.y;
  const d = Math.hypot(dx, dy);
  const stepLen = p.speed * dt;
  if (d > 1e-6) p.heading += clamp(wrapAngle(Math.atan2(dy, dx) - p.heading), -6 * dt, 6 * dt);
  if (d <= stepLen || d < 0.05) {
    p.x = p.target.x;
    p.y = p.target.y;
    arrive(w, p);
  } else {
    p.x += (dx / d) * stepLen;
    p.y += (dy / d) * stepLen;
  }
}

/** Which body (if any) occupies the spot just ahead of the pedestrian. */
export function bodyAhead(p: Pedestrian, ctx: PedStepContext): 'none' | 'vehicle' | 'ego' {
  const dx = p.target.x - p.x;
  const dy = p.target.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return 'none';
  const ax = p.x + (dx / d) * 0.6;
  const ay = p.y + (dy / d) * 0.6;
  // Only counts if stepping forward brings us closer to the body.
  const closing = (b: Obb) => {
    const ahead = pointObbDistance(ax, ay, b);
    return ahead < 0.35 && ahead < pointObbDistance(p.x, p.y, b);
  };
  if (ctx.ego && closing(ctx.ego.obb)) return 'ego';
  let blocked = false;
  ctx.vehicleGrid.query(ax, ay, 8, (i) => {
    if (!blocked && closing((ctx.vehicles[i] as MovingBox).obb)) blocked = true;
  });
  return blocked ? 'vehicle' : 'none';
}
