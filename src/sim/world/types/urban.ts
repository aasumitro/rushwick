import type { Aabb } from '../../core/segment';
import type { Vec2 } from '../../core/vec2';

export interface Building {
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  style: number;
}

export interface Block {
  id: number;
  /** Curb outline (raised sidewalk slab) with rounded corners of `cornerRadius`. */
  bounds: Aabb;
  cornerRadius: number;
  kind: 'buildings' | 'park';
  buildings: Building[];
  trees: Vec2[];
}

export interface SignalStage {
  connectors: number[];
  green: number;
}

export interface SignalPlan {
  nodeId: number;
  stages: SignalStage[];
  yellow: number;
  allRed: number;
  cycle: number;
  offset: number;
}
