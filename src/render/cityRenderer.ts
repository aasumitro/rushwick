import * as THREE from 'three';
import type { Simulation } from '../sim';
import { EgoActor } from './agents/egoActor';
import { PedestrianLayer } from './agents/pedestrianLayer';
import { VehicleLayer } from './agents/vehicleLayer';
import { CameraRig, type CameraMode } from './camera/cameraRig';
import { createBlocks } from './city/blockLayer';
import { createBuildings } from './city/buildingLayer';
import { createGround } from './city/groundLayer';
import { createMarkings } from './city/markingLayer';
import { SignalLayer } from './city/signalLayer';
import { createTrees } from './city/vegetationLayer';
import { interpolate } from './core/coords';
import { createStage, followSun, type Stage } from './core/createStage';
import { disposeObject } from './core/dispose';
import { LidarOverlay } from './overlays/lidarOverlay';
import { RouteOverlay } from './overlays/routeOverlay';

export interface RenderOptions {
  showRoute: boolean;
  showLidar: boolean;
  lidar: readonly number[] | null;
}

/** Read-only 3D view of a Simulation. Rebuild the static city with `load()` after a reset. */
export class CityRenderer {
  readonly rig: CameraRig;
  private readonly stage: Stage;
  private world = new THREE.Group();
  private signals: SignalLayer | null = null;
  private vehicles: VehicleLayer | null = null;
  private peds: PedestrianLayer | null = null;
  private readonly ego = new EgoActor();
  private readonly route = new RouteOverlay();
  private lidar: LidarOverlay | null = null;
  private lastFrame = performance.now();

  constructor(private readonly container: HTMLElement) {
    this.stage = createStage(container);
    this.rig = new CameraRig(this.stage.renderer.domElement);
    this.stage.scene.add(this.ego.group, this.route.line);
    this.resize();
  }

  load(sim: Simulation): void {
    this.stage.scene.remove(this.world);
    disposeObject(this.world);
    this.world = new THREE.Group();
    const city = sim.city;
    this.signals = new SignalLayer(city);
    this.vehicles = new VehicleLayer(Math.max(64, sim.vehicles.length + 32));
    this.peds = new PedestrianLayer(Math.max(64, sim.pedestrians.peds.length + 32));
    this.lidar = new LidarOverlay(sim.config.sensors.lidarRays);
    this.world.add(
      createGround(city),
      createBlocks(city),
      createMarkings(city),
      createBuildings(city),
      createTrees(city),
      this.signals.group,
      this.vehicles.group,
      this.peds.group,
      this.lidar.lines,
    );
    this.stage.scene.add(this.world);
  }

  setCameraMode(mode: CameraMode): void {
    this.rig.setMode(mode);
  }

  render(sim: Simulation, alpha: number, opts: RenderOptions): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.signals?.update(sim.signals);
    this.vehicles?.update(sim.vehicles, alpha);
    this.peds?.update(sim.pedestrians.peds, alpha);
    this.ego.update(sim.ego, alpha);
    this.route.update(sim.route, opts.showRoute);
    this.lidar?.update(sim.ego, opts.lidar, opts.showLidar);
    this.rig.update(sim.ego ? interpolate(sim.ego, alpha) : null, dt);
    followSun(this.stage.sun, this.rig.controls.target);
    this.stage.renderer.render(this.stage.scene, this.rig.camera);
  }

  resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.stage.renderer.setSize(w, h);
    this.rig.resize(w, h);
  }

  dispose(): void {
    disposeObject(this.stage.scene);
    this.rig.controls.dispose();
    this.stage.renderer.dispose();
    this.stage.renderer.domElement.remove();
  }
}
