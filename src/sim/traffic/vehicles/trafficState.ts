import type { Rng } from '../../core/rng';
import type { City, Crosswalk, Segment } from '../../world/types';
import type { SignalSystem } from '../signals';
import type { PedObstacle, Vehicle } from './types';

/**
 * Shared mutable state of background traffic: the fleet plus per-segment
 * indexes (who is on each segment, who has reserved each connector) that are
 * rebuilt once per step and patched incrementally within it.
 */
export class TrafficState {
  readonly vehicles: Vehicle[] = [];
  /** Vehicles on each segment, sorted by s ascending. */
  readonly occ: Vehicle[][];
  /** Vehicles holding (claim) or clearing (clearing) each connector. */
  readonly claimants: Vehicle[][];
  /** Per crosswalk: someone crossing, or waiting with a WALK signal. */
  readonly crosswalkBusy: Uint8Array;
  nextId = 1;
  private readonly touched: number[] = [];

  constructor(
    readonly city: City,
    readonly signals: SignalSystem,
    readonly rng: Rng,
  ) {
    this.occ = city.segments.map(() => []);
    this.claimants = city.segments.map(() => []);
    this.crosswalkBusy = new Uint8Array(city.crosswalks.length);
  }

  seg(id: number): Segment {
    return this.city.segments[id] as Segment;
  }

  private touch(id: number): void {
    if (this.occ[id]!.length === 0 && this.claimants[id]!.length === 0) this.touched.push(id);
  }

  rebuildIndexes(): void {
    for (const id of this.touched) {
      this.occ[id]!.length = 0;
      this.claimants[id]!.length = 0;
    }
    this.touched.length = 0;
    for (const v of this.vehicles) {
      const id = v.route[0] as number;
      this.touch(id);
      this.occ[id]!.push(v);
      for (const c of [v.claim, v.clearing]) {
        if (c < 0) continue;
        this.touch(c);
        this.claimants[c]!.push(v);
      }
    }
    for (const id of this.touched) {
      const o = this.occ[id]!;
      if (o.length > 1) o.sort((a, b) => a.s - b.s);
    }
  }

  insertOcc(segId: number, v: Vehicle): void {
    this.touch(segId);
    const list = this.occ[segId]!;
    let i = 0;
    while (i < list.length && list[i]!.s < v.s) i++;
    list.splice(i, 0, v);
  }

  removeOcc(segId: number, v: Vehicle): void {
    const list = this.occ[segId]!;
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
  }

  addClaim(v: Vehicle, connId: number): void {
    v.claim = connId;
    this.touch(connId);
    this.claimants[connId]!.push(v);
  }

  releaseClaim(v: Vehicle): void {
    if (v.claim < 0) return;
    const list = this.claimants[v.claim]!;
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
    v.claim = -1;
  }

  updateCrosswalkBusy(peds: readonly PedObstacle[]): void {
    this.crosswalkBusy.fill(0);
    for (const p of peds) {
      if (p.crosswalkId < 0) continue;
      const walkSignal = () => this.signals.crosswalkState(this.city.crosswalks[p.crosswalkId] as Crosswalk) === 'walk';
      if (p.onRoad || (p.waiting && walkSignal())) this.crosswalkBusy[p.crosswalkId] = 1;
    }
  }
}
