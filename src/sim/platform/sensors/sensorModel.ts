import type { Observation, SensorConfig, WorldView } from '../../ego/observation';
import { assemble, type EgoReading, type ObjectsReading, type PoseReading, type SignalReading } from './assemble';
import { History } from './history';
import { makeRecord, type SensorRecord } from './record';
import { TimedChannel } from './timedChannel';
import type { ChannelTiming, SensorModelConfig } from './types';

/**
 * Turns the true world into what the platform perceives (design decision D3).
 * `update()` runs once per physics step inside Simulation.step(): it records
 * the ideal observation, refreshes every channel that is due and assembles
 * `current`, so reading `current` is pure and call counts never matter.
 */
export class SensorModel {
  /** The sensed observation for the latest step. */
  current!: Observation;
  private readonly history: History<SensorRecord>;
  private readonly egoState: TimedChannel<EgoReading>;
  private readonly localization: TimedChannel<PoseReading>;
  private readonly lidar: TimedChannel<number[]>;
  private readonly objects: TimedChannel<ObjectsReading>;
  private readonly signals: TimedChannel<SignalReading>;
  private readonly channels: readonly TimedChannel<unknown>[];
  private step = 0;

  constructor(
    cfg: SensorModelConfig,
    private readonly sensors: SensorConfig,
    dt: number,
  ) {
    const channel = <T>(t: ChannelTiming, read: (r: SensorRecord) => T) => new TimedChannel(t, dt, read);
    this.egoState = channel(cfg.egoState, ({ ideal: { ego } }) => ({ speed: ego.speed, accel: ego.accel, steer: ego.steer, yawRate: ego.yawRate }));
    this.localization = channel(cfg.localization, ({ ideal: { ego, route }, stopId }) => ({ x: ego.x, y: ego.y, heading: ego.heading, route, stopId }));
    this.lidar = channel(cfg.lidar, (r) => r.ideal.lidar);
    this.objects = channel(cfg.objects, ({ ideal }) => ({ vehicles: ideal.vehicles, pedestrians: ideal.pedestrians }));
    this.signals = channel(cfg.signals, ({ ideal, stopId }) => ({ stopId, light: ideal.route.nextStop?.light ?? 'none', timeLeft: ideal.route.nextStop?.timeLeft ?? 0 }));
    this.channels = [this.egoState, this.localization, this.lidar, this.objects, this.signals];
    this.history = new History(Math.max(...this.channels.map((c) => c.latencySteps)) + 1);
  }

  /** Record the current world state and refresh the channels that are due. Call once at spawn and after every physics step. */
  update(w: WorldView): void {
    const step = this.step++;
    const rec = makeRecord(w, step, this.sensors);
    this.history.push(rec);
    for (const c of this.channels) c.update(this.history, step);
    this.current = assemble(rec.ideal.time, rec.ideal.ego, this.egoState.value, this.localization.value, this.objects.value, this.lidar.value, this.signals.value);
  }
}
