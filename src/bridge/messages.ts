import type { DrivingAction, EpisodeMetrics, Observation, SensorConfig } from '../sim';

/**
 * Bridge protocol v1 between Rushwick and a car program: one JSON object per
 * WebSocket message. The car program listens, Rushwick connects. Field names
 * follow ROS 2 messages so a ROS 2 bridge maps 1:1. Units on the wire are real
 * (m, m/s, m/s², s, rad); non-finite numbers (unknown time left, no TTC)
 * travel as `null`, because JSON has no NaN or Infinity.
 */
export const PROTOCOL_VERSION = 1;

/** lockstep: Rushwick waits for every command (deterministic); realtime: it steps at wall-clock pace. */
export type ClockMode = 'lockstep' | 'realtime';

/** Sent once after connecting. */
export interface HelloMessage {
  type: 'hello';
  protocol: number;
  /** FEATURE_VERSION of the encoder the observation is meant for. */
  featureVersion: number;
  profile: string;
  /** Sim meters per real meter. */
  scale: number;
  /** Physics step (s). */
  dt: number;
  /** Rate at which commands are accepted (Hz, at most 1/dt). */
  controlHz: number;
  mode: ClockMode;
  /** 'modeled': the sim adds the profile's compute delay; 'measured': compute happens for real (realtime). */
  latency: 'modeled' | 'measured';
  seed: number;
  /** Sensor config in sim units: what `encodeObservation()` needs after converting an observation to sim units. */
  sensors: SensorConfig;
}

/** sensor_msgs/LaserScan subset: ray i at angle_min + i · angle_increment, CCW from the heading. */
export interface LaserScan {
  angle_min: number;
  angle_increment: number;
  range_min: number;
  range_max: number;
  ranges: number[];
}

/** sensor_msgs/Imu subset: yaw rate (rad/s) and longitudinal acceleration (m/s²). */
export interface Imu {
  angular_velocity: { z: number };
  linear_acceleration: { x: number };
}

/** nav_msgs/Odometry subset: wheel speed (m/s). */
export interface Odometry {
  twist: { linear: { x: number } };
}

/** Sent every physics step. */
export interface FrameMessage {
  type: 'frame';
  /** Physics step number; the command for this frame echoes it. */
  seq: number;
  /** Simulation time (s), the car program's clock in lockstep mode. */
  stamp: number;
  /** Run the policy on this frame; on the others, resend the last command. */
  controlTick: boolean;
  /** The sensed observation (what the platform perceives), real units. */
  observation: Observation;
  scan: LaserScan;
  imu: Imu;
  odom: Odometry;
  /** The privileged teacher's action for this frame (real units); only with --teacher. */
  teacher?: DrivingAction;
}

export type EpisodeMessage =
  | { type: 'episode'; event: 'start'; index: number }
  | { type: 'episode'; event: 'end'; index: number; outcome: string; metrics: EpisodeMetrics };

export type RushwickMessage = HelloMessage | FrameMessage | EpisodeMessage;

/** The car's reply to a frame: acceleration (m/s², real units, negative brakes) and normalized steering (left positive). */
export interface CommandMessage {
  type: 'command';
  seq: number;
  acceleration: number;
  steering: number;
}
