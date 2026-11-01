import type { Segment } from '../../world/types';
import { brakingEnvelope, idmFree, idmInteraction, idmReactionDistance, kinematicBrake } from '../idm';
import { findLeader } from './leader';
import { corridorObstacle, stopLineGap } from './obstacles';
import type { TrafficState } from './trafficState';
import { TUNING } from './tuning';
import type { Vehicle, VehicleStepContext } from './types';

/** Desired speed from the current and upcoming speed limits (braking envelope). */
function desiredSpeed(ts: TrafficState, v: Vehicle, lookahead: number): number {
  // Turn speeds are physical (lateral-acceleration) limits: the driver factor never raises them.
  const limit = (seg: Segment) =>
    seg.kind === 'connector' && seg.turn !== 'straight' ? Math.min(seg.speedLimit, seg.speedLimit * v.speedFactor) : seg.speedLimit * v.speedFactor;
  const cur = ts.seg(v.route[0] as number);
  let v0 = limit(cur);
  let d = cur.path.length - v.s;
  for (let k = 1; k < v.route.length && d < lookahead; k++) {
    const seg = ts.seg(v.route[k] as number);
    v0 = Math.min(v0, brakingEnvelope(limit(seg), d, v.bComf * 0.8));
    d += seg.path.length;
  }
  return v0;
}

/** IDM acceleration against the most restrictive of: leader, stop line, pedestrians/ego. */
export function computeAccel(ts: TrafficState, v: Vehicle, ctx: VehicleStepContext): number {
  const lookahead = Math.max(60, idmReactionDistance(v, v.speed) + 15);
  const v0 = desiredSpeed(ts, v, lookahead);
  let interaction = 0;
  let safety = Infinity;
  const consider = (idmGap: number, physicalGap: number, speed: number) => {
    interaction = Math.min(interaction, idmInteraction(v, v.speed, idmGap, speed));
    // Only intervene when IDM would need more than comfortable braking (it is about to overrun).
    const required = kinematicBrake(v.speed, physicalGap, speed);
    if (required < -v.bComf) safety = Math.min(safety, required);
  };
  const leader = findLeader(ts, v, lookahead);
  if (leader) consider(leader.gap, leader.gap, leader.speed);
  const stop = stopLineGap(ts, v, lookahead);
  // The IDM gap includes s0 so IDM settles at the line; the kinematic bound uses the true distance.
  if (stop !== null) consider(stop, stop - v.s0 + TUNING.stopMargin, 0);
  const obstacle = corridorObstacle(ts, v, ctx);
  if (obstacle) consider(obstacle.gap, obstacle.gap, obstacle.speed);
  const a = Math.min(idmFree(v, v.speed, v0) + interaction, safety);
  return Math.max(-TUNING.maxDecel, Math.min(v.aMax, a));
}
