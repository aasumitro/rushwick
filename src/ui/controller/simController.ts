import { Simulation } from '../../sim';
import { CityRenderer } from '../../render/cityRenderer';
import { DEFAULT_LIVE, type LiveSettings, type WorldSettings } from '../settings';
import { EpisodeDriver } from './episodeDriver';
import { FixedStepLoop } from './fixedStepLoop';
import { KeyboardInput } from './keyboardInput';
import { takeSnapshot, type HudSnapshot } from './snapshot';

/** Owns the renderer, input and frame loop; delegates stepping to an EpisodeDriver. */
export class SimController {
  private readonly renderer: CityRenderer;
  private readonly keys = new KeyboardInput();
  private driver: EpisodeDriver | null = null;
  private loop: FixedStepLoop | null = null;
  private live: LiveSettings = { ...DEFAULT_LIVE };
  private frame = 0;
  private fps = 0;
  private last = performance.now();

  constructor(container: HTMLElement) {
    this.renderer = new CityRenderer(container);
    this.renderer.setCameraMode(this.live.camera);
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Build a new city (slow: generation + traffic warm-up). */
  loadWorld(w: WorldSettings): void {
    const sim = new Simulation({
      seed: w.seed,
      city: { drivingSide: w.drivingSide, signalMode: w.signalMode },
      vehicleCount: w.vehicleCount,
      pedestrianCount: w.pedestrianCount,
      jaywalkProbability: w.jaywalkProbability,
    });
    this.driver = new EpisodeDriver(sim, this.live.agent);
    this.loop = new FixedStepLoop(sim.config.dt);
    this.renderer.load(sim);
  }

  applyLive(live: LiveSettings): void {
    if (live.agent !== this.live.agent) this.driver?.setAgent(live.agent);
    if (live.camera !== this.live.camera) this.renderer.setCameraMode(live.camera);
    this.live = { ...live };
  }

  newEpisode(): void {
    this.driver?.newEpisode();
  }

  stepOnce(): void {
    this.driver?.advance(1, this.keys.read());
  }

  snapshot(): HudSnapshot | null {
    return this.driver ? takeSnapshot(this.driver.sim, this.driver.lastObs, this.fps) : null;
  }

  resize(): void {
    this.renderer.resize();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.keys.dispose();
    this.renderer.dispose();
  }

  private readonly tick = (now: number): void => {
    const realDt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    if (realDt > 0) this.fps = this.fps * 0.9 + 0.1 / realDt;
    const d = this.driver;
    let alpha = 1;
    if (d && this.loop && !this.live.paused) {
      const r = this.loop.advance(realDt, this.live.speed);
      d.advance(r.steps, this.keys.read());
      d.maybeRestart(realDt, this.live.autoRestart);
      alpha = r.alpha;
    }
    if (d) this.renderer.render(d.sim, alpha, { ...this.live, lidar: d.lastObs?.lidar ?? null });
    this.frame = requestAnimationFrame(this.tick);
  };
}
