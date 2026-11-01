export interface SensorConfig {
  lidarRays: number;
  lidarRange: number;
  /** Max agents of each type reported (nearest first). */
  maxAgents: number;
  agentRadius: number;
  waypoints: number;
  /** Spacing of the first `denseWaypoints` waypoints (m), for precise curvature near the car. */
  denseSpacing: number;
  denseWaypoints: number;
  /** Spacing of the remaining waypoints (m). */
  waypointSpacing: number;
}

export const DEFAULT_SENSOR_CONFIG: SensorConfig = {
  lidarRays: 32,
  lidarRange: 50,
  maxAgents: 10,
  agentRadius: 60,
  waypoints: 24,
  denseSpacing: 1.0,
  denseWaypoints: 8,
  waypointSpacing: 2.5,
};

/** Arc-length offset (from the ego's projection on the route) of waypoint i. */
export function waypointOffset(i: number, cfg: SensorConfig = DEFAULT_SENSOR_CONFIG): number {
  if (i < cfg.denseWaypoints) return i * cfg.denseSpacing;
  return (cfg.denseWaypoints - 1) * cfg.denseSpacing + (i - cfg.denseWaypoints + 1) * cfg.waypointSpacing;
}
