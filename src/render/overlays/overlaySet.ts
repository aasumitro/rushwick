import * as THREE from 'three';
import type { Observation, Simulation } from '../../sim';
import { interpolate } from '../core/coords';
import { LidarOverlay } from './lidarOverlay';
import { RouteOverlay } from './routeOverlay';
import { SensedOverlay } from './sensedOverlay';

export interface OverlayOptions {
  showRoute: boolean;
  showLidar: boolean;
  showSensed: boolean;
  /** The observation the decision model last received (sensed on realistic platforms). */
  sensed: Observation | null;
}

/** Debug overlays over the city: the route, the lidar scan and the sensed road users. */
export class OverlaySet {
  readonly group = new THREE.Group();
  private readonly route = new RouteOverlay();
  private lidar: LidarOverlay | null = null;
  private sensed: SensedOverlay | null = null;

  constructor() {
    this.group.add(this.route.line);
  }

  /** Size the per-city overlays and add them to `world`, which the renderer disposes on reload. */
  load(sim: Simulation, world: THREE.Group): void {
    this.lidar = new LidarOverlay(sim.config.sensors.lidarRays);
    this.sensed = new SensedOverlay(2 * sim.config.sensors.maxAgents);
    world.add(this.lidar.lines, this.sensed.lines);
  }

  update(sim: Simulation, alpha: number, opts: OverlayOptions): void {
    this.route.update(sim.route, opts.showRoute);
    this.lidar?.update(sim.ego, opts.sensed?.lidar ?? null, opts.showLidar);
    this.sensed?.update(sim.ego ? interpolate(sim.ego, alpha) : null, opts.sensed, opts.showSensed);
  }
}
