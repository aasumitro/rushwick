import { Polyline } from '../../core/polyline';
import { add, scale } from '../../core/vec2';
import { DIR_VEC, Dir, drivingSideNormal, opposite, type Intersection, type LaneSegment, type Road } from '../types';
import { isArterialLine, nodeIdAt, type GenContext } from './context';

const extentAlong = (n: Intersection, d: Dir) => (d === Dir.E || d === Dir.W ? n.extentX : n.extentY);

/** Parallel lanes from `from` to `to`; index 0 is the curb lane. */
function makeLanes(ctx: GenContext, road: Road, from: Intersection, to: Intersection, dir: Dir): number[] {
  const u = DIR_VEC[dir]!;
  const nrm = drivingSideNormal(u, ctx.config.drivingSide);
  const ids: number[] = [];
  for (let i = 0; i < road.lanesPerDir; i++) {
    const off = scale(nrm, (road.lanesPerDir - 1 - i + 0.5) * road.laneWidth);
    const start = add(add(from.center, scale(u, extentAlong(from, dir))), off);
    const end = add(add(to.center, scale(u, -extentAlong(to, opposite(dir)))), off);
    const lane: LaneSegment = {
      id: ctx.segments.length,
      kind: 'lane',
      path: new Polyline([start, end]),
      speedLimit: road.speedLimit,
      next: [],
      prev: [],
      roadId: road.id,
      laneIndex: i,
      fromNode: from.id,
      toNode: to.id,
      dir,
      width: road.laneWidth,
      group: ids,
    };
    ctx.segments.push(lane);
    ctx.lanes.push(lane.id);
    ids.push(lane.id);
  }
  return ids;
}

function addRoad(ctx: GenContext, axis: 'h' | 'v', aId: number, bId: number, line: number): void {
  const { config } = ctx;
  const arterial = isArterialLine(config, line, axis === 'h' ? config.gridY : config.gridX);
  const lanesPerDir = arterial ? config.arterialLanes : config.localLanes;
  const road: Road = {
    id: ctx.roads.length,
    axis,
    a: aId,
    b: bId,
    roadClass: arterial ? 'arterial' : 'local',
    lanesPerDir,
    laneWidth: config.laneWidth,
    halfWidth: lanesPerDir * config.laneWidth,
    speedLimit: arterial ? config.arterialSpeed : config.localSpeed,
    lanesAB: [],
    lanesBA: [],
  };
  ctx.roads.push(road);
  const a = ctx.nodes[aId] as Intersection;
  const b = ctx.nodes[bId] as Intersection;
  const dirAB: Dir = axis === 'h' ? Dir.E : Dir.N;
  const dirBA = opposite(dirAB);
  road.lanesAB = makeLanes(ctx, road, a, b, dirAB);
  road.lanesBA = makeLanes(ctx, road, b, a, dirBA);
  a.arms[dirAB] = { dir: dirAB, roadId: road.id, incoming: road.lanesBA, outgoing: road.lanesAB };
  b.arms[dirBA] = { dir: dirBA, roadId: road.id, incoming: road.lanesAB, outgoing: road.lanesBA };
}

export function buildRoads(ctx: GenContext): void {
  const { gridX, gridY } = ctx.config;
  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX - 1; gx++) addRoad(ctx, 'h', nodeIdAt(ctx, gx, gy), nodeIdAt(ctx, gx + 1, gy), gy);
  }
  for (let gx = 0; gx < gridX; gx++) {
    for (let gy = 0; gy < gridY - 1; gy++) addRoad(ctx, 'v', nodeIdAt(ctx, gx, gy), nodeIdAt(ctx, gx, gy + 1), gx);
  }
}
