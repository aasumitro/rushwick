import type { Rng } from '../../core/rng';
import type { CityConfig, Crosswalk, Intersection, Road, Segment } from '../types';

/** Mutable state threaded through the generation stages. */
export interface GenContext {
  config: CityConfig;
  rng: Rng;
  /** Road line coordinates and half-widths (V = north-south roads, H = east-west roads). */
  xs: number[];
  ys: number[];
  hwV: number[];
  hwH: number[];
  nodes: Intersection[];
  roads: Road[];
  segments: Segment[];
  lanes: number[];
  crosswalks: Crosswalk[];
}

export function isArterialLine(config: CityConfig, index: number, count: number): boolean {
  return index === 0 || index === count - 1 || index % config.arterialEvery === 0;
}

export const nodeIdAt = (ctx: GenContext, gx: number, gy: number): number => gy * ctx.config.gridX + gx;
