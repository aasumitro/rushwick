import type { Obb } from '../../core/obb';
import type { Rng } from '../../core/rng';
import type { City } from '../../world/types';
import type { SignalSystem } from '../signals';
import { computeAccel } from './longitudinal';
import { tryLaneChange } from './laneChange';
import { integrate } from './motion';
import { vehicleObb } from './pose';
import { updateClaim } from './reservations';
import { removeNear, spawnRandom } from './spawner';
import { TrafficState } from './trafficState';
import type { Vehicle, VehicleStepContext } from './types';

/**
 * Background traffic. Each step runs four phases over the whole fleet so the
 * result does not depend on update order within a phase:
 * reservations -> accelerations -> lane changes -> integration.
 */
export class VehicleSystem {
  private readonly state: TrafficState;

  constructor(city: City, signals: SignalSystem, rng: Rng) {
    this.state = new TrafficState(city, signals, rng);
  }

  get vehicles(): readonly Vehicle[] {
    return this.state.vehicles;
  }

  spawnRandom(count: number): number {
    return spawnRandom(this.state, count);
  }

  removeNear(x: number, y: number, radius: number): void {
    removeNear(this.state, x, y, radius);
  }

  step(dt: number, ctx: VehicleStepContext): void {
    const ts = this.state;
    ts.rebuildIndexes();
    ts.updateCrosswalkBusy(ctx.peds);
    for (const v of ts.vehicles) updateClaim(ts, v, ctx);
    for (const v of ts.vehicles) v.accel = computeAccel(ts, v, ctx);
    for (const v of ts.vehicles) tryLaneChange(ts, v);
    for (const v of ts.vehicles) integrate(ts, v, dt);
  }

  obbOf(v: Vehicle, shrink = 1): Obb {
    return vehicleObb(v, shrink);
  }
}
