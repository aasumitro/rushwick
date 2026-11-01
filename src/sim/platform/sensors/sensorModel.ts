import type { Rng } from '../../core/rng';
import type { Observation, SensorConfig, WorldView } from '../../ego/observation';
import type { ActuatorModel } from '../actuators/actuatorModel';
import { assemble, type EgoReading, type ObjectsReading, type PoseReading, type SignalReading } from './assemble';
import { EgoStateChannel } from './egoStateChannel';
import { History } from './history';
import { LidarChannel } from './lidarChannel';
import { LocalizationChannel } from './localizationChannel';
import { ObjectsChannel } from './objectsChannel';
import { makeRecord, type SensorRecord } from './record';
import { SignalsChannel } from './signalsChannel';
import { TimedChannel } from './timedChannel';
import type { ChannelTiming, SensorModelConfig } from './types';
import { Visibility } from './visibility';

/**
 * Turns the true world into what the platform perceives (design decision D3).
 * `update()` runs once per physics step inside Simulation.step(): it records
 * the ideal observation, refreshes every channel that is due and assembles
 * `current`, so reading `current` is pure and call counts never matter. Each
 * channel draws from its own `sensors:<channel>` fork of the episode stream.
 */
export class SensorModel {
  /** The sensed observation for the latest step. */
  current!: Observation;
  private readonly history: History<SensorRecord>;
  private readonly recordCfg: SensorConfig;
  private readonly localizer: LocalizationChannel;
  /** Null when occlusion is off (or the profile is privileged). */
  private readonly visibility: Visibility | null;
  private readonly egoState: TimedChannel<EgoReading>;
  private readonly localization: TimedChannel<PoseReading>;
  private readonly lidar: TimedChannel<number[]>;
  private readonly objects: TimedChannel<ObjectsReading>;
  private readonly signals: TimedChannel<SignalReading>;
  private readonly channels: readonly TimedChannel<unknown>[];
  private step = 0;

  constructor(
    cfg: SensorModelConfig,
    sensors: SensorConfig,
    dt: number,
    rng: Rng,
    private readonly actuators: ActuatorModel,
  ) {
    const channel = <T>(t: ChannelTiming, read: (r: SensorRecord) => T) => new TimedChannel(t, dt, read);
    const fork = (name: string) => rng.fork(`sensors:${name}`);
    const egoState = new EgoStateChannel(cfg.egoState, fork('egoState'));
    const lidar = new LidarChannel(cfg.lidar, fork('lidar'));
    const objects = new ObjectsChannel(cfg.objects, sensors.maxAgents, fork('objects'));
    const signals = new SignalsChannel(cfg.signals, cfg.privileged, fork('signals'));
    this.recordCfg = { ...sensors, maxAgents: Infinity };
    this.localizer = new LocalizationChannel(cfg.localization, sensors, dt, fork('localization'));
    this.visibility = cfg.objects.occlusion && !cfg.privileged ? new Visibility(cfg.objects) : null;
    this.egoState = channel(cfg.egoState, (r) => egoState.read(r));
    this.localization = channel(cfg.localization, (r) => r.pose);
    this.lidar = channel(cfg.lidar, (r) => lidar.read(r));
    this.objects = channel(cfg.objects, (r) => objects.read(r));
    this.signals = channel(cfg.signals, (r) => signals.read(r));
    this.channels = [this.egoState, this.localization, this.lidar, this.objects, this.signals];
    this.history = new History(Math.max(...this.channels.map((c) => c.latencySteps)) + 1);
  }

  /** Record the current world state and refresh the channels that are due. Call once at spawn and after every physics step. */
  update(w: WorldView): void {
    const step = this.step++;
    const commandedSteer = this.actuators.lastCommanded.steering * w.ego.params.maxSteer;
    // Occlusion is the costly part: only compute it for records a detection tick will read.
    const visible = this.visibility && this.objects.reads(step) ? this.visibility.compute(w) : null;
    const rec = makeRecord(w, step, this.recordCfg, { pose: this.localizer.record(w), commandedSteer, visible });
    this.history.push(rec);
    for (const c of this.channels) c.update(this.history, step);
    this.current = assemble(rec.ideal.time, rec.ideal.ego, this.egoState.value, this.localization.value, this.objects.value, this.lidar.value, this.signals.value);
  }
}
