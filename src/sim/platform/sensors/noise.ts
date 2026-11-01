import type { Rng } from '../../core/rng';

/**
 * One step of an Ornstein–Uhlenbeck process with stationary std `std` and time
 * constant `tau` (s): a slowly wandering error such as localization drift.
 */
export function ouStep(prev: number, dt: number, tau: number, std: number, rng: Rng): number {
  const phi = Math.exp(-dt / tau);
  return prev * phi + std * Math.sqrt(1 - phi * phi) * rng.normal();
}

/** Round to the nearest multiple of `q`; `q = 0` disables quantization. */
export const quantize = (v: number, q: number): number => (q > 0 ? Math.round(v / q) * q : v);
