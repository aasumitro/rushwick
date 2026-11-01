import type { Rng } from '../core/rng';
import type { DrivingAction } from '../ego/egoParams';
import type { EgoVehicle } from '../ego/egoVehicle';
import type { Route } from '../ego/route';
import type { EpisodeMetrics } from '../metrics';
import type { City } from '../world/types';
import { computeEgoBlocked } from './egoBlocking';
import { EgoContact } from './egoContact';
import { EgoEvaluator } from './egoEvaluator';
import { placeEgo } from './egoSpawner';
import { noEvents, type EpisodeHost, type StepEvents } from './types';

const IDLE: DrivingAction = { acceleration: 0, steering: 0 };

/** One ego run from spawn to termination (success, collision, timeout, ...). */
export class EgoEpisode {
  private readonly contact = new EgoContact();
  private readonly blocked = new Set<number>();

  private constructor(
    readonly ego: EgoVehicle,
    readonly route: Route,
    private readonly evaluator: EgoEvaluator,
  ) {}

  static start(host: EpisodeHost, rng: Rng): EgoEpisode | null {
    const placed = placeEgo(host.city, host.config.ego, rng);
    if (!placed) return null;
    host.traffic.removeNear(placed.ego.x, placed.ego.y, 14);
    const evaluator = new EgoEvaluator(host.city, host.signals, placed.route, host.config.ego, placed.progress);
    return new EgoEpisode(placed.ego, placed.route, evaluator);
  }

  get progress(): number {
    return this.evaluator.progress;
  }

  get done(): boolean {
    return this.evaluator.metrics.outcome !== 'running';
  }

  metrics(): EpisodeMetrics {
    return this.evaluator.metrics.result();
  }

  /** Connectors background traffic must leave free for the ego (none once the episode ended). */
  blockedConnectors(city: City): ReadonlySet<number> {
    if (this.done) this.blocked.clear();
    else computeEgoBlocked(city, this.ego, this.route, this.progress, this.blocked);
    return this.blocked;
  }

  step(host: EpisodeHost, action: DrivingAction | null): StepEvents {
    const ego = this.ego;
    if (this.done) {
      // Episode over: the ego stays parked where it ended.
      ego.prevX = ego.x;
      ego.prevY = ego.y;
      ego.prevHeading = ego.heading;
      ego.speed = 0;
      return noEvents();
    }
    const dt = host.config.dt;
    ego.step(action ?? IDLE, dt);
    const m = this.evaluator.metrics;
    m.sample(dt, ego.speed, ego.accel, ego.yawRate);
    const { ranRedLight, lateralDistance } = this.evaluator.advance(ego);
    const contact = this.contact.check(host.city, ego, host.index, host.traffic, host.pedestrians.peds);
    this.evaluator.record(dt, ego, contact, host.index, host.traffic.vehicles);
    m.outcome = this.evaluator.outcome(dt, ego, contact, lateralDistance);
    return { collisionVehicle: contact.vehicle, collisionPedestrian: contact.pedestrian, offRoad: contact.offRoad, redLightViolation: ranRedLight };
  }
}
