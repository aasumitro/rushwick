import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Observation } from '../ego/observation';
import { getProfile, PLATFORM_PROFILES, type PlatformProfile, type SensorModelConfig } from '../platform';
import { Simulation } from './simulation';

const registry = PLATFORM_PROFILES as Record<string, PlatformProfile>;
const ideal = getProfile('ideal');
const small = { seed: 6, warmupTime: 5, vehicleCount: 120, pedestrianCount: 200 };

/** Test-only profiles: exact sensors behind a model, a 0.1 s lidar delay, a 10 Hz lidar, and noise on every built channel. */
const PROFILES: Record<string, Partial<SensorModelConfig>> = {
  'test-exact': {},
  'test-late-lidar': { lidar: { ...ideal.sensors.lidar, latency: 0.1 } },
  'test-slow-lidar': { lidar: { ...ideal.sensors.lidar, rateHz: 10 } },
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

describe('localization', () => {
  it('computes the route from the perceived pose', () => {
    const sim = new Simulation({ ...small, profile: 'test-noisy' });
    sim.spawnEgo();
    let poseError = 0;
    for (let k = 0; k < 90; k++) {
      sim.step({ acceleration: 1.5, steering: 0 });
      const { ego, route } = sim.observe();
      const truth = sim.observeIdeal();
      poseError = Math.max(poseError, Math.hypot(ego.x - truth.ego.x, ego.y - truth.ego.y));
      // Waypoints mapped back to the world with the perceived pose lie on the route.
      for (const wp of route.waypoints.slice(0, 8)) {
        const x = ego.x + wp.x * Math.cos(ego.heading) - wp.y * Math.sin(ego.heading);
        const y = ego.y + wp.x * Math.sin(ego.heading) + wp.y * Math.cos(ego.heading);
        expect(sim.route!.path.project({ x, y }).distance).toBeLessThan(1e-6);
      }
    }
    expect(poseError).toBeGreaterThan(0.1);
    expect(poseError).toBeLessThan(3);
  });
});
