import type { Observation } from '../../ego/observation';
import { brakingEnvelope } from '../../traffic/idm';
import type { RuleBasedOptions } from './options';
import { curvatureAt, type LocalPath } from './pathGeometry';

/** Desired speed: posted limits ahead and curve speeds, each reachable by comfortable braking. */
export function desiredSpeed(obs: Observation, path: LocalPath, o: RuleBasedOptions): number {
  const { ego, route } = obs;
  const p = path.points;
  let v0 = route.speedLimit * o.speedFactor;
  for (let i = 1; i < p.length - 1; i++) {
    const k = Math.abs(curvatureAt(path, path.cum[i]!));
    const wp = route.waypoints[i];
    const d = Math.max(0, path.cum[i]! - ego.length / 2);
    if (k > 1e-3) v0 = Math.min(v0, brakingEnvelope(Math.sqrt(o.latAccel / k), d, o.idm.bComf));
    if (wp) v0 = Math.min(v0, brakingEnvelope(wp.speedLimit * o.speedFactor, d, o.idm.bComf));
  }
  return v0;
}
