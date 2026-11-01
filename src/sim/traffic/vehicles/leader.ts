import type { Segment } from '../../world/types';
import type { TrafficState } from './trafficState';
import { TUNING } from './tuning';
import type { Leader, Vehicle } from './types';

type Offer = (gap: number, speed: number) => void;

/** Nearest vehicle ahead along the planned path, incl. diverging siblings and lane changers. */
export function findLeader(ts: TrafficState, v: Vehicle, lookahead: number): Leader | null {
  let best: Leader | null = null;
  const offer: Offer = (gap, speed) => {
    if (!best || gap < best.gap) best = { gap, speed };
  };
  const curId = v.route[0] as number;
  const cur = ts.seg(curId);
  const list = ts.occ[curId]!;
  const ahead = list[list.indexOf(v) + 1];
  if (ahead) offer(ahead.s - ahead.length - v.s, ahead.speed);
  if (cur.kind === 'lane') offerLaneChangers(ts, v, cur, offer);
  else {
    for (const sib of cur.siblings) {
      for (const o of ts.occ[sib]!) if (o.s > v.s && o.s < TUNING.siblingOverlap) offer(o.s - o.length - v.s, o.speed);
    }
  }
  if (best) return best;
  let d = cur.path.length - v.s;
  for (let k = 1; k < v.route.length && d < lookahead; k++) {
    const segId = v.route[k] as number;
    const seg = ts.seg(segId);
    const first = ts.occ[segId]![0];
    if (first) offer(d + first.s - first.length, first.speed);
    if (seg.kind === 'connector') {
      for (const sib of seg.siblings) {
        for (const o of ts.occ[sib]!) if (o.s < TUNING.siblingOverlap) offer(d + o.s - o.length, o.speed);
      }
    }
    if (best) return best;
    d += seg.path.length;
  }
  return best;
}

/**
 * Vehicles that still physically overlap this lane while changing out of it,
 * and the lane this vehicle is itself changing out of.
 */
function offerLaneChangers(ts: TrafficState, v: Vehicle, cur: Segment & { kind: 'lane' }, offer: Offer): void {
  for (const nb of cur.group) {
    if (nb === cur.id) continue;
    for (const o of ts.occ[nb]!) {
      if (o.s <= v.s) continue;
      const overlapping =
        (o.laneChangeFrom === cur.id && o.laneChangeProgress < 0.6) || (v.laneChangeFrom === nb && v.laneChangeProgress < 0.6);
      if (overlapping) {
        offer(o.s - o.length - v.s, o.speed);
        break;
      }
    }
  }
}
