import { describe, expect, it } from 'vitest';
import { backgroundConflicts } from './diagnostics';
import { Simulation } from './simulation';

const small = { warmupTime: 5, vehicleCount: 220, pedestrianCount: 400 };

describe('Simulation', () => {
  it('is deterministic: same seed, same state; different seed, different state', () => {
    const run = (seed: number) => {
      const sim = new Simulation({ ...small, seed });
      for (let i = 0; i < 300; i++) sim.step(null);
      return sim.stateHash();
    };
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
  });

  it.each(['left', 'right'] as const)('keeps background traffic collision-free and flowing (%s-hand)', (drivingSide) => {
    const sim = new Simulation({ ...small, seed: 21, city: { drivingSide }, jaywalkProbability: 0.06 });
    let vehicleOverlaps = 0;
    let pedestrianOverlaps = 0;
    for (let i = 0; i < 30 * 90; i++) {
      sim.step(null);
      if (i % 15 !== 0) continue;
      const c = backgroundConflicts(sim);
      vehicleOverlaps += c.vehicleVehicle.length;
      pedestrianOverlaps += c.pedestrianVehicle.length;
    }
    expect(vehicleOverlaps).toBe(0);
    expect(pedestrianOverlaps).toBe(0);
    const moved = sim.vehicles.filter((v) => v.odometer > 30).length;
    expect(moved / sim.vehicles.length).toBeGreaterThan(0.85);
    expect(sim.vehicles.filter((v) => v.stoppedTime > 80)).toEqual([]);
  });

  it('spawns an ego with a route and produces observations', () => {
    const sim = new Simulation({ ...small, seed: 2 });
    expect(sim.spawnEgo()).toBe(true);
    const obs = sim.observe();
    expect(obs.route.remaining).toBeGreaterThan(250);
    expect(obs.lidar).toHaveLength(sim.config.sensors.lidarRays);
    expect(obs.route.waypoints[0]!.x).toBeCloseTo(0, 0);
  });
});
