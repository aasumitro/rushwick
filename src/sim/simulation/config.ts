import { DEFAULT_EGO_PARAMS, type EgoParams } from '../ego/egoParams';
import { DEFAULT_SENSOR_CONFIG, type SensorConfig } from '../ego/observation';
import type { CityConfig } from '../world/types';
import { profileDefaults } from './profileConfig';

export interface EgoConfig {
  enabled: boolean;
  params: EgoParams;
  /** Lanes shorter than this (m) are not used to start or end a route. */
  spawnLaneMinLength: number;
  /** Minimum straight-line distance between start and destination (m). */
  minRouteDistance: number;
  /** Hard cap on episode duration (s). */
  maxEpisodeTime: number;
  /** Time budget = routeLength / minAverageSpeed + 30 s (capped by maxEpisodeTime). */
  minAverageSpeed: number;
  terminateOnCollision: boolean;
  terminateOnOffRoad: boolean;
  /** Seconds below 0.2 m/s (outside red lights) before the episode counts as stuck. */
  stuckTimeout: number;
  /** Lateral deviation from the route (m) that counts as off-route. */
  offRouteDistance: number;
}

export interface SimConfig {
  seed: number;
  /** Platform profile name (see PLATFORM_PROFILES); 'ideal' keeps exact sensing and actuation. */
  profile: string;
  /**
   * 'measured' when perception and inference happen for real, as in a realtime
   * bridge run: the actuator model then leaves out the profile's computeDelay.
   */
  latency: 'modeled' | 'measured';
  city: Partial<CityConfig>;
  /** Fixed physics step (s). */
  dt: number;
  vehicleCount: number;
  pedestrianCount: number;
  /** Chance a pedestrian starting a mid-block sidewalk segment jaywalks across it. */
  jaywalkProbability: number;
  /** Seconds of traffic simulated before t = 0 so the city starts in motion. */
  warmupTime: number;
  ego: EgoConfig;
  sensors: SensorConfig;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  seed: 42,
  profile: 'ideal',
  latency: 'modeled',
  city: {},
  dt: 1 / 30,
  vehicleCount: 260,
  pedestrianCount: 520,
  jaywalkProbability: 0.03,
  warmupTime: 20,
  ego: {
    enabled: true,
    params: DEFAULT_EGO_PARAMS,
    spawnLaneMinLength: 50,
    minRouteDistance: 320,
    maxEpisodeTime: 600,
    minAverageSpeed: 1.25,
    terminateOnCollision: true,
    terminateOnOffRoad: true,
    stuckTimeout: 120,
    offRouteDistance: 6,
  },
  sensors: DEFAULT_SENSOR_CONFIG,
};

/** Partial config accepted by the Simulation constructor (nested objects merge with defaults). */
export type SimConfigInput = Partial<Omit<SimConfig, 'ego' | 'sensors'>> & {
  ego?: Partial<EgoConfig>;
  sensors?: Partial<SensorConfig>;
};

/** Precedence: explicit input > the profile's defaults (profileConfig.ts) > DEFAULT_SIM_CONFIG. */
export function resolveConfig(input: SimConfigInput = {}): SimConfig {
  const profile = input.profile ?? DEFAULT_SIM_CONFIG.profile;
  const p = profileDefaults(profile);
  return {
    ...DEFAULT_SIM_CONFIG,
    ...p,
    ...input,
    profile,
    city: { ...DEFAULT_SIM_CONFIG.city, ...p.city, ...input.city },
    ego: { ...DEFAULT_SIM_CONFIG.ego, ...p.ego, ...input.ego },
    sensors: { ...DEFAULT_SIM_CONFIG.sensors, ...p.sensors, ...input.sensors },
  };
}
