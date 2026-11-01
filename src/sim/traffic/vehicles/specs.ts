export type VehicleKind = 'car' | 'suv' | 'taxi' | 'motorbike' | 'bus' | 'truck';

export interface VehicleSpec {
  /** Relative share of the fleet. */
  weight: number;
  length: [number, number];
  width: number;
  height: number;
  aMax: [number, number];
  speedFactor: [number, number];
  s0: [number, number];
  colors: readonly number[];
}

const PAINT = [0xf2f2f2, 0xc0c4c8, 0x1d1f22, 0x6b6f75, 0xa31d1d, 0x1f3f8a, 0x2f5a3a, 0xd8cfb8, 0x7a1430];

/** A Jakarta-like mix. Motorbikes follow lanes (no lane filtering) in this version. */
export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  car: { weight: 0.42, length: [4.0, 4.7], width: 1.75, height: 1.45, aMax: [1.4, 2.2], speedFactor: [0.85, 1.12], s0: [1.6, 2.4], colors: PAINT },
  suv: {
    weight: 0.12,
    length: [4.6, 5.0],
    width: 1.9,
    height: 1.75,
    aMax: [1.3, 2.0],
    speedFactor: [0.85, 1.1],
    s0: [1.8, 2.5],
    colors: [0xf2f2f2, 0x1d1f22, 0x8a8f96, 0x3d2b1f],
  },
  taxi: { weight: 0.08, length: [4.4, 4.6], width: 1.75, height: 1.5, aMax: [1.6, 2.2], speedFactor: [0.95, 1.15], s0: [1.5, 2.0], colors: [0x5fb4e6, 0xf0c419] },
  motorbike: {
    weight: 0.24,
    length: [1.9, 2.1],
    width: 0.8,
    height: 1.5,
    aMax: [2.0, 3.0],
    speedFactor: [0.9, 1.2],
    s0: [1.0, 1.5],
    colors: [0x1d1f22, 0xa31d1d, 0x1f3f8a, 0xf2f2f2, 0x2f7a3a],
  },
  bus: { weight: 0.05, length: [10.5, 12.0], width: 2.5, height: 3.2, aMax: [0.8, 1.2], speedFactor: [0.8, 0.95], s0: [2.5, 3.0], colors: [0x1e5bb8, 0xc0392b, 0xe67e22] },
  truck: {
    weight: 0.09,
    length: [6.5, 8.5],
    width: 2.3,
    height: 2.9,
    aMax: [0.8, 1.3],
    speedFactor: [0.8, 0.95],
    s0: [2.5, 3.0],
    colors: [0xf2f2f2, 0xe8c547, 0x2e6b3f, 0x8b8f94],
  },
};

export const VEHICLE_KINDS = Object.keys(VEHICLE_SPECS) as VehicleKind[];
