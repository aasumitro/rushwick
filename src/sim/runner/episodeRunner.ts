import type { DrivingAction, DrivingAgent } from '../agents';
import type { Observation } from '../ego/observation';
import type { EpisodeMetrics } from '../metrics';
import { Simulation, type SimConfigInput } from '../simulation';

export interface EpisodeOptions {
  /** Called every control step (e.g. to record observation/action pairs). */
  onStep?: (obs: Observation, action: DrivingAction, sim: Simulation) => void;
  /** Reuse an existing simulation instead of building a fresh city. */
  sim?: Simulation;
}

/** Run one closed-loop episode of `agent` and return its metrics. */
export function runEpisode(config: SimConfigInput, agent: DrivingAgent, opts: EpisodeOptions = {}): EpisodeMetrics {
  const sim = opts.sim ?? new Simulation(config);
  if (!sim.spawnEgo()) throw new Error('Could not place the ego vehicle');
  agent.reset?.();
  while (!sim.episodeDone) {
    const obs = sim.observe();
    const action = agent.act(obs);
    opts.onStep?.(obs, action, sim);
    sim.step(action);
  }
  return sim.episodeMetrics() as EpisodeMetrics;
}
