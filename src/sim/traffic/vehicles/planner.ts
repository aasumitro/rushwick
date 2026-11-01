import type { ConnectorSegment, LaneSegment, TurnType } from '../../world/types';
import type { TrafficState } from './trafficState';
import { TUNING, TURN_WEIGHTS } from './tuning';
import type { Vehicle } from './types';

const PLAN_HORIZON = 5;

/** Keep at least PLAN_HORIZON segments of intended path ahead of the vehicle. */
export function ensurePlan(ts: TrafficState, v: Vehicle): void {
  while (v.route.length < PLAN_HORIZON) {
    const last = ts.seg(v.route[v.route.length - 1] as number);
    if (last.kind === 'lane') v.route.push(chooseConnector(ts, last, false, v.length));
    else v.route.push(last.next[0] as number);
  }
}

/**
 * Choose the movement at the end of `lane`. Any lane of the same road
 * direction may be used (the driver changes lanes mid-block), but the entry
 * lane is preferred to avoid needless lane changes.
 */
export function chooseConnector(ts: TrafficState, lane: LaneSegment, restrictToLane: boolean, vehicleLength: number): number {
  let options: ConnectorSegment[] = [];
  for (const lid of restrictToLane ? [lane.id] : lane.group) {
    for (const cid of ts.seg(lid).next) options.push(ts.seg(cid) as ConnectorSegment);
  }
  // Buses and trucks avoid tight near-side corners when they have another option.
  if (vehicleLength > TUNING.longVehicle) {
    const wide = options.filter((o) => o.turn !== 'near');
    if (wide.length > 0) options = wide;
  }
  const turns = [...new Set(options.map((o) => o.turn))];
  const turn = turns[ts.rng.weightedIndex(turns.map((t) => TURN_WEIGHTS[t]))] as TurnType;
  const withTurn = options.filter((o) => o.turn === turn);
  const own = withTurn.filter((o) => o.fromLane === lane.id);
  if (own.length > 0 && ts.rng.chance(0.85)) return ts.rng.pick(own).id;
  return ts.rng.pick(withTurn).id;
}

/** Replace the plan with a movement reachable from the current lane (lane change failed). */
export function replanFromCurrentLane(ts: TrafficState, v: Vehicle): void {
  ts.releaseClaim(v);
  v.route.length = 1;
  v.route.push(chooseConnector(ts, ts.seg(v.route[0] as number) as LaneSegment, true, v.length));
  ensurePlan(ts, v);
}
