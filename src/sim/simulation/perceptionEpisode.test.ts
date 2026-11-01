import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RuleBasedAgent } from '../agents';
import { getProfile, PLATFORM_PROFILES, type PlatformProfile } from '../platform';
import { Simulation } from './simulation';

const NAME = 'test-perception';
const registry = PLATFORM_PROFILES as Record<string, PlatformProfile>;

beforeAll(() => {
  const ideal = getProfile('ideal');
  // Exact detection except occlusion; lights visible within 25 m, no time left.
  registry[NAME] = {
    ...ideal,
    name: NAME,
    sensors: {
      ...ideal.sensors,
      privileged: false,
      objects: { ...ideal.sensors.objects, occlusion: true },
      signals: { ...ideal.sensors.signals, range: 25 },
    },
  };
});
afterAll(() => {
  delete registry[NAME];
});

describe('perception in a running episode', () => {
  it('hides occluded road users and only reports lights within range', () => {
    const sim = new Simulation({ seed: 3, warmupTime: 10, profile: NAME, sensors: { maxAgents: 200 } });
    expect(sim.spawnEgo()).toBe(true);
    const agent = new RuleBasedAgent();
    let hidden = 0;
    let unknown = 0;
    for (let k = 0; k < 600 && !sim.episodeDone; k++) {
      const sensed = sim.observe();
      const truth = sim.observeIdeal();
      const ids = (o: typeof sensed) => o.vehicles.map((a) => a.id).concat(o.pedestrians.map((a) => -1 - a.id));
      const seen = new Set(ids(sensed));
      const all = new Set(ids(truth));
      for (const id of seen) expect(all.has(id)).toBe(true);
      hidden += all.size - seen.size;
      const stop = sensed.route.nextStop;
      if (stop && stop.light !== 'none') {
        expect(stop.timeLeft).toBeNaN();
        if (stop.distance > 25) expect(stop.light).toBe('unknown');
        else expect(stop.light).toBe(truth.route.nextStop!.light);
        if (stop.light === 'unknown') unknown++;
      }
      sim.step(agent.act(sensed));
    }
    expect(hidden).toBeGreaterThan(0);
    expect(unknown).toBeGreaterThan(0);
  });
});
