import type { AgentObservation, DrivingAction, EpisodeMetrics, Observation } from '../sim';

type Convert = (v: number) => number;

const agent = (a: AgentObservation, f: Convert): AgentObservation => ({
  ...a,
  x: f(a.x),
  y: f(a.y),
  speed: f(a.speed),
  vx: f(a.vx),
  vy: f(a.vy),
  length: f(a.length),
  width: f(a.width),
});

/** Apply `f` to every length, speed and acceleration of an observation; angles, rates, times and states stay. */
function mapObservation(o: Observation, f: Convert): Observation {
  const { ego, route } = o;
  const stop = route.nextStop;
  return {
    time: o.time,
    ego: { ...ego, x: f(ego.x), y: f(ego.y), speed: f(ego.speed), accel: f(ego.accel), length: f(ego.length), width: f(ego.width), wheelBase: f(ego.wheelBase) },
    route: {
      ...route,
      waypoints: route.waypoints.map((w) => ({ x: f(w.x), y: f(w.y), speedLimit: f(w.speedLimit) })),
      lateralError: f(route.lateralError),
      progress: f(route.progress),
      remaining: f(route.remaining),
      speedLimit: f(route.speedLimit),
      nextStop: stop && { ...stop, distance: f(stop.distance) },
    },
    vehicles: o.vehicles.map((a) => agent(a, f)),
    pedestrians: o.pedestrians.map((a) => agent(a, f)),
    lidar: o.lidar.map(f),
  };
}

/** Sim units to real units (design decision D1): lengths, speeds and accelerations are divided by `scale`. */
export const observationToReal = (o: Observation, scale: number): Observation => mapObservation(o, (v) => v / scale);

/** Real units to sim units, the inverse of observationToReal (what a car program does before encoding features). */
export const observationToSim = (o: Observation, scale: number): Observation => mapObservation(o, (v) => v * scale);

/** An action in real units (as on the wire) to sim units: acceleration times `scale`; normalized steering stays. */
export const actionToSim = (a: DrivingAction, scale: number): DrivingAction => ({ acceleration: a.acceleration * scale, steering: a.steering });

export const actionToReal = (a: DrivingAction, scale: number): DrivingAction => ({ acceleration: a.acceleration / scale, steering: a.steering });

/** Episode metrics in real units: distances, speeds, accelerations and jerks divided by `scale`. */
export function metricsToReal(m: EpisodeMetrics, scale: number): EpisodeMetrics {
  const f = (v: number) => v / scale;
  return {
    ...m,
    distance: f(m.distance),
    routeLength: f(m.routeLength),
    routeProgress: f(m.routeProgress),
    meanSpeed: f(m.meanSpeed),
    maxAbsJerk: f(m.maxAbsJerk),
    rmsJerk: f(m.rmsJerk),
    maxLateralAccel: f(m.maxLateralAccel),
  };
}
