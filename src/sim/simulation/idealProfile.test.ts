import { describe, expect, it } from 'vitest';
import { RuleBasedAgent } from '../agents';
import { Fnv } from '../core/hash';
import { DEFAULT_EGO_PARAMS } from '../ego/egoParams';
import { DEFAULT_SENSOR_CONFIG, encodeObservation } from '../ego/observation';
import { getProfile } from '../platform';
import { resolveConfig, type SimConfigInput } from './config';
import { Simulation } from './simulation';

const small: SimConfigInput = { seed: 5, warmupTime: 5, vehicleCount: 150, pedestrianCount: 250 };

/** State and feature fingerprints of 300 closed-loop steps with the rule-based expert. */
function fingerprint(input: SimConfigInput): { state: number; features: number } {
  const sim = new Simulation(input);
  expect(sim.spawnEgo()).toBe(true);
  const agent = new RuleBasedAgent();
  const h = new Fnv();
  for (let i = 0; i < 300; i++) {
    const obs = sim.observe();
    for (const v of encodeObservation(obs)) h.mix(Math.round(v * 1e6));
    sim.step(agent.act(obs));
  }
  return { state: sim.stateHash(), features: h.value };
}

/** Captured on main at 2429e95, before platform profiles existed. */
const BEFORE_PROFILES = { state: 3599151140, features: 812070251 };

describe('ideal platform profile', () => {
  it('is the default and resolves to the pre-profile config', () => {
    const cfg = resolveConfig();
    expect(cfg.profile).toBe('ideal');
    expect(resolveConfig({ profile: 'ideal' })).toEqual(cfg);
    expect(cfg.ego.params).toEqual(DEFAULT_EGO_PARAMS);
    expect(cfg.sensors).toEqual(DEFAULT_SENSOR_CONFIG);
  });

  it('reproduces the behavior from before platform profiles bit for bit', () => {
    expect(fingerprint(small)).toEqual(BEFORE_PROFILES);
    expect(fingerprint({ ...small, profile: 'ideal' })).toEqual(BEFORE_PROFILES);
  });

  it('lets explicit input win over the profile', () => {
    const params = { ...DEFAULT_EGO_PARAMS, maxSpeed: 10 };
    const cfg = resolveConfig({ ego: { params }, sensors: { lidarRange: 30 } });
    expect(cfg.ego.params).toBe(params);
    expect(cfg.sensors.lidarRange).toBe(30);
  });

  it('rejects an unknown profile and lists the valid names', () => {
    expect(() => getProfile('hovercraft')).toThrow(/Unknown platform profile 'hovercraft'.*ideal/);
    expect(() => new Simulation({ ...small, profile: 'hovercraft' })).toThrow(/Valid profiles/);
  });
});
