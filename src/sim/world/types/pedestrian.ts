import type { Aabb } from '../../core/segment';
import type { Vec2 } from '../../core/vec2';
import type { Dir } from './directions';

export interface Crosswalk {
  id: number;
  nodeId: number;
  arm: Dir;
  /** Walking endpoints (sidewalk centre lines on either side). */
  a: Vec2;
  b: Vec2;
  /** Painted area on the carriageway. */
  area: Aabb;
  /** Signal stages during which pedestrians may start crossing. */
  walkStages: number[];
  /** Time to cross at a conservative 1.1 m/s. */
  clearanceTime: number;
}

export interface PedNode {
  id: number;
  pos: Vec2;
  nodeId: number;
  edges: number[];
}

export interface PedEdge {
  id: number;
  a: number;
  b: number;
  kind: 'sidewalk' | 'crosswalk';
  length: number;
  crosswalkId: number;
  /** Sidewalks along a road: that road and the edge on the opposite side (else -1). */
  roadId: number;
  oppositeEdge: number;
}
