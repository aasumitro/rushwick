import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { dirname } from 'node:path';
import { encodeObservation, type DrivingAction, type Observation } from '../../src/sim';

/** Writes subsampled (features, action) pairs as JSON lines for imitation learning. */
export class Recorder {
  private readonly out: WriteStream;
  private readonly every: number;
  private step = 0;
  rows = 0;

  constructor(path: string, hz: number, dt: number) {
    mkdirSync(dirname(path), { recursive: true });
    this.out = createWriteStream(path);
    this.every = Math.max(1, Math.round(1 / (hz * dt)));
  }

  record(episode: number, obs: Observation, action: DrivingAction): void {
    if (this.step++ % this.every !== 0) return;
    const features = Array.from(encodeObservation(obs), (v) => Math.round(v * 1e4) / 1e4);
    this.out.write(`${JSON.stringify({ episode, t: Math.round(obs.time * 100) / 100, features, action })}\n`);
    this.rows++;
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.out.end(resolve));
  }
}
