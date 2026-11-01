import type { Rng } from '../core/rng';
import { EgoVehicle } from '../ego/egoVehicle';
import { planRoute, Route } from '../ego/route';
import type { City, LaneSegment } from '../world/types';
import type { EgoConfig } from './config';

export interface EgoPlacement {
  ego: EgoVehicle;
  route: Route;
  progress: number;
}

const START_S = 10;

/** Random start lane and a destination at least `minRouteDistance` away (straight line). */
export function placeEgo(city: City, cfg: EgoConfig, rng: Rng): EgoPlacement | null {
  const lanes = city.lanes.map((id) => city.segments[id] as LaneSegment).filter((l) => l.path.length >= cfg.spawnLaneMinLength);
  for (let attempt = 0; attempt < 80; attempt++) {
    const start = rng.pick(lanes);
    const p = start.path.sample(START_S);
    const far = lanes.filter((l) => {
      const m = l.path.sample(l.path.length / 2);
      return Math.hypot(m.x - p.x, m.y - p.y) >= cfg.minRouteDistance;
    });
    if (far.length === 0) continue;
    const dest = rng.pick(far);
    const segs = planRoute(city, start.id, dest.id);
    if (!segs) continue;
    const route = new Route(city, segs, START_S, dest.path.length * 0.6);
    if (route.length < cfg.minRouteDistance * 0.8) continue;
    const ego = new EgoVehicle(p.x, p.y, p.heading, cfg.params);
    return { ego, route, progress: route.path.project(p, 0, 20).s };
  }
  return null;
}
