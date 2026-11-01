import type { Obb } from '../core/obb';
import type { SpatialGrid } from '../core/spatialGrid';
import type { Vec2 } from '../core/vec2';

export type PedState = 'walk' | 'idle' | 'wait' | 'cross';

export interface Crossing {
  kind: 'crosswalk' | 'jaywalk';
  crosswalkId: number;
  from: Vec2;
  to: Vec2;
  /** Edge and node to continue towards after a jaywalk. */
  thenEdge: number;
  thenNode: number;
}

export interface Pedestrian {
  id: number;
  x: number;
  y: number;
  heading: number;
  prevX: number;
  prevY: number;
  prevHeading: number;
  speed: number;
  desiredSpeed: number;
  height: number;
  shirt: number;
  pants: number;
  state: PedState;
  /** True while on the carriageway; drivers only yield to these. */
  onRoad: boolean;
  edge: number;
  toNode: number;
  /** Preferred lateral offset from the walkway centre line. */
  offset: number;
  target: Vec2;
  crossing: Crossing | null;
  /** Mid-block point where this pedestrian will jaywalk, if planned. */
  jaywalkAt: Vec2 | null;
  waitTime: number;
  idleTime: number;
  blockedTime: number;
  walkPhase: number;
  /** Mirrors of the crossing state for drivers (see PedObstacle). */
  crosswalkId: number;
  waiting: boolean;
}

/** Anything a pedestrian must look out for before stepping onto the road. */
export interface MovingBox {
  obb: Obb;
  speed: number;
  heading: number;
}

export interface PedStepContext {
  vehicleGrid: SpatialGrid;
  vehicles: readonly MovingBox[];
  ego: MovingBox | null;
}
