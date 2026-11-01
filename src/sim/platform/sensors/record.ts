import { buildObservation, type Observation, type SensorConfig, type WorldView } from '../../ego/observation';
import type { PoseReading } from './assemble';

/** What the world looked like at one physics step of the episode. */
export interface SensorRecord {
  /** Physics steps since spawn. */
  step: number;
  /** The exact observation of the true state. */
  ideal: Observation;
  /** Connector of the true next stop line (-1 when none), so a late light reading is matched to its own stop. */
  stopId: number;
  /** Perceived pose and the route seen from it, drawn at record time (localization). */
  pose: PoseReading;
  /** Newest commanded front-wheel angle (rad), for servos without angle feedback. */
  commandedSteer: number;
}

export function makeRecord(w: WorldView, step: number, cfg: SensorConfig, pose: PoseReading, commandedSteer: number): SensorRecord {
  const stop = w.route.nextStop(w.progress + w.ego.params.length / 2);
  return { step, ideal: buildObservation(w, cfg), stopId: stop ? stop.connector : -1, pose, commandedSteer };
}
