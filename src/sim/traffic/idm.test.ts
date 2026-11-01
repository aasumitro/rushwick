import { describe, expect, it } from 'vitest';
import { idmAccel, idmFree } from './idm';

const P = { aMax: 1.5, bComf: 2, T: 1.5, s0: 2 };

describe('IDM', () => {
  it('accelerates on a free road and stops accelerating at the desired speed', () => {
    expect(idmFree(P, 0, 14)).toBeCloseTo(1.5);
    expect(Math.abs(idmFree(P, 14, 14))).toBeLessThan(1e-9);
    expect(idmFree(P, 20, 14)).toBeLessThan(0);
  });

  it('stops behind a stationary obstacle without colliding', () => {
    let x = 0;
    let v = 14;
    const obstacle = 200;
    for (let t = 0; t < 60; t += 0.05) {
      const a = Math.max(-8, idmAccel(P, v, 14, obstacle - x, 0));
      v = Math.max(0, v + a * 0.05);
      x += v * 0.05;
    }
    expect(obstacle - x).toBeGreaterThan(P.s0 * 0.8);
    expect(obstacle - x).toBeLessThan(P.s0 * 2);
    expect(v).toBeLessThan(0.05);
  });
});
