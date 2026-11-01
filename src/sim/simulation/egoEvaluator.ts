import { toLocal } from '../core/vec2';
import type { EgoVehicle } from '../ego/egoVehicle';
import type { Route } from '../ego/route';
import { MetricsTracker, type EpisodeOutcome } from '../metrics';
import type { SignalSystem } from '../traffic/signals';
import type { Vehicle } from '../traffic/vehicles';
import type { City, ConnectorSegment } from '../world/types';
import type { EgoConfig } from './config';
import type { ContactReport } from './egoContact';
import type { WorldIndex } from './worldIndex';

const ARRIVAL_TOLERANCE = 8;

/** Tracks route progress, infractions and termination for one ego episode. */
export class EgoEvaluator {
  readonly metrics: MetricsTracker;
  progress: number;
  private offRouteTime = 0;
  private stuckTimer = 0;
  private wasOffRoad = false;

  constructor(
    private readonly city: City,
    private readonly signals: SignalSystem,
    private readonly route: Route,
    private readonly cfg: EgoConfig,
    startProgress: number,
  ) {
    this.metrics = new MetricsTracker(route.length);
    this.progress = startProgress;
  }

  /** Update progress; returns true when a red-light stop line was crossed this step. */
  advance(ego: EgoVehicle): { ranRedLight: boolean; lateralDistance: number } {
    const prev = this.progress;
    const pr = this.route.path.project(ego, Math.max(0, prev - 5), prev + 25);
    this.progress = Math.max(prev, pr.s);
    this.metrics.progress = this.progress;
    const half = ego.params.length / 2;
    let ranRedLight = false;
    for (const st of this.route.stops) {
      if (prev + half < st.s && this.progress + half >= st.s) {
        if (this.signals.connectorState(this.city.segments[st.connector] as ConnectorSegment) === 'red') ranRedLight = true;
      }
    }
    if (ranRedLight) this.metrics.redLightViolations++;
    return { ranRedLight, lateralDistance: pr.distance };
  }

  record(dt: number, ego: EgoVehicle, contact: ContactReport, index: WorldIndex, vehicles: readonly Vehicle[]): void {
    const m = this.metrics;
    if (contact.vehicle) m.collisionsVehicle++;
    if (contact.pedestrian) m.collisionsPedestrian++;
    m.pedestrianNearMisses += contact.newNearMisses;
    if (contact.offRoad) {
      m.offRoadTime += dt;
      if (!this.wasOffRoad) m.offRoadEvents++;
    }
    this.wasOffRoad = contact.offRoad;
    if (ego.speed <= 1) return;
    // Time-to-collision with vehicles ahead within a lane-width corridor.
    index.vehicleGrid.query(ego.x, ego.y, 40, (i) => {
      const v = vehicles[i] as Vehicle;
      const l = toLocal(v.x, v.y, ego.x, ego.y, ego.heading);
      if (l.x <= 0 || Math.abs(l.y) > (ego.params.width + v.width) / 2 + 0.3) return;
      const gap = l.x - ego.params.length / 2 - v.length / 2;
      const closing = ego.speed - v.speed * Math.cos(v.heading - ego.heading);
      if (closing > 0.1 && gap > 0) m.minTimeToCollision = Math.min(m.minTimeToCollision, gap / closing);
    });
  }

  outcome(dt: number, ego: EgoVehicle, contact: ContactReport, lateralDistance: number): EpisodeOutcome {
    const { cfg, route } = this;
    if ((contact.vehicle || contact.pedestrian) && cfg.terminateOnCollision) return 'collision';
    if (contact.offRoad && cfg.terminateOnOffRoad) return 'offroad';
    // Arrival within about one car length of the destination counts (it may sit in a queue).
    if (this.progress >= route.length - ARRIVAL_TOLERANCE) return 'success';
    if (this.metrics.time >= Math.min(cfg.maxEpisodeTime, route.length / cfg.minAverageSpeed + 30)) return 'timeout';
    this.offRouteTime = lateralDistance > cfg.offRouteDistance ? this.offRouteTime + dt : 0;
    if (this.offRouteTime > 3) return 'off_route';
    const stop = route.nextStop(this.progress + ego.params.length / 2);
    const waitingAtSignal =
      stop !== null && stop.s - this.progress < 60 && this.signals.connectorState(this.city.segments[stop.connector] as ConnectorSegment) !== 'green';
    this.stuckTimer = ego.speed < 0.2 && !waitingAtSignal ? this.stuckTimer + dt : 0;
    return this.stuckTimer > cfg.stuckTimeout ? 'stuck' : 'running';
  }
}
