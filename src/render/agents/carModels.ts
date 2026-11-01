import { GeometryBuilder } from '../core/geometryBuilder';
import { GLASS, HEADLIGHT, TYRE, type VehicleModel } from './modelTypes';

/** Passenger-car family: sedan, SUV and taxi share one parametric shape. */
export function passengerCar(L: number, W: number, H: number, opts: { taxiSign?: boolean } = {}): VehicleModel {
  const body = new GeometryBuilder();
  const detail = new GeometryBuilder();
  const lights = new GeometryBuilder();
  const sill = 0.3;
  const lowerH = H * 0.42;
  const cabinH = H - sill - lowerH;
  body.box(0, sill + lowerH / 2, 0, L, lowerH, W);
  // Glass cabin with a painted roof panel on top.
  detail.box(-L * 0.06, sill + lowerH + cabinH / 2, 0, L * 0.5, cabinH, W * 0.86, GLASS);
  body.box(-L * 0.06, H - 0.03, 0, L * 0.48, 0.06, W * 0.84);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) detail.box(sx * L * 0.31, 0.32, sz * (W / 2 - 0.16), 0.64, 0.64, 0.26, TYRE);
    detail.box(L / 2 - 0.02, sill + lowerH * 0.7, sx * (W / 2 - 0.28), 0.06, 0.14, 0.34, HEADLIGHT);
    lights.box(-L / 2 + 0.02, sill + lowerH * 0.7, sx * (W / 2 - 0.26), 0.06, 0.16, 0.36, 0xffffff);
  }
  if (opts.taxiSign) detail.box(-L * 0.06, H + 0.12, 0, 0.5, 0.2, 0.25, 0xf7f7f7);
  return { body, detail, lights, length: L };
}

export const sedan = (): VehicleModel => passengerCar(4.4, 1.75, 1.45);
export const suv = (): VehicleModel => passengerCar(4.8, 1.9, 1.75);
export const taxi = (): VehicleModel => passengerCar(4.5, 1.75, 1.5, { taxiSign: true });
