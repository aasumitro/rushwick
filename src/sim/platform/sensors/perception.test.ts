import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import type { AgentObservation, StopObservation } from '../../ego/observation';
import { getProfile } from '../profiles';
import { ObjectsChannel } from './objectsChannel';
import type { SensorRecord } from './record';
import { SignalsChannel } from './signalsChannel';

const ideal = getProfile('ideal').sensors;
const N = 3000;

const agent = (id: number, x: number, y: number): AgentObservation => ({ id, type: 'vehicle', kind: 'car', x, y, heading: 0, speed: 5, vx: 0, vy: 0, length: 4.5, width: 1.8 });
const objectsRecord = (vehicles: AgentObservation[], visible: number[] | null = null) =>
  ({ ideal: { vehicles, pedestrians: [] }, visible: visible && { vehicles: new Set(visible), pedestrians: new Set() } }) as unknown as SensorRecord;
const stopRecord = (stop: StopObservation | null) => ({ ideal: { route: { nextStop: stop } }, stopId: stop ? 7 : -1 }) as unknown as SensorRecord;

describe('ObjectsChannel', () => {
  it('keeps only agents in range, in view and visible, nearest first, up to maxAgents', () => {
    const ch = new ObjectsChannel({ ...ideal.objects, range: 30, fovDeg: 100 }, 2, new Rng(1));
    const read = ch.read(objectsRecord([agent(1, 25, 0), agent(2, 5, 1), agent(3, -5, 0), agent(4, 35, 0), agent(5, 10, 0)], [1, 2, 3, 4]));
    expect(read.vehicles.map((a) => a.id)).toEqual([2, 1]);
  });

  it('misses agents more often and blurs them more with distance', () => {
    const cfg = { ...ideal.objects, posStd: 0.1, posStdPerMeter: 0.02, missRate: 0.05, missRatePerMeter: 0.01 };
    const ch = new ObjectsChannel(cfg, 10, new Rng(2));
    const near: number[] = [];
    const far: number[] = [];
    for (let i = 0; i < N; i++) {
      const r = ch.read(objectsRecord([agent(1, 5, 0), agent(2, 40, 0)]));
      for (const a of r.vehicles) (a.id === 1 ? near : far).push(a.x - (a.id === 1 ? 5 : 40));
    }
    expect(near.length / N).toBeCloseTo(1 - 0.1, 1);
    expect(far.length / N).toBeCloseTo(1 - 0.45, 1);
    const std = (xs: number[]) => Math.sqrt(xs.reduce((a, x) => a + x * x, 0) / xs.length);
    expect(std(near)).toBeCloseTo(0.2, 1);
    expect(std(far)).toBeCloseTo(0.9, 1);
  });
});

describe('SignalsChannel', () => {
  const red: StopObservation = { distance: 20, light: 'red', timeLeft: 12 };

  it('reads unknown beyond range and hides time left without privilege', () => {
    const ch = new SignalsChannel({ ...ideal.signals, range: 15 }, false, new Rng(1));
    expect(ch.read(stopRecord(red))).toMatchObject({ stopId: 7, light: 'unknown' });
    const close = ch.read(stopRecord({ ...red, distance: 10 }));
    expect(close.light).toBe('red');
    expect(close.timeLeft).toBeNaN();
    expect(new SignalsChannel(ideal.signals, true, new Rng(1)).read(stopRecord(red)).timeLeft).toBe(12);
  });

  it('misses and misclassifies at the configured rates, never at unsignalized junctions', () => {
    const ch = new SignalsChannel({ ...ideal.signals, missRate: 0.1, misclassify: 0.2 }, false, new Rng(3));
    const reads = Array.from({ length: N }, () => ch.read(stopRecord(red)).light);
    const rate = (l: string) => reads.filter((r) => r === l).length / N;
    expect(rate('unknown')).toBeCloseTo(0.1, 1);
    expect(rate('red')).toBeCloseTo(0.9 * 0.8, 1);
    expect(rate('green') + rate('yellow')).toBeCloseTo(0.9 * 0.2, 1);
    expect(ch.read(stopRecord({ distance: 5, light: 'none', timeLeft: 0 })).light).toBe('none');
    expect(ch.read(stopRecord(null))).toEqual({ stopId: -1, light: 'none', timeLeft: 0 });
  });
});
