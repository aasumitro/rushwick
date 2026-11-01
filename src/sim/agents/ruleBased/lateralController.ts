import { clamp } from '../../core/vec2';
import type { Observation } from '../../ego/observation';
import { curvatureAt, type LocalPath } from './pathGeometry';

/** Front-wheel angle that yields curvature `kappa` for a centre-referenced kinematic bicycle. */
export function steerForCurvature(kappa: number, wheelBase: number): number {
  const beta = Math.asin(clamp((kappa * wheelBase) / 2, -0.99, 0.99));
  return Math.atan(2 * Math.tan(beta));
}

/**
 * Path-curvature feed-forward + Stanley-style feedback, returned as a
 * normalised steering command. (Pure pursuit cuts tight urban corners by
 * ~Ld^2/2R — enough to hit the curb.)
 */
export function steeringCommand(obs: Observation, path: LocalPath): number {
  const { ego, route } = obs;
  const v = ego.speed;
  // Preview ~ half the steering ramp distance: earlier pre-steering cuts the corner.
  const preview = clamp(0.3 + 0.15 * v, 0.5, 4);
  const feedForward = steerForCurvature(curvatureAt(path, preview), ego.wheelBase);
  // The body heading lags the velocity direction by the sideslip angle beta,
  // so compare the path tangent with the velocity direction, not the body axis.
  const beta = Math.atan(0.5 * Math.tan(ego.steer));
  const feedback = -Math.atan2(1.1 * route.lateralError, v + 1.5) + 0.9 * (route.headingError - beta);
  return clamp((feedForward + feedback) / ego.maxSteer, -1, 1);
}
