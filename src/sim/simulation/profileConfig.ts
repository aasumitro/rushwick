import { getProfile, resolveProfile } from '../platform';
import type { EgoConfig, SimConfigInput } from './config';

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
