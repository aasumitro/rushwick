import type { LightState } from '../../traffic/signals';
import type { VehicleKind } from '../../traffic/vehicles';

/** Another road user expressed in the ego frame (x forward, y left). */
export interface AgentObservation {
  id: number;
  type: 'vehicle' | 'pedestrian';
  kind: VehicleKind | 'pedestrian';
  x: number;
  y: number;
  /** Heading relative to the ego heading. */
  heading: number;
  /** Absolute speed (m/s). */
  speed: number;
  /** Velocity relative to the ego, in the ego frame. */
  vx: number;
  vy: number;
  length: number;
  width: number;
}

export interface Waypoint {
  x: number;
  y: number;
  speedLimit: number;
}

export interface StopObservation {
  /** From the ego's front bumper to the stop line (m). */
  distance: number;
  /** 'none' at unsignalized junctions; 'unknown' when a realistic platform has not perceived the light. */
  light: LightState | 'none' | 'unknown';
  /**
   * Seconds until the light changes (privileged: real AVs must infer this).
   * NaN when the platform cannot know it (every profile except `ideal`).
   */
  timeLeft: number;
}

export interface EgoStateObservation {
  x: number;
  y: number;
  heading: number;
  speed: number;
  accel: number;
  steer: number;
  yawRate: number;
  length: number;
  width: number;
  wheelBase: number;
  maxSteer: number;
}

export interface RouteObservation {
  /** waypoints[0] is the ego's projection on the route (ego frame). */
  waypoints: Waypoint[];
  /** Positive when the ego is left of the route. */
  lateralError: number;
  /** Route tangent minus ego heading (rad). */
  headingError: number;
  progress: number;
  remaining: number;
  speedLimit: number;
  nextStop: StopObservation | null;
}

/** Everything a decision model sees each control step. */
export interface Observation {
  time: number;
  ego: EgoStateObservation;
  route: RouteObservation;
  vehicles: AgentObservation[];
  pedestrians: AgentObservation[];
  /** Range per ray (m); ray i at angle 2*PI*i/N from the ego heading (CCW). */
  lidar: number[];
}
