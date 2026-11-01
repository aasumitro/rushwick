import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RuleBasedAgent } from '../agents';
import { Fnv } from '../core/hash';
import { encodeObservation } from '../ego/observation';
import { getProfile, PLATFORM_PROFILES, type PlatformProfile, type SensorModelConfig } from '../platform';
import { Simulation } from './simulation';

const registry = PLATFORM_PROFILES as Record<string, PlatformProfile>;
const ideal = getProfile('ideal');
const small = { seed: 6, warmupTime: 5, vehicleCount: 120, pedestrianCount: 200 };

/** Test-only profiles: exact sensors behind a model, and noise and delay on every built channel. */
const PROFILES: Record<string, Partial<SensorModelConfig>> = {
  'test-exact': {},
  'test-noisy': {
    egoState: { ...ideal.sensors.egoState, speedStd: 0.05, accelStd: 0.1, yawRateStd: 0.005, yawBiasWalk: 0.001 },
    localization: { ...ideal.sensors.localization, latency: 0.05, posStd: 0.3, headingStd: 0.02, driftStd: 0.5, driftTau: 5 },
    lidar: { ...ideal.sensors.lidar, rateHz: 10, latency: 0.05, rangeStd: 0.05, dropout: 0.02 },
  },
};

beforeAll(() => {
  for (const [name, sensors] of Object.entries(PROFILES)) registry[name] = { ...ideal, name, sensors: { ...ideal.sensors, ...sensors } };
});
afterAll(() => {
  for (const name of Object.keys(PROFILES)) delete registry[name];
});

describe('SensorModel determinism', () => {
  /**
   * stateHash and the final sensed features after 300 expert steps, with
   * `calls` extra observe() calls per step. The expert acts on the exact view
   * unless `sensed`, so that call counts cannot influence its actions.
   */
  function run(profile: string, calls: number, sensed = false): { state: number; features: number } {
    const sim = new Simulation({ ...small, profile });
    sim.spawnEgo();
    const agent = new RuleBasedAgent();
    for (let i = 0; i < 300; i++) {
      for (let c = 0; c < calls; c++) sim.observe();
      sim.step(agent.act(sensed ? sim.observe() : sim.observeIdeal()));
    }
    const h = new Fnv();
    for (const v of encodeObservation(sim.observe())) h.mix(Math.round(v * 1e6));
    return { state: sim.stateHash(), features: h.value };
  }

  it.each(Object.keys(PROFILES))('does not depend on how often observe() is called (%s)', (profile) => {
    const once = run(profile, 1);
    expect(run(profile, 0)).toEqual(once);
    expect(run(profile, 3)).toEqual(once);
  });

  it('reproduces a run of the expert on noisy sensed observations', () => {
    expect(run('test-noisy', 0, true)).toEqual(run('test-noisy', 2, true));
    expect(run('test-noisy', 0, true)).not.toEqual(run('test-noisy', 0));
  });
});
