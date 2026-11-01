export interface EgoParams {
  length: number;
  width: number;
  height: number;
  wheelBase: number;
  /** Max front-wheel angle (rad). */
  maxSteer: number;
  /** Steering actuator rate limit (rad/s). */
  maxSteerRate: number;
  maxAccel: number;
  maxBrake: number;
  maxSpeed: number;
}

export const DEFAULT_EGO_PARAMS: EgoParams = {
  length: 4.6,
  width: 1.85,
  height: 1.5,
  wheelBase: 2.75,
  maxSteer: 0.6,
  maxSteerRate: 1.6,
  maxAccel: 3.0,
  maxBrake: 8.0,
  maxSpeed: 22,
};

/**
 * Control interface between a decision model and the ego vehicle.
 * acceleration: requested longitudinal acceleration in m/s^2 (negative = braking),
 *               clamped to [-maxBrake, maxAccel].
 * steering:     normalised front-wheel angle in [-1, 1] (positive = left), scaled by maxSteer.
 */
export interface DrivingAction {
  acceleration: number;
  steering: number;
}

