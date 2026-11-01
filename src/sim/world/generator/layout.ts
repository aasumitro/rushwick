import type { Rng } from '../../core/rng';
import type { CityConfig, Intersection } from '../types';
import { isArterialLine, type GenContext } from './context';

/** Randomised, centred road-line coordinates (rounded to 0.1 m). */
function linePositions(config: CityConfig, n: number, rng: Rng): number[] {
  const out = [0];
  for (let i = 1; i < n; i++) out.push((out[i - 1] as number) + rng.range(config.minSpacing, config.maxSpacing));
  const mid = (out[n - 1] as number) / 2;
  return out.map((v) => Math.round((v - mid) * 10) / 10);
}

export function createLayout(config: CityConfig, rng: Rng): GenContext {
  const xs = linePositions(config, config.gridX, rng.fork('xs'));
  const ys = linePositions(config, config.gridY, rng.fork('ys'));
  const halfWidth = (i: number, n: number) =>
    (isArterialLine(config, i, n) ? config.arterialLanes : config.localLanes) * config.laneWidth;
  return {
    config,
    rng,
    xs,
    ys,
    hwV: xs.map((_, i) => halfWidth(i, config.gridX)),
    hwH: ys.map((_, i) => halfWidth(i, config.gridY)),
    nodes: [],
    roads: [],
    segments: [],
    lanes: [],
    crosswalks: [],
  };
}

export function createNodes(ctx: GenContext): void {
  const { config } = ctx;
  const reach = config.sidewalkWidth + config.stopGap;
  for (let gy = 0; gy < config.gridY; gy++) {
    for (let gx = 0; gx < config.gridX; gx++) {
      const hwV = ctx.hwV[gx] as number;
      const hwH = ctx.hwH[gy] as number;
      const node: Intersection = {
        id: ctx.nodes.length,
        gx,
        gy,
        center: { x: ctx.xs[gx] as number, y: ctx.ys[gy] as number },
        arms: [null, null, null, null],
        hwV,
        hwH,
        extentX: hwV + reach,
        extentY: hwH + reach,
        connectors: [],
        crosswalks: [],
        signalized: false,
      };
      ctx.nodes.push(node);
    }
  }
}
