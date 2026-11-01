import { describe, expect, it } from 'vitest';
import { isDrivable, pointInBlock } from '../queries';
import type { City, LaneSegment } from '../types';
import { generateCity } from './index';

/** Lane changes within a road direction are legal routing moves. */
function reachable(city: City, start: number, forward: boolean): number {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const seg = city.segments[stack.pop()!]!;
    const lc = seg.kind === 'lane' ? seg.group : [];
    for (const n of [...(forward ? seg.next : seg.prev), ...lc]) if (!seen.has(n) && seen.add(n)) stack.push(n);
  }
  return seen.size;
}

describe.each(['left', 'right'] as const)('road network (%s-hand traffic)', (drivingSide) => {
  const city = generateCity({ seed: 7, drivingSide });

  it('is deterministic for a given seed', () => {
    const again = generateCity({ seed: 7, drivingSide });
    expect(again.xs).toEqual(city.xs);
    expect(again.blocks.map((b) => b.buildings.length)).toEqual(city.blocks.map((b) => b.buildings.length));
  });

  it('is strongly connected (every lane reachable from every lane)', () => {
    expect(reachable(city, city.lanes[0]!, true)).toBe(city.segments.length);
    expect(reachable(city, city.lanes[0]!, false)).toBe(city.segments.length);
  });

  it('keeps every lane and turn path on the carriageway, clear of curbs', () => {
    for (const seg of city.segments) {
      for (let s = 0; s <= seg.path.length; s += 0.5) {
        const p = seg.path.sample(s);
        for (const side of [-0.95, 0, 0.95]) {
          const ok = isDrivable(city, p.x - Math.sin(p.heading) * side, p.y + Math.cos(p.heading) * side);
          expect(ok, `segment ${seg.id} (${seg.kind}) leaves the road at s=${s}`).toBe(true);
        }
      }
    }
  });

  it('puts lanes on the configured side of the road', () => {
    for (const id of city.lanes) {
      const lane = city.segments[id] as LaneSegment;
      const a = city.nodes[city.roads[lane.roadId]!.a]!.center;
      const p = lane.path.sample(lane.path.length / 2);
      const lateral = -Math.sin(p.heading) * (p.x - a.x) + Math.cos(p.heading) * (p.y - a.y);
      expect(drivingSide === 'left' ? lateral > 0 : lateral < 0).toBe(true);
    }
  });

  it('places pedestrian corners on sidewalks', () => {
    for (const pn of city.pedNodes) expect(city.blocks.some((b) => pointInBlock(b, pn.pos.x, pn.pos.y))).toBe(true);
  });
});
