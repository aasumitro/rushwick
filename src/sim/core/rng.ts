import { hashString } from './hash';

/**
 * Deterministic, seedable PRNG (sfc32). Every stochastic decision in the
 * simulation must go through an Rng instance so that a (config, seed) pair
 * always reproduces the exact same episode — a hard requirement for
 * benchmarking decision models and for generating reproducible datasets.
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | string) {
    const h = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.a = 0x9e3779b9 ^ h;
    this.b = 0x243f6a88 ^ Math.imul(h, 0x85ebca6b);
    this.c = 0xb7e15162 ^ Math.imul(h, 0xc2b2ae35);
    this.d = h ^ 0x27d4eb2f;
    // Warm up so that nearby seeds diverge quickly.
    for (let i = 0; i < 16; i++) this.next();
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty array');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Pick an index according to non-negative weights. */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    if (total <= 0) return Math.floor(this.next() * weights.length);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i] as number;
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** Standard normal sample (Box–Muller). */
  normal(mean = 0, std = 1): number {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Derive an independent stream; adding consumers of one stream never perturbs another. */
  fork(label: string): Rng {
    return new Rng(hashString(`${label}:${this.a}:${this.b}:${this.c}:${this.d}`));
  }
}
