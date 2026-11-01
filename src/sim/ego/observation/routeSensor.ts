import { toLocal, wrapAngle } from '../../core/vec2';
import type { ConnectorSegment } from '../../world/types';
import { waypointOffset, type SensorConfig } from './sensorConfig';
import type { RouteObservation, StopObservation, Waypoint } from './types';
import type { WorldView } from './worldView';

/** A 2D pose in the world frame (m, rad). */
export interface Pose {
  x: number;
  y: number;
  heading: number;
}

/**
 * Route-following information: waypoints, tracking errors and the next stop
 * line, seen from `pose` at route arc length `progress`. Localization passes a
 * perceived pose and the progress it implies; both default to the truth.
 */
export function observeRoute(w: WorldView, cfg: SensorConfig, pose: Pose = w.ego, progress = w.progress): RouteObservation {
  const { route } = w;
  const proj = route.path.project(pose, Math.max(0, progress - 2), progress + 6);
  const waypoints: Waypoint[] = [];
  for (let i = 0; i < cfg.waypoints; i++) {
    const s = Math.min(route.length, progress + waypointOffset(i, cfg));
    const p = route.path.sample(s);
    const l = toLocal(p.x, p.y, pose.x, pose.y, pose.heading);
    waypoints.push({ x: l.x, y: l.y, speedLimit: route.speedLimitAt(s) });
  }
  return {
    waypoints,
    lateralError: proj.lateral,
    headingError: wrapAngle(route.path.sample(progress).heading - pose.heading),
    progress,
    remaining: Math.max(0, route.length - progress),
    speedLimit: route.speedLimitAt(progress),
    nextStop: observeStop(w, progress),
  };
}

function observeStop(w: WorldView, progress: number): StopObservation | null {
  const half = w.ego.params.length / 2;
  const stop = w.route.nextStop(progress + half);
  if (!stop) return null;
  const conn = w.city.segments[stop.connector] as ConnectorSegment;
  const signalised = w.signals.isSignalized(conn.nodeId);
  return {
    distance: stop.s - progress - half,
    light: signalised ? w.signals.connectorState(conn) : 'none',
    timeLeft: signalised ? w.signals.connectorTimeLeft(conn) : 0,
  };
}
