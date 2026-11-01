import { toLocal, wrapAngle } from '../../core/vec2';
import type { ConnectorSegment } from '../../world/types';
import { waypointOffset, type SensorConfig } from './sensorConfig';
import type { RouteObservation, StopObservation, Waypoint } from './types';
import type { WorldView } from './worldView';

/** Route-following information: waypoints, tracking errors and the next stop line. */
export function observeRoute(w: WorldView, cfg: SensorConfig): RouteObservation {
  const { ego, route, progress } = w;
  const proj = route.path.project(ego, Math.max(0, progress - 2), progress + 6);
  const waypoints: Waypoint[] = [];
  for (let i = 0; i < cfg.waypoints; i++) {
    const s = Math.min(route.length, progress + waypointOffset(i, cfg));
    const p = route.path.sample(s);
    const l = toLocal(p.x, p.y, ego.x, ego.y, ego.heading);
    waypoints.push({ x: l.x, y: l.y, speedLimit: route.speedLimitAt(s) });
  }
  return {
    waypoints,
    lateralError: proj.lateral,
    headingError: wrapAngle(route.path.sample(progress).heading - ego.heading),
    progress,
    remaining: Math.max(0, route.length - progress),
    speedLimit: route.speedLimitAt(progress),
    nextStop: observeStop(w),
  };
}

function observeStop(w: WorldView): StopObservation | null {
  const half = w.ego.params.length / 2;
  const stop = w.route.nextStop(w.progress + half);
  if (!stop) return null;
  const conn = w.city.segments[stop.connector] as ConnectorSegment;
  const signalised = w.signals.isSignalized(conn.nodeId);
  return {
    distance: stop.s - w.progress - half,
    light: signalised ? w.signals.connectorState(conn) : 'none',
    timeLeft: signalised ? w.signals.connectorTimeLeft(conn) : 0,
  };
}
