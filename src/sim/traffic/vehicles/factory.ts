import { ensurePlan } from './planner';
import { updatePose } from './pose';
import { VEHICLE_SPECS, type VehicleKind } from './specs';
import type { TrafficState } from './trafficState';
import type { Vehicle } from './types';

/** Create a vehicle with randomised driver parameters at arc length `s` of a lane. */
export function createVehicle(ts: TrafficState, kind: VehicleKind, laneId: number, s: number, length?: number): Vehicle {
  const spec = VEHICLE_SPECS[kind];
  const r = ts.rng;
  // Draw order is part of the determinism contract: do not reorder.
  const len = length ?? r.range(spec.length[0], spec.length[1]);
  const color = r.pick(spec.colors);
  const speedFactor = r.range(spec.speedFactor[0], spec.speedFactor[1]);
  const aMax = r.range(spec.aMax[0], spec.aMax[1]);
  const bComf = r.range(1.8, 2.6);
  const T = r.range(1.0, 1.7);
  const s0 = r.range(spec.s0[0], spec.s0[1]);
  const v: Vehicle = {
    id: ts.nextId++,
    kind,
    length: len,
    width: spec.width,
    height: spec.height,
    color,
    speedFactor,
    aMax,
    bComf,
    T,
    s0,
    route: [laneId],
    prevSeg: -1,
    s,
    speed: 0,
    accel: 0,
    claim: -1,
    clearing: -1,
    laneChangeFrom: -1,
    laneChangeOffset0: 0,
    laneChangeProgress: 1,
    x: 0,
    y: 0,
    heading: 0,
    prevX: 0,
    prevY: 0,
    prevHeading: 0,
    odometer: 0,
    stoppedTime: 0,
    indicator: 0,
  };
  ensurePlan(ts, v);
  updatePose(ts, v);
  v.prevX = v.x;
  v.prevY = v.y;
  v.prevHeading = v.heading;
  return v;
}
