/** Guards floor(k · dt · hz) against products like 2.9999999999999996. */
const EPS = 1e-9;

/**
 * True when physics step k starts a new period of a `hz` clock: step 0 always
 * does, and every step does once hz ≥ 1/dt. Shared by control ticks and sensor
 * sampling so both quantize time the same way.
 */
export function isTick(k: number, dt: number, hz: number): boolean {
  if (k === 0 || hz * dt >= 1) return true;
  return Math.floor(k * dt * hz + EPS) > Math.floor((k - 1) * dt * hz + EPS);
}
