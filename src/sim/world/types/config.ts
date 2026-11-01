import type { DrivingSide } from './directions';

export interface CityConfig {
  seed: number;
  /** Intersections along x and y. */
  gridX: number;
  gridY: number;
  /** Range for the randomised centre-to-centre spacing of road lines (m). */
  minSpacing: number;
  maxSpacing: number;
  /** Every k-th road line (and both outer roads) is an arterial. */
  arterialEvery: number;
  drivingSide: DrivingSide;
  laneWidth: number;
  sidewalkWidth: number;
  /** Gap between the crosswalk and the stop line (m). */
  stopGap: number;
  arterialLanes: number;
  localLanes: number;
  arterialSpeed: number;
  localSpeed: number;
  /** Depth of the built-up frame around the road grid (m). */
  outerDepth: number;
  parkProbability: number;
  /** Peak extra building height at the city centre (downtown). */
  downtownHeight: number;
  /**
   * 'protected': separate far-turn stages everywhere (4 stages).
   * 'mixed': protected far turns only where two arterials cross; permissive
   * (yield-to-oncoming) far turns elsewhere (2 stages).
   */
  signalMode: 'protected' | 'mixed';
  /** Green time (s) for through stages on arterial / local approaches. */
  arterialGreen: number;
  localGreen: number;
  farTurnGreen: number;
  yellowTime: number;
  allRedTime: number;
}
