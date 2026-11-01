export type EpisodeOutcome = 'running' | 'success' | 'collision' | 'offroad' | 'off_route' | 'timeout' | 'stuck';

export interface EpisodeMetrics {
  outcome: EpisodeOutcome;
  /** Seconds since the episode started. */
  time: number;
  distance: number;
  routeLength: number;
  routeProgress: number;
  /** Fraction of the route completed (0..1). */
  completion: number;
  collisionsVehicle: number;
  collisionsPedestrian: number;
  offRoadEvents: number;
  offRoadTime: number;
  redLightViolations: number;
  /** Pedestrian within 1 m of the ego body while moving > 2 m/s. */
  pedestrianNearMisses: number;
  meanSpeed: number;
  maxAbsJerk: number;
  rmsJerk: number;
  maxLateralAccel: number;
  /** Min time-to-collision to the vehicle ahead in the ego's path (s). */
  minTimeToCollision: number;
  stoppedTime: number;
  /**
   * Composite score in [0, 1]: completion x multiplicative infraction
   * penalties. Ad-hoc, in the spirit of CARLA's driving score but NOT the
   * same formula — keep it fixed across experiments for comparability.
   */
  score: number;
}
