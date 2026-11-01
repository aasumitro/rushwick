import type { Aabb } from '../../core/segment';
import { dist, type Vec2 } from '../../core/vec2';
import { Dir, DIRS, type ConnectorSegment, type Crosswalk, type Intersection } from '../types';
import type { GenContext } from './context';
import { polylineHitsAabb } from './polylineTests';

/** Painted area and walking endpoints of the crosswalk across arm `d`. */
function crosswalkGeometry(n: Intersection, d: Dir, sw: number): { area: Aabb; a: Vec2; b: Vec2 } {
  const { x: cx, y: cy } = n.center;
  if (d === Dir.N || d === Dir.S) {
    const sgn = d === Dir.N ? 1 : -1;
    const y0 = cy + sgn * n.hwH;
    const y1 = cy + sgn * (n.hwH + sw);
    const yc = cy + sgn * (n.hwH + sw / 2);
    return {
      area: { minX: cx - n.hwV, maxX: cx + n.hwV, minY: Math.min(y0, y1), maxY: Math.max(y0, y1) },
      a: { x: cx - n.hwV - sw / 2, y: yc },
      b: { x: cx + n.hwV + sw / 2, y: yc },
    };
  }
  const sgn = d === Dir.E ? 1 : -1;
  const x0 = cx + sgn * n.hwV;
  const x1 = cx + sgn * (n.hwV + sw);
  const xc = cx + sgn * (n.hwV + sw / 2);
  return {
    area: { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minY: cy - n.hwH, maxY: cy + n.hwH },
    a: { x: xc, y: cy - n.hwH - sw / 2 },
    b: { x: xc, y: cy + n.hwH + sw / 2 },
  };
}

/** One crosswalk per existing arm, linked to every connector that drives across it. */
export function buildCrosswalks(ctx: GenContext): void {
  for (const n of ctx.nodes) {
    for (const d of DIRS) {
      if (!n.arms[d]) continue;
      const { area, a, b } = crosswalkGeometry(n, d, ctx.config.sidewalkWidth);
      const cw: Crosswalk = { id: ctx.crosswalks.length, nodeId: n.id, arm: d, a, b, area, walkStages: [], clearanceTime: dist(a, b) / 1.1 };
      ctx.crosswalks.push(cw);
      n.crosswalks.push(cw.id);
      for (const cid of n.connectors) {
        const conn = ctx.segments[cid] as ConnectorSegment;
        if (polylineHitsAabb(conn.path.points, cw.area, 0.3)) conn.crosswalks.push(cw.id);
      }
    }
  }
}
