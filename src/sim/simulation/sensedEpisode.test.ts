import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RuleBasedAgent } from '../agents';
import { Fnv } from '../core/hash';
import { encodeObservation, type Observation } from '../ego/observation';
import { getProfile, PLATFORM_PROFILES, type PlatformProfile, type SensorModelConfig } from '../platform';
import { Simulation } from './simulation';

const registry = PLATFORM_PROFILES as Record<string, PlatformProfile>;
const ideal = getProfile('ideal');
const small = { seed: 6, warmupTime: 5, vehicleCount: 120, pedestrianCount: 200 };

/** Test-only profiles: exact sensors behind a model, a 0.1 s lidar delay, and a 10 Hz lidar. */
const PROFILES: Record<string, Partial<SensorModelConfig>> = {
  'test-exact': {},
  'test-late-lidar': { lidar: { ...ideal.sensors.lidar, latency: 0.1 } },
  'test-slow-lidar': { lidar: { ...ideal.sensors.lidar, rateHz: 10 } },
};

beforeAll(() => {
  for (const [name, sensors] of Object.entries(PROFILES)) registry[name] = { ...ideal, name, sensors: { ...ideal.sensors, ...sensors } };
});
afterAll(() => {
  for (const name of Object.keys(PROFILES)) delete registry[name];
});

/** Sensed and ideal observations at spawn and after each of `n` steps of a fixed maneuver. */
function trace(profile: string, n: number): { sensed: Observation[]; ideal: Observation[] } {
  const sim = new Simulation({ ...small, profile });
  expect(sim.spawnEgo()).toBe(true);
  const out = { sensed: [sim.observe()], ideal: [sim.observeIdeal()] };
  for (let k = 0; k < n; k++) {
    sim.step({ acceleration: 1.5, steering: 0.1 });
    out.sensed.push(sim.observe());
    out.ideal.push(sim.observeIdeal());
  }
  return out;
}

describe('SensorModel timing', () => {
  it('reproduces the ideal observation when every channel is exact', () => {
    const t = trace('test-exact', 60);
    expect(t.sensed).toEqual(t.ideal);
  });

  it('delays a channel by its latency in whole steps', () => {
    const t = trace('test-late-lidar', 20);
    t.sensed.forEach((o, k) => expect(o.lidar).toEqual(t.ideal[Math.max(0, k - 3)]!.lidar));
    expect(t.sensed.map((o) => o.route)).toEqual(t.ideal.map((o) => o.route));
  });

  it('holds a channel between samples', () => {
    const t = trace('test-slow-lidar', 20);
    t.sensed.forEach((o, k) => expect(o.lidar).toEqual(t.ideal[k - (k % 3)]!.lidar));
  });
});

describe('SensorModel determinism', () => {
  /** stateHash and the final sensed features after 300 expert steps, calling observe() `calls` times per step. */
  function run(profile: string, calls: number): { state: number; features: number } {
    const sim = new Simulation({ ...small, profile });
    sim.spawnEgo();
    const agent = new RuleBasedAgent();
    for (let i = 0; i < 300; i++) {
      for (let c = 0; c < calls; c++) sim.observe();
      // The expert acts on the exact view so its actions do not depend on `calls`.
      sim.step(agent.act(sim.observeIdeal()));
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
});
