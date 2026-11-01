import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { dirname } from 'node:path';
import { encodeObservation, FEATURE_VERSION, type DrivingAction, type Observation, type SensorConfig } from '../../src/sim';

/**
 * Writes subsampled (features, action) pairs as JSON lines for imitation
 * learning. Features always come from the sensed observation, encoded with the
 * simulation's own sensor config; each row names its profile and feature version.
 */
export class Recorder {
  private readonly out: WriteStream;
  private readonly every: number;
  private step = 0;
  rows = 0;

  constructor(
    path: string,
    hz: number,
    dt: number,
    private readonly profile: string,
    private readonly sensors: SensorConfig,
  ) {
    mkdirSync(dirname(path), { recursive: true });
    this.out = createWriteStream(path);
    this.every = Math.max(1, Math.round(1 / (hz * dt)));
  }

  record(episode: number, obs: Observation, action: DrivingAction): void {
    if (this.step++ % this.every !== 0) return;
    const features = Array.from(encodeObservation(obs, this.sensors), (v) => Math.round(v * 1e4) / 1e4);
    const row = { episode, t: Math.round(obs.time * 100) / 100, profile: this.profile, featureVersion: FEATURE_VERSION, features, action };
    this.out.write(`${JSON.stringify(row)}\n`);
    this.rows++;
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.out.end(resolve));
  }
}
