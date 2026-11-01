import { Fnv } from '../core/hash';
import { obbOverlap, pointObbDistance, type Obb } from '../core/obb';
import type { EgoVehicle } from '../ego/egoVehicle';
import type { Pedestrian } from '../pedestrians';
import type { Vehicle, VehicleSystem } from '../traffic/vehicles';
import type { WorldIndex } from './worldIndex';

/** Deterministic fingerprint of the full dynamic state (reproducibility tests). */
export function stateHash(vehicles: readonly Vehicle[], peds: readonly Pedestrian[], ego: EgoVehicle | null): number {
  const h = new Fnv();
  for (const v of vehicles) h.mix(v.id).mix(v.route[0] as number).mix(Math.round(v.s * 1000)).mix(Math.round(v.speed * 1000));
  for (const p of peds) h.mix(Math.round(p.x * 1000)).mix(Math.round(p.y * 1000));
  if (ego) h.mix(Math.round(ego.x * 1000)).mix(Math.round(ego.y * 1000));
  return h.value;
}

export interface BackgroundConflicts {
  vehicleVehicle: [number, number][];
  pedestrianVehicle: [number, number][];
}

/** Overlapping pairs among background agents (bodies shrunk 10%); should stay empty. */
export function backgroundConflicts(host: { traffic: VehicleSystem; pedestrians: { peds: readonly Pedestrian[] }; index: WorldIndex }): BackgroundConflicts {
  const { traffic, index } = host;
  const peds = host.pedestrians.peds;
  const out: BackgroundConflicts = { vehicleVehicle: [], pedestrianVehicle: [] };
  const vs = traffic.vehicles;
  const boxes: Obb[] = vs.map((v) => traffic.obbOf(v, 0.9));
  vs.forEach((a, i) => {
    index.vehicleGrid.query(a.x, a.y, 14, (j) => {
      if (j > i && obbOverlap(boxes[i]!, boxes[j]!)) out.vehicleVehicle.push([a.id, vs[j]!.id]);
    });
  });
  for (const p of peds) {
    index.vehicleGrid.query(p.x, p.y, 8, (j) => {
      if (pointObbDistance(p.x, p.y, boxes[j]!) < 0.1) out.pedestrianVehicle.push([p.id, vs[j]!.id]);
    });
  }
  return out;
}
