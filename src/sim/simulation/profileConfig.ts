import { getProfile, resolveProfile, type ResolvedProfile } from '../platform';
import type { EgoConfig, SimConfig, SimConfigInput } from './config';

/** The run's platform in sim units. With measured latency the compute delay happens for real, so it is not modeled. */
export function resolvePlatform(cfg: Pick<SimConfig, 'profile' | 'latency'>): ResolvedProfile {
  const p = resolveProfile(getProfile(cfg.profile));
  return cfg.latency === 'measured' ? { ...p, actuators: { ...p.actuators, computeDelay: 0 } } : p;
}

/**
 * Config values implied by a platform profile (sim units). `resolveConfig()`
 * layers them between the defaults and the explicit input, so the precedence
 * is: explicit input > profile > DEFAULT_SIM_CONFIG.
 */
export function profileDefaults(name: string): SimConfigInput {
  const p = resolveProfile(getProfile(name));
  const w = p.world ?? {};
  const ego: Partial<EgoConfig> = { params: p.vehicle };
  if (w.spawnLaneMinLength !== undefined) ego.spawnLaneMinLength = w.spawnLaneMinLength;
  if (w.minRouteDistance !== undefined) ego.minRouteDistance = w.minRouteDistance;
  if (w.maxEpisodeTime !== undefined) ego.maxEpisodeTime = w.maxEpisodeTime;
  const out: SimConfigInput = {
    city: w.city ?? {},
    ego,
    sensors: { lidarRange: p.sensors.lidar.range, agentRadius: p.sensors.objects.range },
  };
  if (w.vehicleCount !== undefined) out.vehicleCount = w.vehicleCount;
  if (w.pedestrianCount !== undefined) out.pedestrianCount = w.pedestrianCount;
  return out;
}
