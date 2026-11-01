import type { Rng } from '../../core/rng';
import type { LightState } from '../../traffic/signals';
import type { SignalReading } from './assemble';
import type { SensorRecord } from './record';
import type { SignalsChannelConfig } from './types';

const STATES: readonly LightState[] = ['green', 'yellow', 'red'];

/**
 * Traffic-light perception for the next stop line on the route. Beyond range
 * or missed, the light reads 'unknown'; a detected light is sometimes read as
 * another state. Without `privileged` the time left is unknown (NaN). Whether
 * a junction is signalized comes from the map, so 'none' always passes.
 */
export class SignalsChannel {
  constructor(
    private readonly cfg: SignalsChannelConfig,
    private readonly privileged: boolean,
    private readonly rng: Rng,
  ) {}

  read(rec: SensorRecord): SignalReading {
    const stop = rec.ideal.route.nextStop;
    if (!stop) return { stopId: -1, light: 'none', timeLeft: 0 };
    const { cfg, rng } = this;
    const missed = rng.next() < cfg.missRate;
    const wrong = rng.next() < cfg.misclassify;
    const pick = rng.int(1, STATES.length - 1);
    if (stop.light === 'none') return { stopId: rec.stopId, light: 'none', timeLeft: stop.timeLeft };
    if (missed || stop.light === 'unknown' || stop.distance > cfg.range) return { stopId: rec.stopId, light: 'unknown', timeLeft: Number.NaN };
    const light = wrong ? STATES[(STATES.indexOf(stop.light) + pick) % STATES.length]! : stop.light;
    return { stopId: rec.stopId, light, timeLeft: this.privileged ? stop.timeLeft : Number.NaN };
  }
}
