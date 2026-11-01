import { describe, expect, it } from 'vitest';
import type { City, ConnectorSegment } from '../types';
import { generateCity } from './index';

const conn = (city: City, id: number) => city.segments[id] as ConnectorSegment;

describe.each(['left', 'right'] as const)('signal plans (%s-hand traffic)', (drivingSide) => {
  it('only shares a green between conflicting movements when one must yield', () => {
    const city = generateCity({ seed: 7, drivingSide });
    for (const plan of city.signals) {
      for (const stage of plan.stages) {
        const green = new Set(stage.connectors);
        for (const id of stage.connectors) {
          const c = conn(city, id);
          for (const other of c.conflicts.filter((k) => green.has(k))) {
            const o = conn(city, other);
            const resolved = c.yieldTo.includes(other) || o.yieldTo.includes(id) || (c.turn === 'far' && o.turn === 'far');
            expect(resolved, `node ${plan.nodeId}: ${id} vs ${other}`).toBe(true);
          }
        }
      }
    }
  });

  it('never shares a green between conflicting movements in protected mode', () => {
    const city = generateCity({ seed: 7, drivingSide, signalMode: 'protected' });
    for (const plan of city.signals) {
      for (const stage of plan.stages) {
        const green = new Set(stage.connectors);
        for (const id of stage.connectors) expect(conn(city, id).conflicts.some((k) => green.has(k))).toBe(false);
      }
    }
  });

  it('assigns stages to signalised connectors only, and a walk stage to each signalised crosswalk', () => {
    const city = generateCity({ seed: 7, drivingSide });
    for (const n of city.nodes) {
      for (const id of n.connectors) expect(conn(city, id).stage >= 0).toBe(n.signalized);
    }
    for (const cw of city.crosswalks) {
      if (city.nodes[cw.nodeId]!.signalized) expect(cw.walkStages.length).toBeGreaterThan(0);
    }
  });
});
