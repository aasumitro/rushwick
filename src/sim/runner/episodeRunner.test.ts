import { describe, expect, it } from 'vitest';
import { RuleBasedAgent, type DrivingAgent } from '../agents';
import type { Observation } from '../ego/observation';
import { Simulation } from '../simulation';
import { runEpisode } from './episodeRunner';

describe('runEpisode', () => {
  it('lets a privileged teacher act on the exact view while onStep gets the sensed one', () => {
    const sim = new Simulation({ seed: 1, profile: 'rc-pi' });
    const expert = new RuleBasedAgent();
    let acted: Observation | null = null;
    const spy: DrivingAgent = { name: 'spy', act: (o) => expert.act((acted = o)) };
    let steps = 0;
    let differ = 0;
    const m = runEpisode({}, spy, {
      sim,
      privileged: true,
      onStep: (obs) => {
        expect(obs).toBe(sim.observe());
        expect(acted).toEqual(sim.observeIdeal());
        steps++;
        if (JSON.stringify(obs) !== JSON.stringify(acted)) differ++;
      },
    });
    expect(m.outcome).toBe('success');
    expect(steps).toBeGreaterThan(0);
    expect(differ).toBe(steps);
  });
});
