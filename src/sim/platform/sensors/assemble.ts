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
 * reading only applies to the stop line it was taken for: when localization has
 * already moved on to the next stop line, that light is still 'unknown'.
 */
export function assemble(time: number, body: EgoStateObservation, ego: EgoReading, pose: PoseReading, objects: ObjectsReading, lidar: number[], signal: SignalReading): Observation {
  const stop = pose.route.nextStop;
  let nextStop = stop;
  if (stop && signal.stopId === pose.stopId) nextStop = { ...stop, light: signal.light, timeLeft: signal.timeLeft };
  else if (stop && stop.light !== 'none') nextStop = { ...stop, light: 'unknown', timeLeft: Number.NaN };
  return {
    time,
    ego: { ...body, ...ego, x: pose.x, y: pose.y, heading: pose.heading },
    route: { ...pose.route, nextStop },
    vehicles: objects.vehicles,
    pedestrians: objects.pedestrians,
    lidar,
  };
}
