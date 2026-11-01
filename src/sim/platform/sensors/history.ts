/**
 * Fixed-size ring buffer of per-step records, pushed with consecutive
 * `step` numbers. Reads before the kept window return its oldest record, so a
 * channel with latency sees the spawn state until enough history exists.
 */
export class History<T extends { step: number }> {
  private readonly items: T[] = [];
  private first = 0;
  private last = -1;

  constructor(private readonly capacity: number) {}

  push(item: T): void {
    if (this.last < 0) this.first = item.step;
    this.items[item.step % this.capacity] = item;
    this.last = item.step;
  }

  /** The record of `step`, clamped to the kept window. */
  at(step: number): T {
    if (this.last < 0) throw new Error('History.at() before the first push');
    const s = Math.min(this.last, Math.max(step, this.first, this.last - this.capacity + 1));
    return this.items[s % this.capacity] as T;
  }
}
