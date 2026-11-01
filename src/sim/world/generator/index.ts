import { Rng } from '../../core/rng';
import type { City, CityConfig } from '../types';
import { buildBlocks, gridEdges } from './blocks';
import { computeConflicts } from './conflicts';
import { buildCrosswalks } from './crosswalks';
import { DEFAULT_CITY_CONFIG } from './defaults';
import { createLayout, createNodes } from './layout';
import { buildConnectors } from './movements';
import { buildPedNetwork } from './pedNetwork';
import { buildRoads } from './roads';
import { buildSignalPlans } from './signalPlans';
import { buildStreetTrees } from './streetTrees';

export { DEFAULT_CITY_CONFIG };

/** Procedurally generate a grid city: roads, junctions, signals, sidewalks and buildings. */
export function generateCity(partial: Partial<CityConfig> = {}): City {
  const config: CityConfig = { ...DEFAULT_CITY_CONFIG, ...partial };
  if (config.gridX < 2 || config.gridY < 2) throw new Error('City grid must be at least 2x2');
  const ctx = createLayout(config, new Rng(config.seed).fork('city'));
  createNodes(ctx);
  buildRoads(ctx);
  buildConnectors(ctx);
  computeConflicts(ctx);
  buildCrosswalks(ctx);
  const signals = buildSignalPlans(ctx);
  const { pedNodes, pedEdges } = buildPedNetwork(ctx);
  const blocks = buildBlocks(ctx);
  const e = gridEdges(ctx);
  const D = config.outerDepth;
  return {
    config,
    bounds: { minX: e.minX - D, minY: e.minY - D, maxX: e.maxX + D, maxY: e.maxY + D },
    xs: ctx.xs,
    ys: ctx.ys,
    roads: ctx.roads,
    nodes: ctx.nodes,
    segments: ctx.segments,
    lanes: ctx.lanes,
    crosswalks: ctx.crosswalks,
    pedNodes,
    pedEdges,
    blocks,
    cornerRadius: config.sidewalkWidth + config.stopGap,
    signals,
    streetTrees: buildStreetTrees(ctx),
  };
}
