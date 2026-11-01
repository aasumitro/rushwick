import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import type { EgoStateObservation } from '../../ego/observation';
import { getProfile } from '../profiles';
import { EgoStateChannel } from './egoStateChannel';
import { LidarChannel } from './lidarChannel';
import { ouStep, quantize } from './noise';
import type { SensorRecord } from './record';

const ideal = getProfile('ideal').sensors;
const N = 4000;

/** A record carrying only what the ego-state and lidar channels read. */
const record = (time: number, ego: Partial<EgoStateObservation>, lidar: number[] = [], commandedSteer = 0) =>
  ({ step: 0, ideal: { time, ego: { speed: 0, accel: 0, steer: 0, yawRate: 0, ...ego }, lidar }, commandedSteer }) as unknown as SensorRecord;

const std = (xs: number[]) => {
  const m = xs.reduce((a, x) => a + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
};

describe('noise helpers', () => {
  it('keeps an Ornstein–Uhlenbeck process at its stationary std', () => {
    const rng = new Rng(3);
    let e = 0;
    const xs: number[] = [];
    for (let i = 0; i < 40_000; i++) xs.push((e = ouStep(e, 1 / 30, 0.5, 0.2, rng)));
    expect(std(xs)).toBeCloseTo(0.2, 1);
  });

  it('quantizes to multiples and passes through at 0', () => {
    expect(quantize(0.237, 0.1)).toBeCloseTo(0.2, 12);
    expect(quantize(0.237, 0)).toBe(0.237);
  });
});

describe('EgoStateChannel', () => {
  it('adds noise of the configured std, quantizes speed and never reads negative', () => {
    const ch = new EgoStateChannel({ ...ideal.egoState, speedStd: 0.3, speedQuantum: 0.1, accelStd: 2, yawRateStd: 0.02 }, new Rng(1));
    const reads = Array.from({ length: N }, (_, i) => ch.read(record(i / 30, { speed: 5, accel: 1 })));
    expect(std(reads.map((r) => r.speed))).toBeCloseTo(0.3, 1);
    expect(std(reads.map((r) => r.accel))).toBeCloseTo(2, 0);
    expect(std(reads.map((r) => r.yawRate))).toBeCloseTo(0.02, 2);
    for (const r of reads) expect(Math.abs(r.speed * 10 - Math.round(r.speed * 10))).toBeLessThan(1e-9);
    const still = Array.from({ length: 200 }, (_, i) => ch.read(record(i / 30, { speed: 0 })).speed);
    expect(Math.min(...still)).toBe(0);
  });

  it('lets the gyro bias wander with time', () => {
    const ch = new EgoStateChannel({ ...ideal.egoState, yawBiasWalk: 0.01 }, new Rng(2));
    const yaw = Array.from({ length: 30 * 600 }, (_, i) => ch.read(record(i / 30, {})).yawRate);
    // A random walk of 0.01 rad/s/√s over 600 s spreads ~0.25 rad/s, far beyond white noise.
    expect(Math.max(...yaw.map(Math.abs))).toBeGreaterThan(0.03);
  });

  it('reports measured or commanded steering', () => {
    const rec = record(0, { steer: 0.2 }, [], 0.5);
    expect(new EgoStateChannel(ideal.egoState, new Rng(1)).read(rec).steer).toBe(0.2);
    expect(new EgoStateChannel({ ...ideal.egoState, steer: 'commanded' }, new Rng(1)).read(rec).steer).toBe(0.5);
  });
});

describe('LidarChannel', () => {
  const cfg = { ...ideal.lidar, range: 50, rangeStd: 0.3, minRange: 0.5, dropout: 0.1 };

  it('drops rays, adds range noise and clamps to [minRange, range]', () => {
    const ch = new LidarChannel(cfg, new Rng(4));
    const reads = Array.from({ length: 200 }, () => ch.read(record(0, {}, [10, 0.2, 50, 49.9])));
    const at = (i: number) => reads.map((r) => r[i]!);
    expect(at(0).filter((r) => r === 50).length / reads.length).toBeCloseTo(0.1, 1);
    expect(std(at(0).filter((r) => r < 50))).toBeCloseTo(0.3, 1);
    expect(Math.min(...at(1))).toBe(0.5);
    expect(new Set(at(2))).toEqual(new Set([50]));
    for (const r of reads.flat()) expect(r >= 0.5 && r <= 50).toBe(true);
  });
});
