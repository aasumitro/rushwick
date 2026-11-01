/** FNV-1a 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Incremental FNV-style hasher over integers (state fingerprints). */
export class Fnv {
  private h = 0x811c9dc5;

  mix(n: number): this {
    this.h ^= n | 0;
    this.h = Math.imul(this.h, 0x01000193);
    return this;
  }

  get value(): number {
    return this.h >>> 0;
  }
}
