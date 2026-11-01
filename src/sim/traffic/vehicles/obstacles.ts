import { pointSegmentDistance } from '../../core/segment';
import type { TrafficState } from './trafficState';
import { TUNING } from './tuning';
import type { EgoObstacle, Leader, PedObstacle, Vehicle, VehicleStepContext } from './types';

/** Gap to the first stop line we hold no reservation for (IDM then stops ~stopMargin before it). */
export function stopLineGap(ts: TrafficState, v: Vehicle, lookahead: number): number | null {
  let d = -v.s;
  for (let k = 0; k < v.route.length - 1; k++) {
    const seg = ts.seg(v.route[k] as number);
    d += seg.path.length;
    if (d > lookahead) return null;
    if (seg.kind === 'lane' && v.claim !== v.route[k + 1]) return d - TUNING.stopMargin + v.s0;
  }
  return null;
}

/** Crossing pedestrians (with short-term prediction) and the ego inside the swept corridor ahead. */
export function corridorObstacle(ts: TrafficState, v: Vehicle, ctx: VehicleStepContext): Leader | null {
  const range = Math.max(18, (v.speed * v.speed) / 6 + 14);
  const halfW = v.width / 2;
  const reach = halfW + 0.35 + TUNING.pedRadius;
  const ego = ctx.ego;
  const egoNear = ego !== null && Math.hypot(ego.obb.x - v.x, ego.obb.y - v.y) < range + v.length + 8;
  let k = 0;
  let segS = v.s + 0.3;
  for (let acc = 0.3; acc <= range; acc += TUNING.corridorStep, segS += TUNING.corridorStep) {
    let seg = ts.seg(v.route[k] as number);
    while (segS > seg.path.length) {
      segS -= seg.path.length;
      if (++k >= v.route.length) return null;
      seg = ts.seg(v.route[k] as number);
    }
    const p = seg.path.sample(segS);
    if (pedestrianAt(ctx, p.x, p.y, reach)) return { gap: acc - TUNING.pedRadius, speed: 0 };
    if (egoNear && ego && egoAt(ego, p.x, p.y, halfW + 0.3)) {
      return { gap: acc, speed: Math.max(0, ego.speed * Math.cos(ego.heading - p.heading)) };
    }
  }
  return null;
}

/** A crossing pedestrian is, or within TUNING.pedPredict seconds will be, within `reach` of (x, y). */
function pedestrianAt(ctx: VehicleStepContext, x: number, y: number, reach: number): boolean {
  let hit = false;
  ctx.crossingGrid.query(x, y, reach + TUNING.pedPredict * 1.9, (i) => {
    if (hit) return;
    const ped = ctx.crossingPeds[i] as PedObstacle;
    const ex = ped.x + Math.cos(ped.heading) * ped.speed * TUNING.pedPredict;
    const ey = ped.y + Math.sin(ped.heading) * ped.speed * TUNING.pedPredict;
    if (pointSegmentDistance(x, y, ped.x, ped.y, ex, ey) < reach) hit = true;
  });
  return hit;
}

function egoAt(ego: EgoObstacle, x: number, y: number, reach: number): boolean {
  const dx = ego.obb.x - x;
  const dy = ego.obb.y - y;
  if (dx * dx + dy * dy >= 49) return false;
  const c = Math.cos(ego.obb.heading);
  const s = Math.sin(ego.obb.heading);
  const lx = Math.abs(-dx * c - dy * s) - ego.obb.halfLength;
  const ly = Math.abs(dx * s - dy * c) - ego.obb.halfWidth;
  return Math.hypot(Math.max(lx, 0), Math.max(ly, 0)) < reach;
}
