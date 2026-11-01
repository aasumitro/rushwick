import type { Rng } from '../../core/rng';
import type { Aabb } from '../../core/segment';
import type { Building } from '../types';

export interface SkylineParams {
  /** Peak extra height at the city centre. */
  downtownHeight: number;
  /** Radius over which the downtown bonus decays. */
  halfSize: number;
  /** 1 for the urban core, < 1 for the outskirts. */
  heightScale: number;
}

const FLOOR = 3.2;

function downtownFactor(x: number, y: number, halfSize: number): number {
  return Math.exp(-((x * x + y * y) / (halfSize * halfSize)) * 2.2);
}

/** Subdivide a lot into a grid of buildings (interior cells of big blocks stay as courtyards). */
export function makeBuildings(lot: Aabb, rng: Rng, p: SkylineParams): Building[] {
  const out: Building[] = [];
  const w = lot.maxX - lot.minX;
  const d = lot.maxY - lot.minY;
  if (w < 6 || d < 6) return out;
  const nx = Math.max(1, Math.round(w / rng.range(17, 30)));
  const ny = Math.max(1, Math.round(d / rng.range(17, 30)));
  const cellW = w / nx;
  const cellD = d / ny;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (nx > 2 && ny > 2 && i > 0 && i < nx - 1 && j > 0 && j < ny - 1) continue;
      const gap = rng.range(1.2, 3.5);
      const x = lot.minX + (i + 0.5) * cellW;
      const y = lot.minY + (j + 0.5) * cellD;
      const f = downtownFactor(x, y, p.halfSize) * p.heightScale;
      let h = rng.range(9, 24) + p.downtownHeight * f * rng.range(0.25, 1.0);
      if (rng.chance(0.1 * f)) h *= 1.5;
      h = Math.max(6.4, Math.round(h / FLOOR) * FLOOR);
      out.push({ x, y, width: cellW - gap, depth: cellD - gap, height: h, style: rng.int(0, 4) });
    }
  }
  return out;
}
