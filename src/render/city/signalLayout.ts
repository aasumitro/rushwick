import type { City, ConnectorSegment, Intersection } from '../../sim';
import { DIR_VEC, DIRS, opposite } from '../../sim';

/** One signal head: where it stands and which movements it displays. */
export interface SignalHead {
  /** Pole foot (sim frame). */
  poleX: number;
  poleY: number;
  /** Head position at the end of the mast arm (sim frame). */
  headX: number;
  headY: number;
  /** Direction the lamps face (towards approaching traffic), radians. */
  facing: number;
  /** Straight (or, failing that, near-turn) connector shown on the main lamps. */
  main: ConnectorSegment;
  /** Far-turn connector shown on the arrow lamp, if it has its own stage. */
  arrow: ConnectorSegment | null;
}

/** Place one mast-arm signal per approach of every signalised intersection. */
export function layoutSignalHeads(city: City): SignalHead[] {
  const heads: SignalHead[] = [];
  const sideSign = city.config.drivingSide === 'left' ? 1 : -1;
  for (const node of city.nodes) {
    if (!node.signalized) continue;
    for (const d of DIRS) {
      const head = headFor(city, node, d, sideSign);
      if (head) heads.push(head);
    }
  }
  return heads;
}

function headFor(city: City, node: Intersection, arm: (typeof DIRS)[number], sideSign: number): SignalHead | null {
  const a = node.arms[arm];
  if (!a || a.incoming.length === 0) return null;
  const conns = node.connectors.map((id) => city.segments[id] as ConnectorSegment).filter((c) => c.approachArm === arm);
  const main = conns.find((c) => c.turn === 'straight') ?? conns.find((c) => c.turn === 'near') ?? conns[0];
  if (!main) return null;
  const far = conns.find((c) => c.turn === 'far' && c.stage !== main.stage) ?? null;
  const out = DIR_VEC[arm]!; // from the centre towards the approach
  const travel = DIR_VEC[opposite(arm)]!; // direction approaching vehicles travel
  // Driving-side normal of the approach (left normal for LHT, right normal for RHT).
  const side = { x: -travel.y * sideSign, y: travel.x * sideSign };
  const vertical = out.x === 0;
  const extent = vertical ? node.extentY : node.extentX;
  const hw = vertical ? node.hwV : node.hwH;
  const base = { x: node.center.x + out.x * (extent - 0.6), y: node.center.y + out.y * (extent - 0.6) };
  const reach = Math.max(1.5, hw - 1.2);
  return {
    poleX: base.x + side.x * (hw + 0.9),
    poleY: base.y + side.y * (hw + 0.9),
    headX: base.x + side.x * (hw + 0.9 - reach),
    headY: base.y + side.y * (hw + 0.9 - reach),
    facing: Math.atan2(-travel.y, -travel.x),
    main,
    arrow: far,
  };
}
