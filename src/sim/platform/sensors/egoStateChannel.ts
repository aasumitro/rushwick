import type { Rng } from '../../core/rng';
import type { EgoReading } from './assemble';
import { quantize } from './noise';
import type { SensorRecord } from './record';
import type { EgoStateChannelConfig } from './types';

/**
 * Wheel speed, IMU and steering feedback. Speed is noisy, quantized and never
 * negative; the gyro carries white noise plus a random-walk bias; servo-only
 * cars report the commanded steering angle. Dimensions are known exactly.
 */
export class EgoStateChannel {
  /** Gyro bias (rad/s). */
  private yawBias = 0;
  private lastTime: number | null = null;

  constructor(
    private readonly cfg: EgoStateChannelConfig,
    private readonly rng: Rng,
  ) {}

  read(rec: SensorRecord): EgoReading {
    const { cfg, rng } = this;
    const { ego, time } = rec.ideal;
    const elapsed = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
    this.yawBias += cfg.yawBiasWalk * Math.sqrt(elapsed) * rng.normal();
    return {
      speed: Math.max(0, quantize(ego.speed + rng.normal(0, cfg.speedStd), cfg.speedQuantum)),
      accel: ego.accel + rng.normal(0, cfg.accelStd),
      yawRate: ego.yawRate + this.yawBias + rng.normal(0, cfg.yawRateStd),
      steer: cfg.steer === 'commanded' ? rec.commandedSteer : ego.steer,
    };
  }
}
