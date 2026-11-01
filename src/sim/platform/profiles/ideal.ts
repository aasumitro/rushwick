import { DEFAULT_EGO_PARAMS } from '../../ego/egoParams';
import { DEFAULT_SENSOR_CONFIG } from '../../ego/observation';
import type { PlatformProfile } from '../types';

/** Rate and latency of a channel that measures every physics step (1/dt at the default dt). */
const EVERY_STEP = { rateHz: 30, latency: 0 };

/**
 * Exact sensing and instant actuation, the behavior from before platform
 * profiles existed. The simulation builds no sensor or actuator model for it,
 * so it stays bit-identical; the numbers below only describe it.
 */
export const IDEAL_PROFILE: PlatformProfile = {
  name: 'ideal',
  label: 'Ideal (exact sensing and actuation)',
  scale: 1,
  vehicle: DEFAULT_EGO_PARAMS,
  actuators: {
    controlHz: 30,
    computeDelay: 0,
    actuationDelay: 0,
    delayJitter: 0,
    accelTimeConstant: 0,
    accelDeadband: 0,
    steerDeadband: 0,
    steerBiasStd: 0,
  },
  sensors: {
    privileged: true,
    egoState: { ...EVERY_STEP, speedStd: 0, speedQuantum: 0, accelStd: 0, yawRateStd: 0, yawBiasWalk: 0, steer: 'measured' },
    localization: { ...EVERY_STEP, posStd: 0, headingStd: 0, driftStd: 0, driftTau: 1 },
    lidar: { ...EVERY_STEP, range: DEFAULT_SENSOR_CONFIG.lidarRange, rangeStd: 0, minRange: 0, dropout: 0 },
    objects: {
      ...EVERY_STEP,
      fovDeg: 360,
      range: DEFAULT_SENSOR_CONFIG.agentRadius,
      posStd: 0,
      posStdPerMeter: 0,
      velStd: 0,
      missRate: 0,
      missRatePerMeter: 0,
      occlusion: false,
    },
    signals: { ...EVERY_STEP, range: Infinity, missRate: 0, misclassify: 0 },
  },
};
