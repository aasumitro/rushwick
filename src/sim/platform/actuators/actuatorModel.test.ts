import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { DEFAULT_EGO_PARAMS } from '../../ego/egoParams';
import { ActuatorModel } from './actuatorModel';
import type { ActuatorModelConfig } from './types';

const DT = 1 / 30;
const EXACT: ActuatorModelConfig = {
  controlHz: 30,
  computeDelay: 0,
  actuationDelay: 0,
  delayJitter: 0,
  accelTimeConstant: 0,
  accelDeadband: 0,
  steerDeadband: 0,
  steerBiasStd: 0,
};

const model = (cfg: Partial<ActuatorModelConfig>, seed = 1) => new ActuatorModel({ ...EXACT, ...cfg }, DEFAULT_EGO_PARAMS, DT, new Rng(seed));

/** Outputs for steps 0..n-1 when the model is fed `input(k)`. */
function run(m: ActuatorModel, n: number, input: (k: number) => number): { acceleration: number; steering: number }[] {
  return Array.from({ length: n }, (_, k) => m.apply({ acceleration: input(k), steering: input(k) / 10 }, k));
}

describe('ActuatorModel', () => {
  it('delivers a step command exactly round(delay / dt) steps later', () => {
    const m = model({ computeDelay: 0.06, actuationDelay: 0.02 }); // 0.08 s = 2.4 steps -> 2
    const out = run(m, 12, (k) => (k >= 5 ? 1 : 0)).map((a) => a.acceleration);
    expect(out).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(m.lastDelaySteps).toBe(2);
  });

  it('accepts commands only on control ticks and holds them in between', () => {
    const m = model({ controlHz: 10 }); // every third step at 30 Hz
    expect([0, 1, 2, 3, 4, 5, 6].map((k) => m.controlDue(k))).toEqual([true, false, false, true, false, false, true]);
    const out = run(m, 8, (k) => k).map((a) => a.acceleration);
    expect(out).toEqual([0, 0, 0, 3, 3, 3, 6, 6].map((v) => Math.min(v, DEFAULT_EGO_PARAMS.maxAccel)));
    expect(m.lastCommanded.acceleration).toBe(3);
  });

  it('ticks on 2 of 3 steps at 20 Hz and on every step once controlHz reaches 1/dt', () => {
    const m = model({ controlHz: 20 });
    expect([0, 1, 2, 3, 4, 5, 6].map((k) => m.controlDue(k))).toEqual([true, false, true, true, false, true, true]);
    expect(Array.from({ length: 50 }, (_, k) => model({ controlHz: 30 }).controlDue(k)).every(Boolean)).toBe(true);
  });

  it('lags the longitudinal response to 63% after one time constant', () => {
    const m = model({ accelTimeConstant: 0.2 }); // 6 steps
    const out = run(m, 6, () => 1);
    expect(out[5]!.acceleration).toBeCloseTo(1 - Math.exp(-1), 6);
  });

  it('zeroes commands inside the deadbands', () => {
    const m = model({ accelDeadband: 0.1, steerDeadband: 0.02 });
    expect(m.apply({ acceleration: 0.05, steering: 0.01 }, 0)).toEqual({ acceleration: 0, steering: 0 });
    expect(m.apply({ acceleration: 0.5, steering: -0.03 }, 1)).toEqual({ acceleration: 0.5, steering: -0.03 });
  });

  it('keeps the steering bias constant within an episode and varies it across seeds', () => {
    const a = model({ steerBiasStd: 0.03 }, 1);
    const steer = run(a, 20, () => 0).map((x) => x.steering);
    expect(new Set(steer).size).toBe(1);
    expect(steer[0]).toBeCloseTo(a.steerBias / DEFAULT_EGO_PARAMS.maxSteer, 12);
    expect(model({ steerBiasStd: 0.03 }, 1).steerBias).toBe(a.steerBias);
    expect(model({ steerBiasStd: 0.03 }, 2).steerBias).not.toBe(a.steerBias);
  });

  it('sanitizes non-finite commands instead of poisoning the lag state', () => {
    const m = model({ accelTimeConstant: 0.2 });
    m.apply({ acceleration: Number.NaN, steering: Infinity }, 0);
    expect(m.apply({ acceleration: 0, steering: 0 }, 1).acceleration).toBe(0);
  });
});
