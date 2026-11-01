import type { ConnectorSegment, LaneSegment } from '../../world/types';
import { idmInteraction } from '../idm';
import { replanFromCurrentLane } from './planner';
import type { TrafficState } from './trafficState';
import { TUNING } from './tuning';
import type { Vehicle } from './types';

/** Max deceleration a lane change may impose on anyone (m/s^2). */
const SAFE_DECEL = 2.5;

/** Move one lane towards the lane our next movement starts from, if the gap is safe. */
export function tryLaneChange(ts: TrafficState, v: Vehicle): void {
  const cur = ts.seg(v.route[0] as number);
  if (cur.kind !== 'lane' || v.laneChangeProgress < 1) return;
  const conn = ts.seg(v.route[1] as number) as ConnectorSegment;
  if (conn.fromLane === cur.id) return;
  const dEnd = cur.path.length - v.s;
  const needed = v.speed * TUNING.laneChangeTime + 8;
  if (dEnd < Math.max(14, needed * 0.6)) return replanFromCurrentLane(ts, v);
  if (v.s < v.length + 8 || dEnd < needed) return;
  const target = ts.seg(conn.fromLane) as LaneSegment;
  const nbId = cur.group[cur.laneIndex + (target.laneIndex > cur.laneIndex ? 1 : -1)] as number;
  if (!isSafe(ts, v, nbId, false) || !isSafe(ts, v, cur.id, true)) return;
  const pOld = cur.path.sample(v.s);
  const pNew = ts.seg(nbId).path.sample(v.s);
  ts.removeOcc(cur.id, v);
  v.route[0] = nbId;
  ts.insertOcc(nbId, v);
  v.laneChangeFrom = cur.id;
  // Signed lateral offset of the old lane centre in the new lane's frame (left positive).
  v.laneChangeOffset0 = -(pOld.x - pNew.x) * Math.sin(pNew.heading) + (pOld.y - pNew.y) * Math.cos(pNew.heading);
  v.laneChangeProgress = 0;
}

/** Gap acceptance: neither we nor the new follower would need to brake harder than SAFE_DECEL. */
function isSafe(ts: TrafficState, v: Vehicle, laneId: number, leaderOnly: boolean): boolean {
  let leader: Vehicle | undefined;
  let follower: Vehicle | undefined;
  for (const o of ts.occ[laneId]!) {
    if (o === v) continue;
    if (o.s > v.s) {
      if (!leader || o.s < leader.s) leader = o;
    } else if (!follower || o.s > follower.s) follower = o;
  }
  if (leader) {
    const gap = leader.s - leader.length - v.s;
    if (gap < v.s0 + 0.5 * v.speed || idmInteraction(v, v.speed, gap, leader.speed) < -SAFE_DECEL) return false;
  }
  if (leaderOnly) return true;
  const followerOk = (f: Vehicle, gap: number) => gap >= f.s0 + 0.6 * f.speed && idmInteraction(f, f.speed, gap, v.speed) >= -SAFE_DECEL;
  if (follower) return followerOk(follower, v.s - v.length - follower.s);
  // No follower on the lane itself: check vehicles still on the connectors feeding it.
  for (const pc of ts.seg(laneId).prev) {
    const conn = ts.seg(pc);
    for (const o of ts.occ[pc]!) if (!followerOk(o, v.s - v.length + (conn.path.length - o.s))) return false;
  }
  return true;
}
