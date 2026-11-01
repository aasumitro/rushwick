import { describe, expect, it } from 'vitest';
import { generateCity } from '../../world/generator';
import type { ConnectorSegment } from '../../world/types';
import { SignalSystem } from './signalSystem';

describe('SignalSystem', () => {
  const city = generateCity({ seed: 3 });
  const signals = new SignalSystem(city);
  const plan = city.signals[0]!;
  const conns = plan.stages.flatMap((s) => s.connectors).map((id) => city.segments[id] as ConnectorSegment);

  it('gives green to exactly one stage at a time and cycles through all of them', () => {
    const seen = new Set<number>();
    for (let t = 0; t < plan.cycle; t += 0.5) {
      signals.update(t);
      const greenStages = new Set(conns.filter((c) => signals.connectorState(c) === 'green').map((c) => c.stage));
      expect(greenStages.size).toBeLessThanOrEqual(1);
      greenStages.forEach((s) => seen.add(s));
    }
    expect(seen.size).toBe(plan.stages.length);
  });

  it('never shows WALK across a straight movement that has green', () => {
    for (let t = 0; t < plan.cycle; t += 0.5) {
      signals.update(t);
      for (const cwId of city.nodes[plan.nodeId]!.crosswalks) {
        if (signals.crosswalkState(city.crosswalks[cwId]!) !== 'walk') continue;
        const crossingGreen = conns.filter((c) => c.crosswalks.includes(cwId) && c.turn === 'straight' && signals.connectorState(c) !== 'red');
        expect(crossingGreen).toEqual([]);
      }
    }
  });

  it('reports time until the next change', () => {
    signals.update(0);
    const c = conns[0]!;
    expect(signals.connectorTimeLeft(c)).toBeGreaterThan(0);
    expect(signals.connectorTimeLeft(c)).toBeLessThanOrEqual(plan.cycle);
  });
});
