import type { EpisodeMetrics } from './types';

/** Multiplicative penalty per infraction (kept fixed across experiments for comparability). */
export const PENALTY = {
  collisionVehicle: 0.5,
  collisionPedestrian: 0.3,
  redLight: 0.7,
  offRoad: 0.75,
  nearMiss: 0.95,
} as const;

type Infractions = Pick<EpisodeMetrics, 'collisionsVehicle' | 'collisionsPedestrian' | 'redLightViolations' | 'offRoadEvents' | 'pedestrianNearMisses'>;

/** completion x product of penalties — in the spirit of CARLA's driving score, not identical to it. */
export function drivingScore(completion: number, m: Infractions): number {
  return (
    completion *
    PENALTY.collisionVehicle ** m.collisionsVehicle *
    PENALTY.collisionPedestrian ** m.collisionsPedestrian *
    PENALTY.redLight ** m.redLightViolations *
    PENALTY.offRoad ** m.offRoadEvents *
    PENALTY.nearMiss ** m.pedestrianNearMisses
  );
}
