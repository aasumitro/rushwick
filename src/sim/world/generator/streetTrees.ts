import type { Vec2 } from '../../core/vec2';
import type { Intersection } from '../types';
import type { GenContext } from './context';

/** Trees along both curbs of every road, kept clear of intersections. */
export function buildStreetTrees(ctx: GenContext): Vec2[] {
  const rng = ctx.rng.fork('trees');
  const trees: Vec2[] = [];
  for (const r of ctx.roads) {
    const a = ctx.nodes[r.a] as Intersection;
    const b = ctx.nodes[r.b] as Intersection;
    const along = r.axis === 'h' ? 'x' : 'y';
    const p0 = a.center[along] + (r.axis === 'h' ? a.extentX : a.extentY) + 6;
    const p1 = b.center[along] - (r.axis === 'h' ? b.extentX : b.extentY) - 6;
    for (const side of [-1, 1]) {
      const off = side * (r.halfWidth + 0.8);
      for (let p = p0 + rng.range(0, 6); p < p1; p += rng.range(11, 16)) {
        trees.push(r.axis === 'h' ? { x: p, y: a.center.y + off } : { x: a.center.x + off, y: p });
      }
    }
  }
  return trees;
}
