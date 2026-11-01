import type { PlatformProfile, ResolvedProfile } from './types';

/**
 * Convert a profile from real units to sim units (design decision D1).
 * Lengths, speeds, accelerations and distance noise are multiplied by
 * `scale`; angles, angular rates, times, rates, probabilities and ratios stay
 * unchanged; per-meter rates are divided by `scale`. The kinematic bicycle
 * model is exactly similar under this transform, so a 1:10 car behaves like
 * its full-size twin with the same steering angles and timings.
 */
export function resolveProfile(p: PlatformProfile): ResolvedProfile {
  const k = p.scale;
  const { vehicle: v, actuators: a, sensors: s } = p;
  return {
    ...p,
    vehicle: {
      ...v,
      length: v.length * k,
      width: v.width * k,
      height: v.height * k,
      wheelBase: v.wheelBase * k,
      maxSpeed: v.maxSpeed * k,
      maxAccel: v.maxAccel * k,
      maxBrake: v.maxBrake * k,
    },
    actuators: { ...a, accelDeadband: a.accelDeadband * k },
    sensors: {
      ...s,
      egoState: { ...s.egoState, speedStd: s.egoState.speedStd * k, speedQuantum: s.egoState.speedQuantum * k, accelStd: s.egoState.accelStd * k },
      localization: { ...s.localization, posStd: s.localization.posStd * k, driftStd: s.localization.driftStd * k },
      lidar: { ...s.lidar, range: s.lidar.range * k, rangeStd: s.lidar.rangeStd * k, minRange: s.lidar.minRange * k },
      objects: {
        ...s.objects,
        range: s.objects.range * k,
        posStd: s.objects.posStd * k,
        velStd: s.objects.velStd * k,
        missRatePerMeter: s.objects.missRatePerMeter / k,
      },
      signals: { ...s.signals, range: s.signals.range * k },
    },
  };
}
