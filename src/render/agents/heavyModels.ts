import { GeometryBuilder } from '../core/geometryBuilder';
import { GLASS, HEADLIGHT, TRIM, TYRE, type VehicleModel } from './modelTypes';

export function bus(): VehicleModel {
  const L = 11.2;
  const W = 2.5;
  const H = 3.2;
  const body = new GeometryBuilder().box(0, 0.35 + (H - 0.35) / 2, 0, L, H - 0.35, W);
  const detail = new GeometryBuilder();
  const lights = new GeometryBuilder();
  // Continuous window band on both sides and the windscreen.
  for (const sz of [1, -1]) detail.box(-0.3, H * 0.66, sz * (W / 2 + 0.01), L * 0.86, H * 0.32, 0.02, GLASS);
  detail.box(L / 2 + 0.01, H * 0.6, 0, 0.02, H * 0.45, W * 0.9, GLASS);
  for (const sx of [0.33, -0.3]) for (const sz of [1, -1]) detail.box(sx * L, 0.45, sz * (W / 2 - 0.25), 0.9, 0.9, 0.35, TYRE);
  for (const sz of [1, -1]) {
    detail.box(L / 2 + 0.02, 0.8, sz * (W / 2 - 0.35), 0.05, 0.2, 0.4, HEADLIGHT);
    lights.box(-L / 2 - 0.02, 0.9, sz * (W / 2 - 0.3), 0.05, 0.3, 0.3, 0xffffff);
  }
  return { body, detail, lights, length: L };
}

export function truck(): VehicleModel {
  const L = 7.5;
  const W = 2.3;
  const body = new GeometryBuilder().box(L / 2 - 1.0, 1.45, 0, 2.0, 2.2, W);
  const detail = new GeometryBuilder();
  const lights = new GeometryBuilder();
  detail.box(-1.0, 1.75, 0, L - 2.2, 2.6, W, 0xdedede); // cargo box
  detail.box(L / 2 + 0.01, 1.85, 0, 0.02, 0.8, W * 0.85, GLASS);
  detail.box(-0.3, 0.35, 0, L - 0.6, 0.3, W * 0.7, TRIM); // chassis
  for (const sx of [0.36, -0.22, -0.36]) for (const sz of [1, -1]) detail.box(sx * L, 0.45, sz * (W / 2 - 0.2), 0.9, 0.9, 0.35, TYRE);
  for (const sz of [1, -1]) lights.box(-L / 2 + 0.05, 0.7, sz * (W / 2 - 0.25), 0.05, 0.2, 0.3, 0xffffff);
  return { body, detail, lights, length: L };
}

export function motorbike(): VehicleModel {
  const L = 2.0;
  const body = new GeometryBuilder().box(0.05, 0.62, 0, 1.2, 0.35, 0.36); // tank + seat
  const detail = new GeometryBuilder();
  const lights = new GeometryBuilder();
  for (const sx of [0.72, -0.72]) detail.box(sx, 0.32, 0, 0.62, 0.62, 0.12, TYRE);
  detail.box(-0.15, 1.15, 0, 0.32, 0.65, 0.4, 0x2f3b4c); // rider torso
  detail.box(-0.05, 1.6, 0, 0.3, 0.3, 0.28, 0xe9e9e9); // helmet
  detail.box(-0.15, 0.75, 0, 0.45, 0.35, 0.42, 0x23262b); // legs
  lights.box(-0.95, 0.75, 0, 0.05, 0.1, 0.16, 0xffffff);
  return { body, detail, lights, length: L };
}
