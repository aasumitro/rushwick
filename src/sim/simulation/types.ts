import type { PedestrianSystem } from '../pedestrians';
import type { ResolvedProfile } from '../platform';
import type { SignalSystem } from '../traffic/signals';
import type { VehicleSystem } from '../traffic/vehicles';
import type { City } from '../world/types';
import type { SimConfig } from './config';
import type { WorldIndex } from './worldIndex';

/** Infractions that happened during the last step. */
export interface StepEvents {
  collisionVehicle: boolean;
  collisionPedestrian: boolean;
  offRoad: boolean;
  redLightViolation: boolean;
}

export const noEvents = (): StepEvents => ({ collisionVehicle: false, collisionPedestrian: false, offRoad: false, redLightViolation: false });

/** The parts of the simulation an ego episode needs. */
export interface EpisodeHost {
  readonly config: SimConfig;
  /** `config.profile` in sim units. */
  readonly platform: ResolvedProfile;
  readonly city: City;
  readonly signals: SignalSystem;
  readonly traffic: VehicleSystem;
  readonly pedestrians: PedestrianSystem;
  readonly index: WorldIndex;
}
