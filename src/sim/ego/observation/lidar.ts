import type { Obb } from '../../core/obb';
import { rayAabb, rayCircle, rayObb } from '../../core/ray';
import type { Pedestrian } from '../../pedestrians';
import type { Vehicle } from '../../traffic/vehicles';
import type { SensorConfig } from './sensorConfig';
import type { WorldView } from './worldView';

const PED_RADIUS = 0.3;

/** 2D range scan from the ego centre against vehicles, pedestrians and curbs (block outlines). */
export function castLidar(w: WorldView, cfg: SensorConfig): number[] {
  const { ego } = w;
  const R = cfg.lidarRange;
  const boxes: Obb[] = [];
  w.vehicleGrid.query(ego.x, ego.y, R + 6, (i) => boxes.push(w.vehicleObb(w.vehicles[i] as Vehicle)));
  const peds: Pedestrian[] = [];
  w.pedGrid.query(ego.x, ego.y, R + 1, (i) => peds.push(w.peds[i] as Pedestrian));
  const out: number[] = [];
  for (let r = 0; r < cfg.lidarRays; r++) {
    const ang = ego.heading + (2 * Math.PI * r) / cfg.lidarRays;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    let best = R;
    for (const b of boxes) best = Math.min(best, rayObb(ego.x, ego.y, dx, dy, b));
    for (const p of peds) best = Math.min(best, rayCircle(ego.x, ego.y, dx, dy, p.x, p.y, PED_RADIUS));
    for (const blk of w.city.blocks) {
      const bb = blk.bounds;
      best = Math.min(best, rayAabb(ego.x, ego.y, dx, dy, bb.minX, bb.minY, bb.maxX, bb.maxY));
    }
    out.push(best);
  }
  return out;
}
