import { describe, expect, it } from 'vitest';
import { generateCity } from '../../world/generator';
import type { LaneSegment } from '../../world/types';
import { planRoute } from './planner';
import { Route } from './route';

describe('route planning', () => {
  const city = generateCity({ seed: 4 });
  const from = city.lanes[0]!;
  const to = city.lanes[city.lanes.length - 1]!;
  const segs = planRoute(city, from, to)!;

  it('finds a connected path between distant lanes', () => {
    expect(segs[0]).toBe(from);
    expect(segs[segs.length - 1]).toBe(to);
    for (let i = 1; i < segs.length; i++) {
      const prev = city.segments[segs[i - 1]!]!;
      const isLaneChange = prev.kind === 'lane' && (prev as LaneSegment).group.includes(segs[i]!);
      expect(prev.next.includes(segs[i]!) || isLaneChange).toBe(true);
    }
  });

  it('builds a continuous reference path with a stop line before every junction', () => {
    const route = new Route(city, segs, 5, 20);
    for (let i = 1; i < route.path.points.length; i++) {
      const a = route.path.points[i - 1]!;
      const b = route.path.points[i]!;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(120);
    }
    const junctions = segs.filter((id) => city.segments[id]!.kind === 'connector').length;
    expect(route.stops.length).toBe(junctions);
    expect(route.nextStop(0)?.s).toBe(route.stops[0]?.s);
  });
});
