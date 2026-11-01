import { DEFAULT_SENSOR_CONFIG, type SensorConfig } from './sensorConfig';
import type { Observation } from './types';

/**
 * Version of the `encodeObservation()` layout and scaling. Bump it whenever
 * either changes: it is written into recorded JSONL rows, the encoder golden
 * file and the bridge `hello` message, so stale datasets and models are caught.
 */
export const FEATURE_VERSION = 1;

const EGO_F = 5;
const WP_F = 3;
const ROUTE_F = 3;
const STOP_F = 6;
const VEH_F = 9;
const PED_F = 5;

export function featureSize(cfg: SensorConfig = DEFAULT_SENSOR_CONFIG): number {
  return EGO_F + cfg.waypoints * WP_F + ROUTE_F + STOP_F + cfg.maxAgents * (VEH_F + PED_F) + cfg.lidarRays;
}

/**
 * Fixed-length, roughly unit-scaled feature vector for lightweight models
 * (MLPs, small transformers, tree ensembles). Layout:
 *   ego(5) | waypoints(N*3) | route(3) | stop(6) | vehicles(K*9) | pedestrians(K*5) | lidar(R)
 * Missing agents are zero-padded with a presence flag of 0.
 */
export function encodeObservation(obs: Observation, cfg: SensorConfig = DEFAULT_SENSOR_CONFIG): Float32Array {
  const f = new Float32Array(featureSize(cfg));
  let i = 0;
  f[i++] = obs.ego.speed / 20;
  f[i++] = obs.ego.accel / 5;
  f[i++] = obs.ego.steer / obs.ego.maxSteer;
  f[i++] = obs.ego.yawRate;
  f[i++] = obs.route.speedLimit / 20;
  for (let k = 0; k < cfg.waypoints; k++) {
    const wp = obs.route.waypoints[k];
    f[i++] = wp ? wp.x / 50 : 0;
    f[i++] = wp ? wp.y / 50 : 0;
    f[i++] = wp ? wp.speedLimit / 20 : 0;
  }
  f[i++] = obs.route.lateralError / 5;
  f[i++] = obs.route.headingError / Math.PI;
  f[i++] = Math.min(obs.route.remaining, 1000) / 1000;
  const st = obs.route.nextStop;
  f[i++] = st ? 1 : 0;
  f[i++] = st ? Math.min(st.distance, 150) / 150 : 1;
  f[i++] = st?.light === 'green' || st?.light === 'none' ? 1 : 0;
  f[i++] = st?.light === 'yellow' ? 1 : 0;
  f[i++] = st?.light === 'red' ? 1 : 0;
  f[i++] = st && Number.isFinite(st.timeLeft) ? Math.min(st.timeLeft, 60) / 60 : 1;
  for (let k = 0; k < cfg.maxAgents; k++) {
    const a = obs.vehicles[k];
    f[i++] = a ? 1 : 0;
    f[i++] = a ? a.x / 50 : 0;
    f[i++] = a ? a.y / 50 : 0;
    f[i++] = a ? Math.cos(a.heading) : 0;
    f[i++] = a ? Math.sin(a.heading) : 0;
    f[i++] = a ? a.vx / 20 : 0;
    f[i++] = a ? a.vy / 20 : 0;
    f[i++] = a ? a.length / 10 : 0;
    f[i++] = a ? a.width / 3 : 0;
  }
  for (let k = 0; k < cfg.maxAgents; k++) {
    const a = obs.pedestrians[k];
    f[i++] = a ? 1 : 0;
    f[i++] = a ? a.x / 30 : 0;
    f[i++] = a ? a.y / 30 : 0;
    f[i++] = a ? a.vx / 3 : 0;
    f[i++] = a ? a.vy / 3 : 0;
  }
  for (let k = 0; k < cfg.lidarRays; k++) f[i++] = (obs.lidar[k] ?? cfg.lidarRange) / cfg.lidarRange;
  return f;
}
