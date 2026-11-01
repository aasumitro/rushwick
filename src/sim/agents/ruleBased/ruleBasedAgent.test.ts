import { describe, expect, it } from 'vitest';
import { runEpisode } from '../../runner/episodeRunner';
import { Simulation } from '../../simulation';
import { RuleBasedAgent } from './ruleBasedAgent';

/** The expert must drive cleanly: it is the baseline and the imitation-learning teacher. */
describe.each(['left', 'right'] as const)('RuleBasedAgent (%s-hand traffic)', (drivingSide) => {
  it('completes episodes without collisions, red-light running or curb strikes', { timeout: 240_000 }, () => {
    const sim = new Simulation({ seed: 31, city: { drivingSide }, warmupTime: 10, ego: { minRouteDistance: 220 } });
    const results = [0, 1, 2].map(() => runEpisode({}, new RuleBasedAgent(), { sim }));
    for (const m of results) {
      expect(m.collisionsVehicle + m.collisionsPedestrian).toBe(0);
      expect(m.redLightViolations).toBe(0);
      expect(m.offRoadEvents).toBe(0);
      expect(m.outcome).not.toBe('off_route');
    }
    expect(results.filter((m) => m.outcome === 'success').length).toBeGreaterThanOrEqual(2);
  });
});
