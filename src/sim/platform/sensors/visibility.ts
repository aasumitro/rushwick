import { obbCorners } from '../../core/obb';
import type { Aabb } from '../../core/segment';
import { SpatialGrid } from '../../core/spatialGrid';
import { toLocal } from '../../core/vec2';
import type { WorldView } from '../../ego/observation';
import type { Pedestrian } from '../../pedestrians';
import type { Vehicle } from '../../traffic/vehicles';
import { inView, isVisible, type Occluder, type SightScene } from './occlusion';
import type { ObjectsChannelConfig } from './types';

/** Ids of the agents with a clear line of sight from the ego center. */
export interface VisibleSets {
  vehicles: Set<number>;
  pedestrians: Set<number>;
}

/** Occlusion by building footprints and nearer vehicles, for agents inside the detector's range and field of view. */
export class Visibility {
  private grid: SpatialGrid | null = null;
  private boxes: Aabb[] = [];
  /** Largest building half-diagonal (m), so a center query finds every footprint that reaches a point. */
  private reach = 0;

  constructor(private readonly cfg: ObjectsChannelConfig) {}

  compute(w: WorldView): VisibleSets {
    const { ego } = w;
    const r = this.cfg.range;
    const near: Vehicle[] = [];
    const occluders: Occluder[] = [];
    w.vehicleGrid.query(ego.x, ego.y, r + 6, (i) => {
      const v = w.vehicles[i] as Vehicle;
      near.push(v);
      occluders.push({ id: v.id, obb: w.vehicleObb(v) });
    });
    const scene: SightScene = { origin: ego, buildings: this.buildingsNear(w, r), vehicles: occluders };
    const out: VisibleSets = { vehicles: new Set(), pedestrians: new Set() };
    const seen = (x: number, y: number) => {
      const l = toLocal(x, y, ego.x, ego.y, ego.heading);
      return inView(l.x, l.y, this.cfg);
    };
    near.forEach((v, i) => {
      if (seen(v.x, v.y) && isVisible(scene, [v, ...obbCorners(occluders[i]!.obb)], v.id)) out.vehicles.add(v.id);
    });
    w.pedGrid.query(ego.x, ego.y, r, (i) => {
      const p = w.peds[i] as Pedestrian;
      if (seen(p.x, p.y) && isVisible(scene, [p], -1)) out.pedestrians.add(p.id);
    });
    return out;
  }

  private buildingsNear(w: WorldView, r: number): Aabb[] {
    if (!this.grid) this.index(w);
    const out: Aabb[] = [];
    this.grid!.query(w.ego.x, w.ego.y, r + this.reach, (i) => out.push(this.boxes[i]!));
    return out;
  }

  /** Building footprints are static: index them once per episode. Buildings are centered at (x, y), width along x. */
  private index(w: WorldView): void {
    const b = w.city.bounds;
    this.grid = new SpatialGrid(b.minX, b.minY, b.maxX, b.maxY, 20);
    for (const blk of w.city.blocks) {
      for (const f of blk.buildings) {
        this.grid.insert(this.boxes.length, f.x, f.y);
        this.boxes.push({ minX: f.x - f.width / 2, minY: f.y - f.depth / 2, maxX: f.x + f.width / 2, maxY: f.y + f.depth / 2 });
        this.reach = Math.max(this.reach, Math.hypot(f.width, f.depth) / 2);
      }
    }
  }
}
