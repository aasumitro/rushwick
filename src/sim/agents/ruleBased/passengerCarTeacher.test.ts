import { describe, expect, it } from 'vitest';
import { Simulation } from '../../simulation';
import { RuleBasedAgent } from './ruleBasedAgent';

/**
 * The privileged teacher (exact observations, the passenger car's delayed and
 * lagging actuators) must drive as safely as the expert on `ideal`
 * (ruleBasedAgent.test.ts uses the same city). Safety gates; success does not:
 * under actuator lag the expert stops on a crosswalk more often and can end
 * up waiting for the pedestrians it blocks (stuck), as the README baseline shows.
 */
describe.each(['left', 'right'] as const)('RuleBasedAgent as privileged teacher on passenger-car (%s-hand traffic)', (drivingSide) => {
  it('completes episodes without collisions, red-light running or curb strikes', { timeout: 240_000 }, () => {
    const sim = new Simulation({ seed: 31, profile: 'passenger-car', city: { drivingSide }, warmupTime: 10, ego: { minRouteDistance: 220 } });
    const results = [0, 1, 2].map(() => {
      expect(sim.spawnEgo()).toBe(true);
      const agent = new RuleBasedAgent();
      while (!sim.episodeDone) sim.step(agent.act(sim.observeIdeal()));
      return sim.episodeMetrics()!;
    });
    for (const m of results) {
      expect(m.collisionsVehicle + m.collisionsPedestrian).toBe(0);
      expect(m.redLightViolations).toBe(0);
      expect(m.offRoadEvents).toBe(0);
      expect(m.outcome).not.toBe('off_route');
    }
    expect(results.some((m) => m.outcome === 'success')).toBe(true);
  });
});
