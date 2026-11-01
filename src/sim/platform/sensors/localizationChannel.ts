import type { Rng } from '../../core/rng';
import { observeRoute, type SensorConfig, type WorldView } from '../../ego/observation';
import type { PoseReading } from './assemble';
import { ouStep } from './noise';
import type { LocalizationChannelConfig } from './types';

/** How far from the true progress (m) the perceived pose is projected onto the route. */
const PROJECTION_WINDOW = 10;

/**
 * Perceived pose = truth + slowly drifting error (Ornstein–Uhlenbeck) + white
 * noise. The pose error is drawn every physics step and the route observation
 * (waypoints, tracking errors, stop distance) is computed from the perceived
 * pose right away, because the map lookup happens where the car thinks it is.
 */
export class LocalizationChannel {
  private driftX: number;
  private driftY: number;

  constructor(
    private readonly cfg: LocalizationChannelConfig,
    private readonly sensors: SensorConfig,
    private readonly dt: number,
    private readonly rng: Rng,
  ) {
    // Start inside the stationary distribution, as a localizer that has been running for a while.
    this.driftX = rng.normal(0, cfg.driftStd);
    this.driftY = rng.normal(0, cfg.driftStd);
  }

  /** The pose reading for this step; call once per physics step. */
  record(w: WorldView): PoseReading {
    const { cfg, rng, dt } = this;
    this.driftX = ouStep(this.driftX, dt, cfg.driftTau, cfg.driftStd, rng);
    this.driftY = ouStep(this.driftY, dt, cfg.driftTau, cfg.driftStd, rng);
    const pose = {
      x: w.ego.x + this.driftX + rng.normal(0, cfg.posStd),
      y: w.ego.y + this.driftY + rng.normal(0, cfg.posStd),
      heading: w.ego.heading + rng.normal(0, cfg.headingStd),
    };
    // Progress error = the pose error along the route (exactly 0 without noise).
    const lo = Math.max(0, w.progress - PROJECTION_WINDOW);
    const along = (p: { x: number; y: number }) => w.route.path.project(p, lo, w.progress + PROJECTION_WINDOW).s;
    const progress = w.progress + along(pose) - along(w.ego);
    const stop = w.route.nextStop(progress + w.ego.params.length / 2);
    return { ...pose, route: observeRoute(w, this.sensors, pose, progress), stopId: stop ? stop.connector : -1 };
  }
}
