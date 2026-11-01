import { isIdeal, type EpisodeMetrics, type Observation, type Simulation } from '../../sim';

/** Plain data the HUD renders; produced a few times per second. */
export interface HudSnapshot {
  time: number;
  fps: number;
  vehicles: number;
  pedestrians: number;
  meanTrafficSpeed: number;
  episode: number;
  platform: string;
  /** Delay of the newest command (ms); null when the platform applies commands instantly. */
  commandDelayMs: number | null;
  egoSpeedKmh: number;
  steerDeg: number;
  progress: number;
  nextLight: string;
  nextLightDistance: number | null;
  nearbyVehicles: number;
  nearbyPedestrians: number;
  metrics: EpisodeMetrics | null;
}

export function takeSnapshot(sim: Simulation, obs: Observation | null, fps: number): HudSnapshot {
  const vs = sim.vehicles;
  const stop = obs?.route.nextStop ?? null;
  const metrics = sim.episodeMetrics();
  return {
    time: sim.time,
    fps,
    vehicles: vs.length,
    pedestrians: sim.pedestrians.peds.length,
    meanTrafficSpeed: vs.length ? (vs.reduce((a, v) => a + v.speed, 0) / vs.length) * 3.6 : 0,
    episode: sim.episodes,
    platform: sim.platform.label,
    commandDelayMs: isIdeal(sim.platform) ? null : sim.commandDelay * 1000,
    egoSpeedKmh: (sim.ego?.speed ?? 0) * 3.6,
    steerDeg: ((sim.ego?.steer ?? 0) * 180) / Math.PI,
    progress: metrics?.completion ?? 0,
    nextLight: stop ? stop.light : '—',
    nextLightDistance: stop ? stop.distance : null,
    nearbyVehicles: obs?.vehicles.length ?? 0,
    nearbyPedestrians: obs?.pedestrians.length ?? 0,
    metrics,
  };
}
