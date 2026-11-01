import type { EgoVehicle } from '../ego/egoVehicle';
import type { Route } from '../ego/route';
import type { City, ConnectorSegment } from '../world/types';

/**
 * Connectors background traffic must not reserve because the ego occupies
 * them, or is about to enter its next one.
 */
export function computeEgoBlocked(city: City, ego: EgoVehicle, route: Route | null, progress: number, out: Set<number>): void {
  out.clear();
  for (const n of city.nodes) {
    if (Math.abs(ego.x - n.center.x) > n.extentX + 3 || Math.abs(ego.y - n.center.y) > n.extentY + 3) continue;
    for (const cid of n.connectors) {
      const c = city.segments[cid] as ConnectorSegment;
      if (c.path.project(ego).distance < ego.params.width / 2 + 1.6) out.add(cid);
    }
  }
  if (route && ego.speed > 1.5) {
    const stop = route.nextStop(progress);
    if (stop && stop.s - progress - ego.params.length / 2 < ego.speed * 1.5 + 2) out.add(stop.connector);
  }
}
