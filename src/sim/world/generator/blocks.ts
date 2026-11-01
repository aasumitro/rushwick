import type { Rng } from '../../core/rng';
import type { Aabb } from '../../core/segment';
import type { Vec2 } from '../../core/vec2';
import type { Block } from '../types';
import { makeBuildings, type SkylineParams } from './buildings';
import type { GenContext } from './context';

const shrink = (b: Aabb, m: number): Aabb => ({ minX: b.minX + m, minY: b.minY + m, maxX: b.maxX - m, maxY: b.maxY - m });

/** Outer edges of the road grid (curb lines of the perimeter roads). */
export function gridEdges(ctx: GenContext): Aabb {
  const { gridX, gridY } = ctx.config;
  return {
    minX: ctx.xs[0]! - ctx.hwV[0]!,
    maxX: ctx.xs[gridX - 1]! + ctx.hwV[gridX - 1]!,
    minY: ctx.ys[0]! - ctx.hwH[0]!,
    maxY: ctx.ys[gridY - 1]! + ctx.hwH[gridY - 1]!,
  };
}

function interiorBlock(ctx: GenContext, rng: Rng, gx: number, gy: number, sky: SkylineParams, id: number): Block {
  const bounds: Aabb = {
    minX: ctx.xs[gx]! + ctx.hwV[gx]!,
    maxX: ctx.xs[gx + 1]! - ctx.hwV[gx + 1]!,
    minY: ctx.ys[gy]! + ctx.hwH[gy]!,
    maxY: ctx.ys[gy + 1]! - ctx.hwH[gy + 1]!,
  };
  const lot = shrink(bounds, ctx.config.sidewalkWidth + 1.0);
  const park = rng.chance(ctx.config.parkProbability);
  const trees: Vec2[] = [];
  if (park) {
    const count = Math.floor(((lot.maxX - lot.minX) * (lot.maxY - lot.minY)) / 110);
    for (let k = 0; k < count; k++) trees.push({ x: rng.range(lot.minX + 2, lot.maxX - 2), y: rng.range(lot.minY + 2, lot.maxY - 2) });
  }
  const cornerRadius = ctx.config.sidewalkWidth + ctx.config.stopGap;
  const buildings = park ? [] : makeBuildings(lot, rng, sky);
  return { id, bounds, cornerRadius, kind: park ? 'park' : 'buildings', buildings, trees };
}

/** Four strips framing the grid; only the row facing the city is built up. */
function outerBlock(ctx: GenContext, rng: Rng, bounds: Aabb, edges: Aabb, sky: SkylineParams, id: number): Block {
  const lot = shrink(bounds, ctx.config.sidewalkWidth + 1.0);
  const horizontal = bounds.maxX - bounds.minX > bounds.maxY - bounds.minY;
  const depth = Math.min(rng.range(20, 28), horizontal ? lot.maxY - lot.minY : lot.maxX - lot.minX);
  const facing: Aabb = { ...lot };
  if (horizontal) {
    if (bounds.maxY === edges.minY) facing.minY = lot.maxY - depth;
    else facing.maxY = lot.minY + depth;
  } else if (bounds.maxX === edges.minX) facing.minX = lot.maxX - depth;
  else facing.maxX = lot.minX + depth;
  return { id, bounds, cornerRadius: 0, kind: 'buildings', buildings: makeBuildings(facing, rng, { ...sky, heightScale: 0.5 }), trees: [] };
}

export function buildBlocks(ctx: GenContext): Block[] {
  const rng = ctx.rng.fork('blocks');
  const e = gridEdges(ctx);
  const D = ctx.config.outerDepth;
  const sky: SkylineParams = { downtownHeight: ctx.config.downtownHeight, halfSize: Math.max(e.maxX - e.minX, e.maxY - e.minY) / 2, heightScale: 1 };
  const blocks: Block[] = [];
  for (let gy = 0; gy < ctx.config.gridY - 1; gy++) {
    for (let gx = 0; gx < ctx.config.gridX - 1; gx++) blocks.push(interiorBlock(ctx, rng, gx, gy, sky, blocks.length));
  }
  const frame: Aabb[] = [
    { minX: e.minX - D, minY: e.minY - D, maxX: e.maxX + D, maxY: e.minY },
    { minX: e.minX - D, minY: e.maxY, maxX: e.maxX + D, maxY: e.maxY + D },
    { minX: e.minX - D, minY: e.minY, maxX: e.minX, maxY: e.maxY },
    { minX: e.maxX, minY: e.minY, maxX: e.maxX + D, maxY: e.maxY },
  ];
  for (const bounds of frame) blocks.push(outerBlock(ctx, rng, bounds, e, sky, blocks.length));
  return blocks;
}
