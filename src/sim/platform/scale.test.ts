import { describe, expect, it } from 'vitest';
import { getProfile } from './profiles';
import { resolveProfile } from './scale';
import type { PlatformProfile } from './types';

const ideal = getProfile('ideal');

/** A 1:10 copy of the ideal profile with a non-zero value in every scaled field. */
const tenth: PlatformProfile = {
  ...ideal,
  scale: 10,
  actuators: { ...ideal.actuators, accelDeadband: 0.1, computeDelay: 0.06, steerDeadband: 0.02, steerBiasStd: 0.03 },
  sensors: {
    ...ideal.sensors,
    egoState: { ...ideal.sensors.egoState, speedStd: 0.03, speedQuantum: 0.01, accelStd: 0.2, yawRateStd: 0.02 },
    localization: { ...ideal.sensors.localization, posStd: 0.02, headingStd: 0.02, driftStd: 0.03, driftTau: 5 },
    lidar: { ...ideal.sensors.lidar, range: 12, rangeStd: 0.02, minRange: 0.05, latency: 0.05 },
    objects: { ...ideal.sensors.objects, range: 3, posStd: 0.03, posStdPerMeter: 0.03, velStd: 0.05, missRate: 0.05, missRatePerMeter: 0.03, fovDeg: 100 },
    signals: { ...ideal.sensors.signals, range: 5 },
  },
};

describe('resolveProfile', () => {
  it('leaves a scale-1 profile unchanged', () => {
    expect(resolveProfile(ideal)).toEqual(ideal);
  });

  it('multiplies lengths, speeds and accelerations by scale', () => {
    const r = resolveProfile({ ...tenth, vehicle: { ...ideal.vehicle, length: 0.45, width: 0.2, height: 0.15, wheelBase: 0.26, maxSpeed: 3, maxAccel: 2, maxBrake: 3 } });
    expect(r.vehicle.length).toBeCloseTo(4.5);
    expect(r.vehicle.width).toBeCloseTo(2);
    expect(r.vehicle.height).toBeCloseTo(1.5);
    expect(r.vehicle.wheelBase).toBeCloseTo(2.6);
    expect(r.vehicle.maxSpeed).toBeCloseTo(30);
    expect([r.vehicle.maxAccel, r.vehicle.maxBrake]).toEqual([20, 30]);
    expect(r.actuators.accelDeadband).toBeCloseTo(1);
    expect(r.sensors.egoState.speedStd).toBeCloseTo(0.3);
    expect(r.sensors.egoState.speedQuantum).toBeCloseTo(0.1);
    expect(r.sensors.egoState.accelStd).toBeCloseTo(2);
    expect(r.sensors.localization.posStd).toBeCloseTo(0.2);
    expect(r.sensors.localization.driftStd).toBeCloseTo(0.3);
    expect(r.sensors.lidar.range).toBeCloseTo(120);
    expect(r.sensors.lidar.rangeStd).toBeCloseTo(0.2);
    expect(r.sensors.lidar.minRange).toBeCloseTo(0.5);
    expect(r.sensors.objects.range).toBeCloseTo(30);
    expect(r.sensors.objects.posStd).toBeCloseTo(0.3);
    expect(r.sensors.objects.velStd).toBeCloseTo(0.5);
    expect(r.sensors.signals.range).toBeCloseTo(50);
  });

  it('resolves rc-pi to its full-size twin', () => {
    const rc = getProfile('rc-pi');
    const r = resolveProfile(rc);
    expect(r.vehicle.wheelBase).toBeCloseTo(2.6);
    expect(r.vehicle.maxSpeed).toBeCloseTo(30);
    expect(r.sensors.lidar.range).toBeCloseTo(120);
    expect(r.sensors.objects.missRatePerMeter).toBeCloseTo(0.003);
    expect(r.vehicle.maxSteer).toBe(rc.vehicle.maxSteer);
    expect(r.actuators.computeDelay).toBe(rc.actuators.computeDelay);
    expect(r.sensors.objects.latency).toBe(rc.sensors.objects.latency);
    expect(r.world).toBe(rc.world);
  });

  it('builds rc-jetson from rc-pi: only the compute delay, jitter and camera timing differ', () => {
    const pi = resolveProfile(getProfile('rc-pi'));
    const jetson = resolveProfile(getProfile('rc-jetson'));
    expect(jetson.scale).toBe(pi.scale);
    expect(jetson.vehicle).toEqual(pi.vehicle);
    expect(jetson.world).toBe(pi.world);
    expect(jetson.actuators).toEqual({ ...pi.actuators, computeDelay: 0.025, delayJitter: 0.008 });
    expect(jetson.sensors).toEqual({
      ...pi.sensors,
      objects: { ...pi.sensors.objects, rateHz: 20, latency: 0.05 },
      signals: { ...pi.sensors.signals, rateHz: 20, latency: 0.05 },
    });
  });

  it('divides per-meter rates by scale and keeps angles, times, rates and ratios', () => {
    const r = resolveProfile(tenth);
    expect(r.sensors.objects.missRatePerMeter).toBeCloseTo(0.003);
    expect(r.vehicle.maxSteer).toBe(ideal.vehicle.maxSteer);
    expect(r.vehicle.maxSteerRate).toBe(ideal.vehicle.maxSteerRate);
    expect(r.actuators).toMatchObject({ computeDelay: 0.06, steerDeadband: 0.02, steerBiasStd: 0.03, controlHz: 30 });
    expect(r.sensors.egoState.yawRateStd).toBe(0.02);
    expect(r.sensors.localization).toMatchObject({ headingStd: 0.02, driftTau: 5 });
    expect(r.sensors.lidar.latency).toBe(0.05);
    expect(r.sensors.objects).toMatchObject({ posStdPerMeter: 0.03, missRate: 0.05, fovDeg: 100 });
  });
});
