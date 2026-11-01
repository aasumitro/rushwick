import type { ConnectorSegment, Crosswalk } from '../../world/types';
import { idmReactionDistance } from '../idm';
import { priorityGapClear, revokeApproachClaims } from './priorityGap';
import type { TrafficState } from './trafficState';
import { TUNING } from './tuning';
import type { Vehicle, VehicleStepContext } from './types';

/**
 * Junction access is reservation based: a vehicle must hold a claim on its
 * next connector before crossing the stop line. Claims are refused while a
 * conflicting connector is occupied/claimed, so background traffic is
 * collision-free by construction.
 */
export function claimDistance(v: Vehicle): number {
  return Math.max(20, idmReactionDistance(v, v.speed) + 8);
}

export function updateClaim(ts: TrafficState, v: Vehicle, ctx: VehicleStepContext): void {
  const cur = ts.seg(v.route[0] as number);
  if (cur.kind !== 'lane') return;
  const conn = ts.seg(v.route[1] as number) as ConnectorSegment;
  if (conn.fromLane !== cur.id) {
    ts.releaseClaim(v);
    return;
  }
  const d = cur.path.length - v.s;
  const state = ts.signals.connectorState(conn);
  // A permissive turner waiting at the line may clear the junction at the end of its green ("sneaker").
  const sneaker = conn.yieldTo.length > 0 && d < 4 && state !== 'green' && ts.signals.inClearance(conn);
  if (v.claim === conn.id) {
    const need = (v.speed * v.speed) / (2 * Math.max(d - TUNING.stopMargin, 0.1));
    if (state !== 'green' && !sneaker && need < TUNING.yellowStopDecel) ts.releaseClaim(v);
    return;
  }
  ts.releaseClaim(v);
  const allowed = state === 'green' || sneaker;
  if (!allowed || d > claimDistance(v) || !canClaim(ts, v, conn, ctx)) return;
  ts.addClaim(v, conn.id);
  if (conn.yieldTo.length > 0) revokeApproachClaims(ts, conn.yieldTo);
}

function canClaim(ts: TrafficState, v: Vehicle, conn: ConnectorSegment, ctx: VehicleStepContext): boolean {
  if (ctx.egoBlockedConnectors.has(conn.id)) return false;
  // Do not enter a turn whose exit crosswalk is in use: yield at the line, not on the crosswalk.
  for (const cw of conn.crosswalks) {
    if (ts.crosswalkBusy[cw] && (ts.city.crosswalks[cw] as Crosswalk).arm === conn.exitArm) return false;
  }
  if (!wideConflictsClear(ts, v, conn) || !conflictsClear(ts, conn, ctx)) return false;
  if (conn.yieldTo.length > 0) {
    // Permissive movement: pull up to the line, then accept only a sufficient gap.
    if (ts.seg(conn.fromLane).path.length - v.s > 8 || !priorityGapClear(ts, conn)) return false;
  }
  return exitHasRoom(ts, v, conn);
}

/** Buses/trucks sweep wide on turns: a turning long vehicle needs the neighbouring paths free. */
function wideConflictsClear(ts: TrafficState, v: Vehicle, conn: ConnectorSegment): boolean {
  const isLong = (o: Vehicle) => o.length > TUNING.longVehicle;
  for (const k of conn.wideConflicts) {
    const users = [...ts.occ[k]!, ...ts.claimants[k]!].filter((o) => o !== v);
    if (users.length === 0) continue;
    if (isLong(v) && conn.turn !== 'straight') return false;
    if ((ts.seg(k) as ConnectorSegment).turn !== 'straight' && users.some(isLong)) return false;
  }
  return true;
}

function conflictsClear(ts: TrafficState, conn: ConnectorSegment, ctx: VehicleStepContext): boolean {
  for (const k of conn.conflicts) {
    if (ts.occ[k]!.length > 0 || ctx.egoBlockedConnectors.has(k)) return false;
    for (const o of ts.claimants[k]!) {
      // Early reservations by priority traffic still on approach are judged by time gap instead.
      const onApproach = o.route[0] !== k && o.clearing !== k;
      if (!(onApproach && conn.yieldTo.includes(k))) return false;
    }
  }
  return true;
}

/** Don't block the box: the exit lane must have room for everyone already committed. */
function exitHasRoom(ts: TrafficState, v: Vehicle, conn: ConnectorSegment): boolean {
  let free = ts.seg(conn.toLane).path.length;
  for (const o of ts.occ[conn.toLane]!) free = Math.min(free, o.s - o.length);
  for (const o of ts.claimants[conn.id]!) if (o !== v) free -= o.length + 2.5;
  return free >= v.length + 2.5;
}
