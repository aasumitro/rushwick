import { dist } from '../../core/vec2';
import { DIRS, type Crosswalk, type PedEdge, type PedNode } from '../types';
import type { GenContext } from './context';

/** Corner quadrants: 0 = NE, 1 = SE, 2 = SW, 3 = NW. */
const QUADRANT_SIGNS: readonly [number, number][] = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
/** Quadrant pair linked across each arm (N, E, S, W). */
const ARM_QUADRANTS: readonly [number, number][] = [[3, 0], [0, 1], [1, 2], [2, 3]];

export interface PedNetwork {
  pedNodes: PedNode[];
  pedEdges: PedEdge[];
}

/** Sidewalk graph: one node per corner, edges along sidewalks and across crosswalks. */
export function buildPedNetwork(ctx: GenContext): PedNetwork {
  const sw = ctx.config.sidewalkWidth;
  const pedNodes: PedNode[] = [];
  const pedEdges: PedEdge[] = [];
  for (const n of ctx.nodes) {
    QUADRANT_SIGNS.forEach(([sx, sy], q) => {
      const pos = { x: n.center.x + sx * (n.hwV + sw / 2), y: n.center.y + sy * (n.hwH + sw / 2) };
      pedNodes.push({ id: n.id * 4 + q, pos, nodeId: n.id, edges: [] });
    });
  }
  const link = (a: number, b: number, kind: PedEdge['kind'], crosswalkId = -1, roadId = -1): PedEdge => {
    const e: PedEdge = { id: pedEdges.length, a, b, kind, length: dist(pedNodes[a]!.pos, pedNodes[b]!.pos), crosswalkId, roadId, oppositeEdge: -1 };
    pedEdges.push(e);
    pedNodes[a]!.edges.push(e.id);
    pedNodes[b]!.edges.push(e.id);
    return e;
  };
  for (const n of ctx.nodes) {
    for (const d of DIRS) {
      const [qa, qb] = ARM_QUADRANTS[d]!;
      // With an arm there is a crosswalk; without one the corner is plain sidewalk.
      const cwId = n.crosswalks.find((id) => (ctx.crosswalks[id] as Crosswalk).arm === d);
      if (n.arms[d]) link(n.id * 4 + qa, n.id * 4 + qb, 'crosswalk', cwId);
      else link(n.id * 4 + qa, n.id * 4 + qb, 'sidewalk');
    }
  }
  for (const r of ctx.roads) {
    const [A, B] = [r.a * 4, r.b * 4];
    // Horizontal roads: north/south sides; vertical roads: east/west sides.
    const e1 = r.axis === 'h' ? link(A + 0, B + 3, 'sidewalk', -1, r.id) : link(A + 0, B + 1, 'sidewalk', -1, r.id);
    const e2 = r.axis === 'h' ? link(A + 1, B + 2, 'sidewalk', -1, r.id) : link(A + 3, B + 2, 'sidewalk', -1, r.id);
    e1.oppositeEdge = e2.id;
    e2.oppositeEdge = e1.id;
  }
  return { pedNodes, pedEdges };
}
