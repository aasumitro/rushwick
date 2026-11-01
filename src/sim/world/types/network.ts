import type { Polyline } from '../../core/polyline';
import type { Vec2 } from '../../core/vec2';
import type { Dir, TurnType } from './directions';

export type RoadClass = 'arterial' | 'local';

export interface Road {
  id: number;
  axis: 'h' | 'v';
  /** Node at the low-coordinate end (west / south) and high end (east / north). */
  a: number;
  b: number;
  roadClass: RoadClass;
  lanesPerDir: number;
  laneWidth: number;
  halfWidth: number;
  speedLimit: number;
  /** Lane ids travelling a -> b and b -> a; index 0 = curb lane. */
  lanesAB: number[];
  lanesBA: number[];
}

interface SegmentBase {
  id: number;
  path: Polyline;
  speedLimit: number;
  next: number[];
  prev: number[];
}

export interface LaneSegment extends SegmentBase {
  kind: 'lane';
  roadId: number;
  laneIndex: number;
  fromNode: number;
  toNode: number;
  /** Direction of travel. */
  dir: Dir;
  width: number;
  /** All parallel lanes of this road in the same direction (index = laneIndex). */
  group: number[];
}

export interface ConnectorSegment extends SegmentBase {
  kind: 'connector';
  nodeId: number;
  fromLane: number;
  toLane: number;
  turn: TurnType;
  approachArm: Dir;
  exitArm: Dir;
  /** Connectors that geometrically conflict (crossing or merging). */
  conflicts: number[];
  /** Connectors that only conflict when a long vehicle swings wide on a tight turn. */
  wideConflicts: number[];
  /** Connectors sharing the same incoming lane (diverging siblings). */
  siblings: number[];
  /** Crosswalks whose painted area this connector passes through. */
  crosswalks: number[];
  /** Signal stage index at the node, or -1 when unsignalised. */
  stage: number;
  /** Permissive movement: same-stage conflicting connectors with priority. */
  yieldTo: number[];
}

export type Segment = LaneSegment | ConnectorSegment;

export interface Arm {
  dir: Dir;
  roadId: number;
  incoming: number[];
  outgoing: number[];
}

export interface Intersection {
  id: number;
  gx: number;
  gy: number;
  center: Vec2;
  arms: (Arm | null)[];
  /** Half-widths of the north-south (V) and east-west (H) roads through the node. */
  hwV: number;
  hwH: number;
  /** Centre-to-stop-line distance along x (E/W arms) and y (N/S arms). */
  extentX: number;
  extentY: number;
  connectors: number[];
  crosswalks: number[];
  signalized: boolean;
}
