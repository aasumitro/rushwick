import type { ConnectorSegment, LaneSegment } from '../../world/types';
import type { TrafficState } from './trafficState';
import { TUNING } from './tuning';

/**
 * Gap acceptance for a permissive movement: true when no vehicle heading for
 * a priority movement would reach the junction within the critical gap.
 */
export function priorityGapClear(ts: TrafficState, conn: ConnectorSegment): boolean {
  const lanes = new Set<number>();
  for (const k of conn.yieldTo) {
    const from = ts.seg((ts.seg(k) as ConnectorSegment).fromLane) as LaneSegment;
    for (const l of from.group) lanes.add(l);
  }
  for (const laneId of lanes) {
    const lane = ts.seg(laneId);
    for (const o of ts.occ[laneId]!) {
      if (!conn.yieldTo.includes(o.route[1] as number)) continue;
      // Priority traffic held by a red light is not coming.
      if (ts.signals.connectorState(ts.seg(o.route[1] as number) as ConnectorSegment) === 'red') continue;
      const dist = lane.path.length - o.s;
      if (dist < 6 && o.speed < 0.5) return false; // waiting priority vehicle goes first
      if (dist / Math.max(o.speed, 0.5) < TUNING.criticalGap) return false;
    }
  }
  return true;
}

/** Priority vehicles still on their approach lose an early reservation and must re-claim. */
export function revokeApproachClaims(ts: TrafficState, connIds: readonly number[]): void {
  for (const k of connIds) {
    const list = ts.claimants[k]!;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i]!;
      if (o.claim === k && o.route[0] !== k) ts.releaseClaim(o);
    }
  }
}
