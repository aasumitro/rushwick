import { obbCorners, obbOverlap, pointObbDistance } from '../core/obb';
import type { EgoVehicle } from '../ego/egoVehicle';
import type { Pedestrian } from '../pedestrians';
import type { Vehicle, VehicleSystem } from '../traffic/vehicles';
import { blockAt, isInsideCity } from '../world/queries';
import type { City } from '../world/types';
import type { WorldIndex } from './worldIndex';

export interface ContactReport {
  vehicle: boolean;
  pedestrian: boolean;
  offRoad: boolean;
  /** Pedestrians newly passed within 1 m at speed (counted once per encounter). */
  newNearMisses: number;
}

/** Collision, curb-contact and near-miss detection for the ego body. */
export class EgoContact {
  private readonly nearMissPeds = new Set<number>();

  reset(): void {
    this.nearMissPeds.clear();
  }

  check(city: City, ego: EgoVehicle, index: WorldIndex, traffic: VehicleSystem, peds: readonly Pedestrian[]): ContactReport {
    const obb = ego.obb();
    const report: ContactReport = { vehicle: false, pedestrian: false, offRoad: false, newNearMisses: 0 };
    index.vehicleGrid.query(ego.x, ego.y, 12, (i) => {
      if (obbOverlap(obb, traffic.obbOf(traffic.vehicles[i] as Vehicle, 0.96))) report.vehicle = true;
    });
    index.pedGrid.query(ego.x, ego.y, 6, (i) => {
      const p = peds[i] as Pedestrian;
      const d = pointObbDistance(p.x, p.y, obb);
      if (d < 0.25) report.pedestrian = true;
      else if (d < 1.0 && ego.speed > 2) {
        if (!this.nearMissPeds.has(p.id)) {
          this.nearMissPeds.add(p.id);
          report.newNearMisses++;
        }
      } else if (d > 2) this.nearMissPeds.delete(p.id);
    });
    report.offRoad = obbCorners(obb).some((c) => blockAt(city, c.x, c.y) >= 0) || !isInsideCity(city, ego.x, ego.y);
    return report;
  }
}
