import { describe, expect, it } from 'vitest';
import { Simulation } from '../../simulation';
import { encodeObservation, featureSize } from './encoder';

describe('observation encoder', () => {
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
});
