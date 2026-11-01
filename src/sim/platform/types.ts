import type { EgoParams } from '../ego/egoParams';
import type { CityConfig } from '../world/types';
import type { ActuatorModelConfig } from './actuators/types';
import type { SensorModelConfig } from './sensors/types';

/**
 * World defaults a platform needs (sim units). Input from the user always wins.
 * Defined here rather than reusing SimConfigInput, which would make `platform`
 * import `simulation` (an upward import).
 */
export interface PlatformWorld {
  city?: Partial<CityConfig>;
  vehicleCount?: number;
  pedestrianCount?: number;
  /** Minimum straight-line distance between start and destination (m). */
  minRouteDistance?: number;
  /** Hard cap on episode duration (s). */
  maxEpisodeTime?: number;
}

/** A target vehicle: its body, actuators and sensors, written in real units as measured on the bench. */
export interface PlatformProfile {
  name: string;
  /** Human-readable name for the UI. */
  label: string;
  /** Sim meters per real meter: 1 for a full-size car, 10 for a 1:10 RC car. */
  scale: number;
  /** Body and actuator limits (real units). */
  vehicle: EgoParams;
  actuators: ActuatorModelConfig;
  sensors: SensorModelConfig;
  world?: PlatformWorld;
}

/** A profile converted to sim units by `resolveProfile()` (same shape, lengths and speeds times `scale`). */
export type ResolvedProfile = PlatformProfile;
