import { MinHeap } from '../../core/minHeap';
import type { City, Segment } from '../../world/types';

/** Penalty (seconds-equivalent) for a mid-block lane change. */
const LANE_CHANGE_COST = 6;

/**
 * Dijkstra over the lane graph (lanes, junction connectors and mid-block lane
 * changes) with free-flow travel time as cost. Returns the segment sequence
 * (consecutive lanes = a lane change) or null if unreachable.
 */
export function planRoute(city: City, fromLane: number, toLane: number): number[] | null {
  const n = city.segments.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new MinHeap<number>();
  dist[fromLane] = 0;
  heap.push(0, fromLane);
  while (heap.size > 0) {
    const { key: d, value: u } = heap.pop()!;
    if (done[u]) continue;
    done[u] = 1;
    if (u === toLane) break;
    const relax = (v: number, cost: number) => {
      if (d + cost < dist[v]!) {
        dist[v] = d + cost;
        prev[v] = u;
        heap.push(d + cost, v);
      }
    };
    const seg = city.segments[u] as Segment;
    for (const v of seg.next) {
      const nx = city.segments[v] as Segment;
      relax(v, nx.path.length / Math.max(nx.speedLimit, 1));
    }
    // At most one lane change per road segment.
    const reachedByLaneChange = prev[u]! >= 0 && city.segments[prev[u]!]!.kind === 'lane';
    if (seg.kind === 'lane' && !reachedByLaneChange) {
      for (const g of seg.group) if (g !== u) relax(g, LANE_CHANGE_COST);
    }
  }
  if (!Number.isFinite(dist[toLane]!)) return null;
  const out: number[] = [];
  for (let v = toLane; v !== -1; v = prev[v]!) out.push(v);
  return out.reverse();
}
