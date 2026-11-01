import { DEFAULT_EGO_PARAMS } from '../../ego/egoParams';
import type { PlatformProfile } from '../types';

/**
 * A full-size passenger car with a production-like sensor suite (360° lidar
 * and object detection, camera-based light detection), in real units. The
 * numbers are representative assumptions, not one specific vehicle.
 */
export const PASSENGER_CAR_PROFILE: PlatformProfile = {
  name: 'passenger-car',
  label: 'Passenger car',
  scale: 1,
  vehicle: DEFAULT_EGO_PARAMS,
  actuators: {
    controlHz: 20,
    computeDelay: 0.08,
    actuationDelay: 0.06,
    delayJitter: 0.015,
    accelTimeConstant: 0.35,
    accelDeadband: 0.05,
    steerDeadband: 0.005,
    steerBiasStd: 0.005,
  },
  sensors: {
    privileged: false,
    // yawBiasWalk and the lidar minRange are not in the plan's table: typical values, also assumptions.
    egoState: { rateHz: 30, latency: 0.02, speedStd: 0.05, speedQuantum: 0, accelStd: 0.1, yawRateStd: 0.005, yawBiasWalk: 0.0005, steer: 'measured' },
    localization: { rateHz: 30, latency: 0.05, posStd: 0.1, headingStd: 0.005, driftStd: 0.2, driftTau: 10 },
    lidar: { rateHz: 10, latency: 0.05, range: 50, rangeStd: 0.03, minRange: 0.1, dropout: 0.01 },
    objects: {
      rateHz: 10,
      latency: 0.1,
      fovDeg: 360,
      range: 60,
      posStd: 0.2,
      posStdPerMeter: 0.01,
      velStd: 0.3,
      missRate: 0.02,
      missRatePerMeter: 0.002,
      occlusion: true,
    },
    signals: { rateHz: 10, latency: 0.1, range: 80, missRate: 0.02, misclassify: 0.01 },
  },
};
