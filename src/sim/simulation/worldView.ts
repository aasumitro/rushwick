import type { WorldView } from '../ego/observation';
import type { Vehicle } from '../traffic/vehicles';
import type { EgoEpisode } from './egoEpisode';
import type { Simulation } from './simulation';

/** The read-only slice of the simulation that the ego's sensors may use. */
export function worldView(sim: Simulation, episode: EgoEpisode): WorldView {
  return {
    time: sim.time,
    city: sim.city,
    signals: sim.signals,
    vehicles: sim.vehicles,
    peds: sim.pedestrians.peds,
    vehicleGrid: sim.index.vehicleGrid,
    pedGrid: sim.index.pedGrid,
    ego: episode.ego,
    route: episode.route,
    progress: episode.progress,
    vehicleObb: (v: Vehicle) => sim.traffic.obbOf(v),
  };
}
