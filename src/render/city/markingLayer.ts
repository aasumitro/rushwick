import * as THREE from 'three';
import type { City, Crosswalk, LaneSegment, Road } from '../../sim';
import { GeometryBuilder } from '../core/geometryBuilder';
import { PALETTE } from '../core/palette';

const Y = 0.02;
const LINE = 0.15;

/** Painted lane lines, stop lines and zebra crossings, merged into one mesh. */
export function createMarkings(city: City): THREE.Mesh {
  const g = new GeometryBuilder();
  const center = city.config.drivingSide === 'left' ? PALETTE.markingWhite : PALETTE.markingYellow;
  for (const road of city.roads) addRoadLines(g, city, road, center);
  for (const id of city.lanes) addStopLine(g, city.segments[id] as LaneSegment);
  for (const cw of city.crosswalks) addZebra(g, cw);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(g.build(), mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** Strip along a lane-parallel line at lateral `offset` (sim frame) between arc lengths a..b of the lane. */
function strip(g: GeometryBuilder, lane: LaneSegment, offset: number, a: number, b: number, color: number): void {
  const p = lane.path.sample((a + b) / 2);
  const nx = -Math.sin(p.heading);
  const ny = Math.cos(p.heading);
  g.flatRect(p.x + nx * offset, Y, -(p.y + ny * offset), b - a, LINE, p.heading, color);
}

function addRoadLines(g: GeometryBuilder, city: City, road: Road, centerColor: number): void {
  const lanes = road.lanesAB.map((id) => city.segments[id] as LaneSegment);
  const inner = lanes[lanes.length - 1] as LaneSegment; // lane next to the centre line
  const L = inner.path.length;
  const side = city.config.drivingSide === 'left' ? -1 : 1;
  const toCenter = (side * road.laneWidth) / 2; // centre line is half a lane beyond the inner lane
  for (const d of [-0.12, 0.12]) strip(g, inner, toCenter + d, 0, L, centerColor);
  for (const group of [road.lanesAB, road.lanesBA]) {
    for (let i = 0; i < group.length - 1; i++) {
      // Dashed separator half a lane from lane i towards the centre line.
      const lane = city.segments[group[i] as number] as LaneSegment;
      for (let s = 2; s + 3 < lane.path.length; s += 7) strip(g, lane, toCenter, s, s + 3, PALETTE.markingWhite);
    }
  }
}

function addStopLine(g: GeometryBuilder, lane: LaneSegment): void {
  const p = lane.path.sample(lane.path.length - 0.2);
  g.flatRect(p.x, Y, -p.y, 0.4, lane.width - 0.2, p.heading, PALETTE.markingWhite);
}

function addZebra(g: GeometryBuilder, cw: Crosswalk): void {
  const { area } = cw;
  const alongX = Math.abs(cw.b.x - cw.a.x) > Math.abs(cw.b.y - cw.a.y);
  const span = alongX ? area.maxX - area.minX : area.maxY - area.minY;
  const depth = (alongX ? area.maxY - area.minY : area.maxX - area.minX) - 0.6;
  const cx = (area.minX + area.maxX) / 2;
  const cy = (area.minY + area.maxY) / 2;
  for (let t = 0.5; t < span - 0.3; t += 1.0) {
    const x = alongX ? area.minX + t + 0.25 : cx;
    const y = alongX ? cy : area.minY + t + 0.25;
    g.flatRect(x, Y, -y, alongX ? 0.5 : depth, alongX ? depth : 0.5, 0, PALETTE.markingWhite);
  }
}
