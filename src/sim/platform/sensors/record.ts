import { buildObservation, type Observation, type SensorConfig, type WorldView } from '../../ego/observation';

/** What the world looked like to perfect sensors at one physics step of the episode. */
export interface SensorRecord {
  /** Physics steps since spawn. */
  step: number;
  ideal: Observation;
  /** Connector of the next stop line on the route (-1 when none), so a late light reading is matched to its own stop. */
  stopId: number;
}

export function makeRecord(w: WorldView, step: number, cfg: SensorConfig): SensorRecord {
  const stop = w.route.nextStop(w.progress + w.ego.params.length / 2);
  return { step, ideal: buildObservation(w, cfg), stopId: stop ? stop.connector : -1 };
}
