import type { LaneSegment } from '../../world/types';
import { createVehicle } from './factory';
import { VEHICLE_KINDS, VEHICLE_SPECS, type VehicleKind } from './specs';
import type { TrafficState } from './trafficState';

function laneHasRoom(ts: TrafficState, laneId: number, s: number, len: number, margin: number): boolean {
  for (const v of ts.vehicles) {
    if (v.route[0] !== laneId) continue;
    if (s + margin > v.s - v.length && s - len - margin < v.s) return false;
  }
  return true;
}

/** Scatter up to `count` vehicles over the lane network with safe spacing. Returns how many fit. */
export function spawnRandom(ts: TrafficState, count: number): number {
  const lanes = ts.city.lanes.map((id) => ts.seg(id) as LaneSegment);
  const weights = lanes.map((l) => l.path.length);
  const kindWeights = VEHICLE_KINDS.map((k) => VEHICLE_SPECS[k].weight);
  let placed = 0;
  for (let attempt = 0; attempt < count * 30 && placed < count; attempt++) {
    const lane = lanes[ts.rng.weightedIndex(weights)] as LaneSegment;
    const kind = VEHICLE_KINDS[ts.rng.weightedIndex(kindWeights)] as VehicleKind;
    const spec = VEHICLE_SPECS[kind];
    const len = ts.rng.range(spec.length[0], spec.length[1]);
    if (lane.path.length < len + 8) continue;
    const s = ts.rng.range(len + 1, lane.path.length - 4);
    if (!laneHasRoom(ts, lane.id, s, len, 6)) continue;
    ts.vehicles.push(createVehicle(ts, kind, lane.id, s, len));
    placed++;
  }
  return placed;
}

/** Remove every vehicle whose centre lies within `radius` of (x, y). */
export function removeNear(ts: TrafficState, x: number, y: number, radius: number): void {
  for (let i = ts.vehicles.length - 1; i >= 0; i--) {
    const v = ts.vehicles[i]!;
    if (Math.hypot(v.x - x, v.y - y) < radius) ts.vehicles.splice(i, 1);
  }
}
