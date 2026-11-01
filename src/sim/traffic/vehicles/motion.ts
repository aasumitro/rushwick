import { ensurePlan } from './planner';
import { updateIndicator, updatePose } from './pose';
import type { TrafficState } from './trafficState';
import { TUNING } from './tuning';
import type { Vehicle } from './types';

/** Advance one step along the planned path, handing over segments and reservations. */
export function integrate(ts: TrafficState, v: Vehicle, dt: number): void {
  v.prevX = v.x;
  v.prevY = v.y;
  v.prevHeading = v.heading;
  v.speed = Math.max(0, v.speed + v.accel * dt);
  const ds = v.speed * dt;
  v.s += ds;
  v.odometer += ds;
  v.stoppedTime = v.speed < 0.1 ? v.stoppedTime + dt : 0;
  for (let cur = ts.seg(v.route[0] as number); v.s > cur.path.length; cur = ts.seg(v.route[0] as number)) {
    const nextId = v.route[1] as number;
    v.s -= cur.path.length;
    if (cur.kind === 'lane') {
      // Entering the junction. Normally the claim is already held; if a vehicle
      // overshot without one (rare), register it so conflicting flows wait.
      if (v.claim !== nextId) {
        ts.releaseClaim(v);
        ts.addClaim(v, nextId);
      }
    } else {
      v.clearing = cur.id;
      v.claim = -1;
    }
    v.prevSeg = cur.id;
    v.route.shift();
    ensurePlan(ts, v);
  }
  if (v.clearing >= 0 && v.s >= v.length + 0.5 && ts.seg(v.route[0] as number).kind === 'lane') v.clearing = -1;
  if (v.laneChangeProgress < 1) {
    v.laneChangeProgress = Math.min(1, v.laneChangeProgress + dt / TUNING.laneChangeTime);
    if (v.laneChangeProgress >= 1) v.laneChangeFrom = -1;
  }
  updatePose(ts, v);
  updateIndicator(ts, v);
}
