import type { GeometryBuilder } from '../core/geometryBuilder';

/**
 * A vehicle model split by material: `body` takes the per-instance paint
 * colour, `detail` keeps its own vertex colours (glass, tyres, trim) and
 * `lights` are the brake lamps whose brightness changes per frame.
 * Local frame: +x forward, +y up, +z lateral; origin at the ground centre.
 */
export interface VehicleModel {
  body: GeometryBuilder;
  detail: GeometryBuilder;
  lights: GeometryBuilder;
  /** Nominal length; instances are stretched along x to their real length. */
  length: number;
}

export const GLASS = 0x1f2a35;
export const TYRE = 0x111111;
export const HEADLIGHT = 0xfff3c4;
export const TRIM = 0x2a2a2a;
