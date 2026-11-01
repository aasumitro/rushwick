import { describe, expect, it } from 'vitest';
import type { StopObservation } from '../../ego/observation';
import { SignalDecision } from './signalDecision';

const at = (distance: number, light: StopObservation['light']): StopObservation => ({ distance, light, timeLeft: Number.NaN });

describe('SignalDecision', () => {
  it('stops at red and goes on green or at unsignalized junctions', () => {
    expect(new SignalDecision().stopDistance(at(30, 'red'), 10)).toBe(30);
    expect(new SignalDecision().stopDistance(at(30, 'green'), 10)).toBeNull();
    expect(new SignalDecision().stopDistance(at(30, 'none'), 10)).toBeNull();
  });

  it('stops for an unknown light when stopping is comfortable', () => {
    expect(new SignalDecision().stopDistance(at(40, 'unknown'), 10)).toBe(40); // needs 1.25 m/s²
  });

  it('keeps going through an unknown light it cannot stop for, without changing its mind', () => {
    const d = new SignalDecision();
    expect(d.stopDistance(at(10, 'unknown'), 12)).toBeNull(); // needs 7.2 m/s²
    expect(d.stopDistance(at(8, 'unknown'), 4)).toBeNull();
    expect(d.stopDistance(at(6, 'yellow'), 4)).toBeNull();
  });
});
