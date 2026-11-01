import type { AgentObservation, EgoStateObservation, Observation, RouteObservation, StopObservation } from '../../ego/observation';

export type EgoReading = Pick<EgoStateObservation, 'speed' | 'accel' | 'steer' | 'yawRate'>;

/** Pose and the route as seen from it. */
export interface PoseReading {
  x: number;
  y: number;
  heading: number;
  route: RouteObservation;
  stopId: number;
}

export interface ObjectsReading {
  vehicles: AgentObservation[];
  pedestrians: AgentObservation[];
}

export interface SignalReading extends Pick<StopObservation, 'light' | 'timeLeft'> {
  stopId: number;
}

/**
 * One sensed Observation from the latest reading of every channel. The light
 * reading only applies to the stop line it was taken for.
 */
export function assemble(time: number, body: EgoStateObservation, ego: EgoReading, pose: PoseReading, objects: ObjectsReading, lidar: number[], signal: SignalReading): Observation {
  const stop = pose.route.nextStop;
  const nextStop = stop && signal.stopId === pose.stopId ? { ...stop, light: signal.light, timeLeft: signal.timeLeft } : stop;
  return {
    time,
    ego: { ...body, ...ego, x: pose.x, y: pose.y, heading: pose.heading },
    route: { ...pose.route, nextStop },
    vehicles: objects.vehicles,
    pedestrians: objects.pedestrians,
    lidar,
  };
}
