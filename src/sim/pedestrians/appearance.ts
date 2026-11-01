import type { Rng } from '../core/rng';
import { clamp } from '../core/vec2';

const SHIRTS = [0xd9534f, 0x337ab7, 0xf0ad4e, 0x5cb85c, 0xf7f7f7, 0x222222, 0x8e44ad, 0x16a085, 0xe67e22, 0x95a5a6, 0x2c3e50, 0xc0392b];
const PANTS = [0x2c3e50, 0x1b1b1b, 0x34495e, 0x7f8c8d, 0x5d4037, 0x1f3a60];

export interface PedTraits {
  desiredSpeed: number;
  height: number;
  shirt: number;
  pants: number;
}

/** Walking speed ~N(1.32, 0.2) m/s and stature ~N(1.66, 0.09) m. Draw order is fixed. */
export function drawTraits(rng: Rng): PedTraits {
  const desiredSpeed = clamp(rng.normal(1.32, 0.2), 0.85, 1.85);
  const height = clamp(rng.normal(1.66, 0.09), 1.45, 1.9);
  const shirt = rng.pick(SHIRTS);
  const pants = rng.pick(PANTS);
  return { desiredSpeed, height, shirt, pants };
}
