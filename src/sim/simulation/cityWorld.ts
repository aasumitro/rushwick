import { Rng } from '../core/rng';
import { PedestrianSystem } from '../pedestrians';
import { SignalSystem } from '../traffic/signals';
import { VehicleSystem, type EgoObstacle, type Vehicle } from '../traffic/vehicles';
import { generateCity } from '../world/generator';
import type { City } from '../world/types';
import { resolveConfig, type SimConfig, type SimConfigInput } from './config';
import { WorldIndex } from './worldIndex';

const NONE: ReadonlySet<number> = new Set();

/** The city and its background road users (no ego). Deterministic for a given seed. */
export class CityWorld {
  readonly config: SimConfig;
  readonly city: City;
  readonly signals: SignalSystem;
  readonly traffic: VehicleSystem;
  readonly pedestrians: PedestrianSystem;
  readonly index: WorldIndex;
  protected readonly rng: Rng;
  time = 0;
  steps = 0;

  constructor(input: SimConfigInput = {}) {
    this.config = resolveConfig(input);
    this.rng = new Rng(this.config.seed);
    this.city = generateCity({ seed: this.config.seed, ...this.config.city });
    this.signals = new SignalSystem(this.city);
    this.traffic = new VehicleSystem(this.city, this.signals, this.rng.fork('traffic'));
    this.pedestrians = new PedestrianSystem(this.city, this.signals, this.rng.fork('peds'), this.config.jaywalkProbability);
    this.index = new WorldIndex(this.city);
    this.traffic.spawnRandom(this.config.vehicleCount);
    this.pedestrians.spawnRandom(this.config.pedestrianCount);
    this.warmUp();
  }

  get vehicles(): readonly Vehicle[] {
    return this.traffic.vehicles;
  }

  /** Background traffic runs before t = 0 so signals stay aligned with the episode clock. */
  private warmUp(): void {
    this.time = -this.config.warmupTime;
    for (let i = Math.round(this.config.warmupTime / this.config.dt); i > 0; i--) this.advanceBackground(null, NONE);
    this.time = 0;
    this.steps = 0;
    this.signals.update(0);
    this.reindex();
  }

  protected reindex(): void {
    this.index.reindexAll(this.pedestrians.peds, this.traffic);
  }

  /** One fixed step of signals, vehicles and pedestrians, aware of the ego as an obstacle. */
  protected advanceBackground(ego: EgoObstacle | null, egoBlockedConnectors: ReadonlySet<number>): void {
    const dt = this.config.dt;
    this.time += dt;
    this.steps++;
    this.signals.update(this.time);
    this.index.indexPedestrians(this.pedestrians.peds);
    const { crossingGrid, crossingPeds } = this.index;
    this.traffic.step(dt, { peds: this.pedestrians.peds, crossingGrid, crossingPeds, ego, egoBlockedConnectors });
    this.index.indexVehicles(this.traffic);
    this.pedestrians.step(dt, { vehicleGrid: this.index.vehicleGrid, vehicles: this.index.vehicleBoxes, ego });
    this.index.indexPedestrians(this.pedestrians.peds);
  }
}
