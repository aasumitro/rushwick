import type { Rng } from '../core/rng';
import type { EgoParams } from '../ego/egoParams';
import type { SensorConfig } from '../ego/observation';
import { ActuatorModel } from './actuators/actuatorModel';
import { isIdeal } from './profiles';
import { SensorModel } from './sensors/sensorModel';
import type { ResolvedProfile } from './types';

/** The per-episode models that make the ego sense and act like its platform. */
export interface PlatformModels {
  actuators: ActuatorModel;
  sensors: SensorModel;
}

/**
 * Models for one episode, or null for the ideal profile, which keeps the exact
 * pre-profile code path (design decision D4). Every model draws from its own
 * fork of the episode stream, so adding one never shifts another.
 */
export function createPlatformModels(p: ResolvedProfile, vehicle: EgoParams, sensors: SensorConfig, dt: number, rng: Rng): PlatformModels | null {
  if (isIdeal(p)) return null;
  const actuators = new ActuatorModel(p.actuators, vehicle, dt, rng.fork('actuators'));
  return { actuators, sensors: new SensorModel(p.sensors, sensors, dt, rng, actuators) };
}
