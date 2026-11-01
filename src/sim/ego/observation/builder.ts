import { observeAgents } from './agentSensor';
import { castLidar } from './lidar';
import { observeRoute } from './routeSensor';
import { DEFAULT_SENSOR_CONFIG, type SensorConfig } from './sensorConfig';
import type { Observation } from './types';
import type { WorldView } from './worldView';

/** Assemble the full observation for the current simulation state. */
export function buildObservation(w: WorldView, cfg: SensorConfig = DEFAULT_SENSOR_CONFIG): Observation {
  const { ego } = w;
  const p = ego.params;
  return {
    time: w.time,
    ego: {
      x: ego.x,
      y: ego.y,
      heading: ego.heading,
      speed: ego.speed,
      accel: ego.accel,
      steer: ego.steer,
      yawRate: ego.yawRate,
      length: p.length,
      width: p.width,
      wheelBase: p.wheelBase,
      maxSteer: p.maxSteer,
    },
    route: observeRoute(w, cfg),
    ...observeAgents(w, cfg),
    lidar: castLidar(w, cfg),
  };
}
