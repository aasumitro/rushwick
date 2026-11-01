import type { Obb } from '../../core/obb';
import type { SpatialGrid } from '../../core/spatialGrid';
import type { Pedestrian } from '../../pedestrians';
import type { SignalSystem } from '../../traffic/signals';
import type { Vehicle } from '../../traffic/vehicles';
import type { City } from '../../world/types';
import type { EgoVehicle } from '../egoVehicle';
import type { Route } from '../route';

/** Read-only slice of the simulation that sensors are allowed to look at. */
export interface WorldView {
  time: number;
  city: City;
  signals: SignalSystem;
  vehicles: readonly Vehicle[];
  peds: readonly Pedestrian[];
  vehicleGrid: SpatialGrid;
  pedGrid: SpatialGrid;
  ego: EgoVehicle;
  route: Route;
  progress: number;
  vehicleObb(v: Vehicle): Obb;
}
