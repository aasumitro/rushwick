import { describe, expect, it } from 'vitest';
import { Simulation } from '../../simulation';
import { encodeObservation, FEATURE_VERSION, featureSize } from './encoder';

describe('observation encoder', () => {
  it('pins the layout to its version (bump FEATURE_VERSION and the golden file together with the layout)', () => {
    expect([FEATURE_VERSION, featureSize()]).toEqual([1, 258]);
  });

  it('produces a fixed-length, finite, roughly unit-scaled vector', () => {
    const sim = new Simulation({ seed: 9, warmupTime: 5, vehicleCount: 150, pedestrianCount: 200 });
    sim.spawnEgo();
    for (let i = 0; i < 60; i++) sim.step({ acceleration: 1.5, steering: 0 });
    const f = encodeObservation(sim.observe());
    expect(f.length).toBe(featureSize());
    for (const v of f) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThan(10);
    }
  });

  it('encodes an unperceived light as all-zero light flags and an unknown time left as 1', () => {
    const sim = new Simulation({ seed: 9, warmupTime: 5, vehicleCount: 50, pedestrianCount: 50 });
    sim.spawnEgo();
    const obs = sim.observe();
    const stop = 5 + 24 * 3 + 3; // ego | waypoints | route
    const f = encodeObservation({ ...obs, route: { ...obs.route, nextStop: { distance: 37.5, light: 'unknown', timeLeft: Number.NaN } } });
    expect(Array.from(f.slice(stop, stop + 6))).toEqual([1, 0.25, 0, 0, 0, 1]);
  });
});
