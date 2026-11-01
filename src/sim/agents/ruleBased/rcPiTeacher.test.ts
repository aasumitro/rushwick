import { describe, expect, it } from 'vitest';
import { Simulation } from '../../simulation';
import { RuleBasedAgent } from './ruleBasedAgent';

/**
 * The privileged teacher (exact observations, the platform's actuators) must
 * drive the rc-pi placeholder track cleanly, like the expert on `ideal`.
 * Seeds 1–3 × 3 episodes, as in the README baseline.
 */
describe.each(['left', 'right'] as const)('RuleBasedAgent as privileged teacher on rc-pi (%s-hand traffic)', (drivingSide) => {
  it('completes every episode without collisions, red-light running or curb strikes', () => {
    for (const seed of [1, 2, 3]) {
      const sim = new Simulation({ seed, profile: 'rc-pi', city: { drivingSide } });
      for (let ep = 0; ep < 3; ep++) {
        expect(sim.spawnEgo()).toBe(true);
        const agent = new RuleBasedAgent();
        while (!sim.episodeDone) sim.step(agent.act(sim.observeIdeal()));
        const m = sim.episodeMetrics()!;
        expect(m.collisionsVehicle + m.collisionsPedestrian + m.redLightViolations + m.offRoadEvents).toBe(0);
        expect(m.outcome).toBe('success');
      }
    }
  });
});
