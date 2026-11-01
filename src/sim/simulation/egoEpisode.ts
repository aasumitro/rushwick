import type { Rng } from '../core/rng';
import type { DrivingAction } from '../ego/egoParams';
import type { EgoVehicle } from '../ego/egoVehicle';
import type { Route } from '../ego/route';
import type { EpisodeMetrics } from '../metrics';
import { ActuatorModel, isIdeal } from '../platform';
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
  /** Physics steps since spawn (the actuator model's clock). */
  private steps = 0;

  private constructor(
    readonly ego: EgoVehicle,
    readonly route: Route,
    private readonly evaluator: EgoEvaluator,
    /** Null for the ideal profile, which applies actions exactly. */
    readonly actuators: ActuatorModel | null,
  ) {}

  static start(host: EpisodeHost, rng: Rng): EgoEpisode | null {
    const { config, platform } = host;
    // Forking does not advance `rng`, so placement is the same with or without a model.
    const actuators = isIdeal(platform) ? null : new ActuatorModel(platform.actuators, config.ego.params, config.dt, rng.fork('actuators'));
    const placed = placeEgo(host.city, config.ego, rng);
    if (!placed) return null;
    host.traffic.removeNear(placed.ego.x, placed.ego.y, 14);
    const evaluator = new EgoEvaluator(host.city, host.signals, placed.route, config.ego, placed.progress);
    return new EgoEpisode(placed.ego, placed.route, evaluator, actuators);
  }

  /** True when the next step accepts a new command (always without an actuator model). */
  get controlDue(): boolean {
    return this.actuators?.controlDue(this.steps) ?? true;
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
    const a = action ?? IDLE;
    ego.step(this.actuators ? this.actuators.apply(a, this.steps) : a, dt);
    this.steps++;
    const m = this.evaluator.metrics;
    m.sample(dt, ego.speed, ego.accel, ego.yawRate);
    const { ranRedLight, lateralDistance } = this.evaluator.advance(ego);
    const contact = this.contact.check(host.city, ego, host.index, host.traffic, host.pedestrians.peds);
    this.evaluator.record(dt, ego, contact, host.index, host.traffic.vehicles);
    m.outcome = this.evaluator.outcome(dt, ego, contact, lateralDistance);
    return { collisionVehicle: contact.vehicle, collisionPedestrian: contact.pedestrian, offRoad: contact.offRoad, redLightViolation: ranRedLight };
  }
}
