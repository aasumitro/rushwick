import { isTick } from '../clock';
import type { History } from './history';
import type { SensorRecord } from './record';
import type { ChannelTiming } from './types';

/**
 * Sample-and-hold with latency: on every tick of `rateHz` the output becomes a
 * reading of the record `latency` seconds old (rounded to whole steps), and it
 * is held until the next tick. Readers draw their noise here, once per tick.
 */
export class TimedChannel<T> {
  /** Latest reading; set at step 0, which always ticks. */
  value!: T;
  readonly latencySteps: number;

  constructor(
    private readonly timing: ChannelTiming,
    private readonly dt: number,
    private readonly read: (rec: SensorRecord) => T,
  ) {
    this.latencySteps = Math.max(0, Math.round(timing.latency / dt));
  }

  update(history: History<SensorRecord>, step: number): void {
    if (isTick(step, this.dt, this.timing.rateHz)) this.value = this.read(history.at(step - this.latencySteps));
  }
}
