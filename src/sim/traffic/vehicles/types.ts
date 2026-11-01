import type { Obb } from '../../core/obb';
import type { SpatialGrid } from '../../core/spatialGrid';
import type { IdmParams } from '../idm';
import type { VehicleKind } from './specs';

/** A background vehicle. Position is lane-relative (route[0], s); x/y/heading are derived. */
export interface Vehicle extends IdmParams {
  id: number;
  kind: VehicleKind;
  length: number;
  width: number;
  height: number;
  color: number;
  /** Driver's preferred fraction of the speed limit. */
  speedFactor: number;
  /** route[0] is the current segment; later entries are the planned path. */
  route: number[];
  prevSeg: number;
  /** Front-bumper arc length on route[0]. */
  s: number;
  speed: number;
  accel: number;
  /** Connector reserved ahead (or being driven), -1 if none. */
  claim: number;
  /** Connector just exited, held until the tail clears it. */
  clearing: number;
  laneChangeFrom: number;
  laneChangeOffset0: number;
  laneChangeProgress: number;
  x: number;
  y: number;
  heading: number;
  prevX: number;
  prevY: number;
  prevHeading: number;
  odometer: number;
  stoppedTime: number;
  /** -1 left, 0 none, 1 right (for rendering indicators). */
  indicator: number;
}

/** What drivers know about a pedestrian. */
export interface PedObstacle {
  x: number;
  y: number;
  heading: number;
  speed: number;
  onRoad: boolean;
  /** Crosswalk being crossed or waited at (-1 if none). */
  crosswalkId: number;
  waiting: boolean;
}

export interface EgoObstacle {
  obb: Obb;
  speed: number;
  heading: number;
}

export interface VehicleStepContext {
  peds: readonly PedObstacle[];
  /** Index over pedestrians currently on the carriageway only (drivers ignore the sidewalk). */
  crossingGrid: SpatialGrid;
  crossingPeds: readonly PedObstacle[];
  ego: EgoObstacle | null;
  egoBlockedConnectors: ReadonlySet<number>;
}

/** Something to follow: bumper-to-bumper gap (m) and its speed along our path (m/s). */
export interface Leader {
  gap: number;
  speed: number;
}
