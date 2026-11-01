import { DEFAULT_EGO_PARAMS, type EgoParams } from '../ego/egoParams';
import { DEFAULT_SENSOR_CONFIG, type SensorConfig } from '../ego/observation';
import type { CityConfig } from '../world/types';

export interface EgoConfig {
  enabled: boolean;
  params: EgoParams;
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
  city: {},
  dt: 1 / 30,
  vehicleCount: 260,
  pedestrianCount: 520,
  jaywalkProbability: 0.03,
  warmupTime: 20,
  ego: {
    enabled: true,
    params: DEFAULT_EGO_PARAMS,
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

export function resolveConfig(input: SimConfigInput = {}): SimConfig {
  return {
    ...DEFAULT_SIM_CONFIG,
    ...input,
    city: { ...DEFAULT_SIM_CONFIG.city, ...input.city },
    ego: { ...DEFAULT_SIM_CONFIG.ego, ...input.ego },
    sensors: { ...DEFAULT_SIM_CONFIG.sensors, ...input.sensors },
  };
}
