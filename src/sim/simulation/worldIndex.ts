import { SpatialGrid } from '../core/spatialGrid';
import type { MovingBox, Pedestrian } from '../pedestrians';
import type { Vehicle, VehicleSystem } from '../traffic/vehicles';
import type { City } from '../world/types';

/** Spatial indexes over the moving agents, rebuilt every step. */
export class WorldIndex {
  readonly vehicleGrid: SpatialGrid;
  readonly pedGrid: SpatialGrid;
  /** Only pedestrians on the carriageway — the ones drivers react to. */
  readonly crossingGrid: SpatialGrid;
  crossingPeds: Pedestrian[] = [];
  vehicleBoxes: MovingBox[] = [];

  constructor(city: City) {
    const b = city.bounds;
    const grid = (cell: number) => new SpatialGrid(b.minX - 20, b.minY - 20, b.maxX + 20, b.maxY + 20, cell);
    this.vehicleGrid = grid(10);
    this.pedGrid = grid(6);
    this.crossingGrid = grid(6);
  }

  indexPedestrians(peds: readonly Pedestrian[]): void {
    this.pedGrid.clear();
    this.crossingGrid.clear();
    this.crossingPeds = [];
    peds.forEach((p, i) => {
      this.pedGrid.insert(i, p.x, p.y);
      if (!p.onRoad) return;
      this.crossingGrid.insert(this.crossingPeds.length, p.x, p.y);
      this.crossingPeds.push(p);
    });
  }

  reindexAll(peds: readonly Pedestrian[], traffic: VehicleSystem): void {
    this.indexPedestrians(peds);
    this.indexVehicles(traffic);
  }

  indexVehicles(traffic: VehicleSystem): void {
    this.vehicleGrid.clear();
    const vs = traffic.vehicles;
    this.vehicleBoxes = new Array(vs.length);
    vs.forEach((v: Vehicle, i) => {
      this.vehicleGrid.insert(i, v.x, v.y);
      this.vehicleBoxes[i] = { obb: traffic.obbOf(v), speed: v.speed, heading: v.heading };
    });
  }
}
