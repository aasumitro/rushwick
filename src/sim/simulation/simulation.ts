import type { DrivingAction } from '../ego/egoParams';
import type { EgoVehicle } from '../ego/egoVehicle';
import { buildObservation, type Observation } from '../ego/observation';
import type { Route } from '../ego/route';
import type { EpisodeMetrics } from '../metrics';
import { getProfile, resolveProfile, type ResolvedProfile } from '../platform';
import { CityWorld } from './cityWorld';
import { stateHash } from './diagnostics';
import { EgoEpisode } from './egoEpisode';
import { noEvents, type StepEvents } from './types';
import { worldView } from './worldView';

const NONE: ReadonlySet<number> = new Set();

/**
 * Headless, deterministic simulation of a dense city plus one ego vehicle.
 * Rendering is a separate read-only layer; the same class runs in the
 * browser, in Vitest and in Node batch scripts.
 */
export class Simulation extends CityWorld {
  /** Episodes started so far (also seeds each episode's spawn). */
  episodes = 0;
  lastEvents: StepEvents = noEvents();
  /** `config.profile` in sim units. */
  readonly platform: ResolvedProfile = resolveProfile(getProfile(this.config.profile));
  private episode: EgoEpisode | null = null;

  get ego(): EgoVehicle | null {
    return this.episode?.ego ?? null;
  }

  get route(): Route | null {
    return this.episode?.route ?? null;
  }

  get progress(): number {
    return this.episode?.progress ?? 0;
  }

  get episodeDone(): boolean {
    return this.episode?.done ?? false;
  }

  /** False when the platform ignores the next step's action (between control ticks), so drivers may skip `act()`. */
  get controlDue(): boolean {
    return this.episode?.controlDue ?? true;
  }

  /** Place the ego with a fresh random route; starts a new episode. */
  spawnEgo(): boolean {
    if (!this.config.ego.enabled) return false;
    this.episode = EgoEpisode.start(this, this.rng.fork(`ego:${this.episodes++}`));
    this.reindex();
    this.sense();
    return this.episode !== null;
  }

  /** What the ego's platform perceives this step (exact for `ideal`). A pure read: call it any number of times. */
  observe(): Observation {
    return this.episode?.models?.sensors.current ?? this.observeIdeal();
  }

  /** The exact observation, whatever the platform (privileged teachers, debugging). */
  observeIdeal(): Observation {
    if (!this.episode) throw new Error('observe() requires an ego vehicle; call spawnEgo() first');
    return buildObservation(worldView(this, this.episode), this.config.sensors);
  }

  episodeMetrics(): EpisodeMetrics | null {
    return this.episode?.metrics() ?? null;
  }

  /** Advance one fixed step; `action` drives the ego (ignored when there is none). */
  step(action: DrivingAction | null): StepEvents {
    const ego = this.ego;
    const obstacle = ego ? { obb: ego.obb(), speed: ego.speed, heading: ego.heading } : null;
    this.advanceBackground(obstacle, this.episode?.blockedConnectors(this.city) ?? NONE);
    this.lastEvents = this.episode ? this.episode.step(this, action) : noEvents();
    this.sense();
    return this.lastEvents;
  }

  /** Sensors sample once per physics step, here, so observe() call counts never change the RNG streams (D3). */
  private sense(): void {
    const ep = this.episode;
    if (ep?.models && !ep.done) ep.models.sensors.update(worldView(this, ep));
  }

  /** Deterministic fingerprint of the dynamic state (see diagnostics.ts). */
  stateHash(): number {
    return stateHash(this.vehicles, this.pedestrians.peds, this.ego);
  }
}
