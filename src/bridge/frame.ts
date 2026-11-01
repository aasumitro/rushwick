import { FEATURE_VERSION, type DrivingAction, type EpisodeMetrics, type Simulation } from '../sim';
import { PROTOCOL_VERSION, type ClockMode, type CommandMessage, type EpisodeMessage, type FrameMessage, type HelloMessage } from './messages';
import { actionToReal, actionToSim, metricsToReal, observationToReal } from './units';

/** The hello message for a simulation; a realtime run should use a simulation with `latency: 'measured'`. */
export function buildHello(sim: Simulation, mode: ClockMode): HelloMessage {
  const { config, platform } = sim;
  return {
    type: 'hello',
    protocol: PROTOCOL_VERSION,
    featureVersion: FEATURE_VERSION,
    profile: config.profile,
    scale: platform.scale,
    dt: config.dt,
    controlHz: Math.min(platform.actuators.controlHz, 1 / config.dt),
    mode,
    latency: config.latency,
    seed: config.seed,
    sensors: config.sensors,
  };
}

/**
 * The frame for the current step: the sensed observation in real units plus
 * driver-shaped copies of the lidar scan, IMU and wheel odometry. `teacher` is
 * the privileged teacher's action in sim units.
 */
export function buildFrame(sim: Simulation, teacher?: DrivingAction): FrameMessage {
  const scale = sim.platform.scale;
  const obs = observationToReal(sim.observe(), scale);
  const rays = obs.lidar.length;
  const frame: FrameMessage = {
    type: 'frame',
    seq: sim.steps,
    stamp: sim.time,
    controlTick: sim.controlDue,
    observation: obs,
    scan: {
      angle_min: 0,
      angle_increment: (2 * Math.PI) / rays,
      range_min: sim.platform.sensors.lidar.minRange / scale,
      range_max: sim.config.sensors.lidarRange / scale,
      ranges: obs.lidar,
    },
    imu: { angular_velocity: { z: obs.ego.yawRate }, linear_acceleration: { x: obs.ego.accel } },
    odom: { twist: { linear: { x: obs.ego.speed } } },
  };
  if (teacher) frame.teacher = actionToReal(teacher, scale);
  return frame;
}

export const episodeStart = (index: number): EpisodeMessage => ({ type: 'episode', event: 'start', index });

export const episodeEnd = (index: number, metrics: EpisodeMetrics, scale: number): EpisodeMessage => ({
  type: 'episode',
  event: 'end',
  index,
  outcome: metrics.outcome,
  metrics: metricsToReal(metrics, scale),
});

/** The action a command asks for, in sim units. */
export const commandToAction = (cmd: CommandMessage, scale: number): DrivingAction => actionToSim(cmd, scale);
