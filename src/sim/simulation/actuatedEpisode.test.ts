import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RuleBasedAgent } from '../agents';
import { getProfile, PLATFORM_PROFILES, type PlatformProfile } from '../platform';
import { Simulation } from './simulation';

const NAME = 'test-actuated';
const registry = PLATFORM_PROFILES as Record<string, PlatformProfile>;
const small = { seed: 4, warmupTime: 5, vehicleCount: 120, pedestrianCount: 200, profile: NAME };

beforeAll(() => {
  const ideal = getProfile('ideal');
  // 10 Hz control and 0.1 s (3 steps) of delay, otherwise exact.
  registry[NAME] = { ...ideal, name: NAME, actuators: { ...ideal.actuators, controlHz: 10, computeDelay: 0.1 } };
});
afterAll(() => {
  delete registry[NAME];
});

describe('Simulation with an actuator model', () => {
  it('exposes control ticks and delays the ego response', () => {
    const sim = new Simulation(small);
    expect(sim.spawnEgo()).toBe(true);
    const due: boolean[] = [];
    const speed: number[] = [];
    for (let k = 0; k < 7; k++) {
      due.push(sim.controlDue);
      sim.step({ acceleration: 2, steering: 0 });
      speed.push(sim.ego!.speed);
    }
    expect(due).toEqual([true, false, false, true, false, false, true]);
    expect(sim.commandDelay).toBeCloseTo(0.1, 9);
    expect(speed.slice(0, 3)).toEqual([0, 0, 0]);
    expect(speed[3]).toBeGreaterThan(0);
  });

  it('stays deterministic and differs from the exact ego', () => {
    const run = (profile: string) => {
      const sim = new Simulation({ ...small, profile });
      sim.spawnEgo();
      const agent = new RuleBasedAgent();
      for (let i = 0; i < 300; i++) sim.step(agent.act(sim.observe()));
      return sim.stateHash();
    };
    expect(run(NAME)).toBe(run(NAME));
    expect(run(NAME)).not.toBe(run('ideal'));
    const ideal = new Simulation({ ...small, profile: 'ideal' });
    ideal.spawnEgo();
    ideal.step({ acceleration: 1, steering: 0 });
    expect(ideal.commandDelay).toBe(0);
  });
});
