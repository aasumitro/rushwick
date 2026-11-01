import { describe, expect, it } from 'vitest';
import { resolveConfig, Simulation } from '../../simulation';
import { isDrivable } from '../../world/queries';
import type { City, LaneSegment } from '../../world/types';
import { generateCity } from '../../world/generator';

/** Segments reachable from `start` along legal moves (no lane changes on single-lane roads). */
function reachable(city: City, start: number): number {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) for (const n of city.segments[stack.pop()!]!.next) if (!seen.has(n) && seen.add(n)) stack.push(n);
  return seen.size;
}

describe.each(['left', 'right'] as const)('rc-pi placeholder track (%s-hand traffic)', (drivingSide) => {
  const cfg = resolveConfig({ profile: 'rc-pi', city: { drivingSide } });
  const city = generateCity({ seed: 1, ...cfg.city });

  it('generates a 2x2 grid of short single-lane roads without traffic', () => {
    expect(city.lanes).toHaveLength(8);
    expect(city.signals).toHaveLength(0);
    expect(cfg.vehicleCount + cfg.pedestrianCount).toBe(0);
    for (const id of city.lanes) expect((city.segments[id] as LaneSegment).path.length).toBeGreaterThanOrEqual(cfg.ego.spawnLaneMinLength);
  });

  it('forms two one-way loops (a 2x2 grid has no U-turns) that keep every path on the carriageway', () => {
    for (const id of city.lanes) expect(reachable(city, id)).toBe(city.segments.length / 2);
    for (const seg of city.segments) {
      for (let s = 0; s <= seg.path.length; s += 0.5) {
        const p = seg.path.sample(s);
        for (const side of [-0.95, 0, 0.95]) expect(isDrivable(city, p.x - Math.sin(p.heading) * side, p.y + Math.cos(p.heading) * side)).toBe(true);
      }
    }
  });

  it('places the ego on routes of the configured length', () => {
    for (const seed of [1, 2, 3]) {
      const sim = new Simulation({ seed, profile: 'rc-pi', city: { drivingSide } });
      for (let ep = 0; ep < 3; ep++) {
        expect(sim.spawnEgo()).toBe(true);
        expect(sim.route!.length).toBeGreaterThanOrEqual(cfg.ego.minRouteDistance * 0.8);
      }
    }
  });
});
