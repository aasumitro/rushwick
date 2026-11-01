/** Binary min-heap keyed by a numeric priority (used by Dijkstra). */
export class MinHeap<T> {
  private readonly items: { key: number; value: T }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(key: number, value: T): void {
    const item = { key, value };
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.key <= key) break;
      a[i] = a[p]!;
      i = p;
    }
    a[i] = item;
  }

  pop(): { key: number; value: T } | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (!top || !last || a.length === 0) return top;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      let mk = last.key;
      if (l < a.length && a[l]!.key < mk) {
        m = l;
        mk = a[l]!.key;
      }
      if (r < a.length && a[r]!.key < mk) m = r;
      if (m === i) break;
      a[i] = a[m]!;
      i = m;
    }
    a[i] = last;
    return top;
  }
}
