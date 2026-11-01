import type { ConnectorSegment } from '../types';
import type { GenContext } from './context';
import { polylineDistance } from './polylineTests';

/** Two vehicle bodies (~1 m half-width each) plus margin. */
const CONFLICT_CLEARANCE = 2.4;
/** A 12 m bus sweeps up to ~3.4 m outside its path on a turn (6 m radius), ~2.4 m on a 13 m one. */
const WIDE_CONFLICT_CLEARANCE = 5.5;

/** Classify every connector pair at each node as sibling, conflict, wide-conflict or independent. */
export function computeConflicts(ctx: GenContext): void {
  for (const node of ctx.nodes) {
    const conns = node.connectors.map((id) => ctx.segments[id] as ConnectorSegment);
    for (let i = 0; i < conns.length; i++) {
      for (let j = i + 1; j < conns.length; j++) {
        relate(conns[i] as ConnectorSegment, conns[j] as ConnectorSegment);
      }
    }
  }
}

function relate(a: ConnectorSegment, b: ConnectorSegment): void {
  if (a.fromLane === b.fromLane) {
    a.siblings.push(b.id);
    b.siblings.push(a.id);
    return;
  }
  const d = polylineDistance(a.path.points, b.path.points);
  if (a.toLane === b.toLane || d < CONFLICT_CLEARANCE) {
    a.conflicts.push(b.id);
    b.conflicts.push(a.id);
  } else if (d < WIDE_CONFLICT_CLEARANCE && (a.turn !== 'straight' || b.turn !== 'straight')) {
    // Long vehicles swing wide (and cut in) on turns; straight-vs-straight pairs are unaffected.
    a.wideConflicts.push(b.id);
    b.wideConflicts.push(a.id);
  }
}
