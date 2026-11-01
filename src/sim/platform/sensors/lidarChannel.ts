import type { Rng } from '../../core/rng';
import { clamp } from '../../core/vec2';
import type { SensorRecord } from './record';
import type { LidarChannelConfig } from './types';

/**
 * Range noise, minimum range and dropouts on the ideal 2D scan. A dropped ray
 * and a ray with no return both read `range`; returns are clamped to
 * [minRange, range]. Every ray draws the same numbers, hit or not, so the
 * stream does not depend on the scene.
 */
export class LidarChannel {
  constructor(
    private readonly cfg: LidarChannelConfig,
    private readonly rng: Rng,
  ) {}

  read(rec: SensorRecord): number[] {
    const { range, rangeStd, minRange, dropout } = this.cfg;
    return rec.ideal.lidar.map((r) => {
      const dropped = this.rng.next() < dropout;
      const noise = this.rng.normal(0, rangeStd);
      return dropped || r >= range ? range : clamp(r + noise, minRange, range);
    });
  }
}
