import type { Obb } from '../../core/obb';
import { rayAabb, rayObb } from '../../core/ray';
import type { Aabb } from '../../core/segment';
import type { Vec2 } from '../../core/vec2';
import type { ObjectsChannelConfig } from './types';

/** A sight line counts as blocked only by something this much (m) nearer than its end. */
const EPS = 0.05;

export interface Occluder {
  id: number;
  obb: Obb;
}

/** What can block a line of sight from `origin`: building footprints and vehicle bodies. */
export interface SightScene {
  origin: Vec2;
  buildings: readonly Aabb[];
  vehicles: readonly Occluder[];
}

/** True when an ego-frame point lies within the detector's range and field of view. */
export function inView(x: number, y: number, cfg: Pick<ObjectsChannelConfig, 'range' | 'fovDeg'>): boolean {
  if (x * x + y * y > cfg.range * cfg.range) return false;
  return cfg.fovDeg >= 360 || Math.abs(Math.atan2(y, x)) <= (cfg.fovDeg * Math.PI) / 360;
}

/** True when the straight line from the origin to `p` hits no building and no vehicle other than `selfId`. */
export function clearLine(scene: SightScene, p: Vec2, selfId: number): boolean {
  const { x: ox, y: oy } = scene.origin;
  const d = Math.hypot(p.x - ox, p.y - oy);
  if (d < EPS) return true;
  const dx = (p.x - ox) / d;
  const dy = (p.y - oy) / d;
  const lo = { x: Math.min(ox, p.x), y: Math.min(oy, p.y) };
  const hi = { x: Math.max(ox, p.x), y: Math.max(oy, p.y) };
  for (const b of scene.buildings) {
    if (b.maxX < lo.x || b.minX > hi.x || b.maxY < lo.y || b.minY > hi.y) continue;
    if (rayAabb(ox, oy, dx, dy, b.minX, b.minY, b.maxX, b.maxY) < d - EPS) return false;
  }
  for (const v of scene.vehicles) {
    if (v.id !== selfId && rayObb(ox, oy, dx, dy, v.obb) < d - EPS) return false;
  }
  return true;
}

/** Visible when at least one sight point (center, plus the corners of a vehicle) has a clear line. */
export const isVisible = (scene: SightScene, points: readonly Vec2[], selfId: number): boolean => points.some((p) => clearLine(scene, p, selfId));
