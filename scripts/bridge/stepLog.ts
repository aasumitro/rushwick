import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { dirname } from 'node:path';
import type { DrivingAction } from '../../src/sim';

/** One physics step of a bridge run. */
export interface StepRecord {
  seq: number;
  stamp: number;
  /** Frame sent → its command received (ms); null when it did not arrive in time. */
  rttMs: number | null;
  /** The command applied this step (real units); null while braking for the watchdog. */
  command: DrivingAction | null;
  /** A control-tick frame whose command missed the control period. */
  deadlineMiss: boolean;
  /** The sim-side watchdog braked this step. */
  watchdog: boolean;
}

const percentile = (sorted: number[], p: number): number => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? Number.NaN;

/** Per-step JSON lines (optional) and the latency summary of a bridge run. */
export class StepLog {
  private readonly out: WriteStream | null;
  private readonly rtts: number[] = [];
  private ticks = 0;
  private misses = 0;
  /** Times the watchdog started braking. */
  trips = 0;
  private braking = false;

  constructor(path: string | null) {
    if (path) mkdirSync(dirname(path), { recursive: true });
    this.out = path ? createWriteStream(path) : null;
  }

  add(r: StepRecord, controlTick: boolean): void {
    if (r.rttMs !== null) this.rtts.push(r.rttMs);
    if (controlTick) this.ticks++;
    if (r.deadlineMiss) this.misses++;
    if (r.watchdog && !this.braking) this.trips++;
    this.braking = r.watchdog;
    this.out?.write(`${JSON.stringify(r)}\n`);
  }

  summary(): string {
    const s = [...this.rtts].sort((a, b) => a - b);
    const ms = (p: number) => percentile(s, p).toFixed(2);
    return `round trip p50 ${ms(0.5)} ms · p95 ${ms(0.95)} ms · p99 ${ms(0.99)} ms · deadline misses ${this.misses} / ${this.ticks} control ticks · watchdog trips ${this.trips}`;
  }

  close(): Promise<void> {
    return new Promise((resolve) => (this.out ? this.out.end(resolve) : resolve()));
  }
}
