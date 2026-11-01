import type { Aabb } from '../../core/segment';
import type { Vec2 } from '../../core/vec2';
import type { CityConfig } from './config';
import type { Intersection, Road, Segment } from './network';
import type { Crosswalk, PedEdge, PedNode } from './pedestrian';
import type { Block, SignalPlan } from './urban';

/** Immutable description of a generated city. */
export interface City {
  config: CityConfig;
  bounds: Aabb;
  /** Road line coordinates (x of vertical roads, y of horizontal roads). */
  xs: number[];
  ys: number[];
  roads: Road[];
  nodes: Intersection[];
  /** Lanes and connectors, indexed by id. */
  segments: Segment[];
  lanes: number[];
  crosswalks: Crosswalk[];
  pedNodes: PedNode[];
  pedEdges: PedEdge[];
  blocks: Block[];
  cornerRadius: number;
  signals: SignalPlan[];
  streetTrees: Vec2[];
}
