import type { PlatformProfile } from '../types';

/**
 * A 1:10 RC car (0.45 m long) with a Raspberry Pi 5, in real units. Every
 * number is an assumption until Phase C replaces it with a bench measurement
 * (note the date and method next to each measured value):
 * - lidar: RPLidar C1 class (about 10 Hz, 12 m, ±30 mm);
 * - camera: Camera Module 3 Wide (about 102° horizontal);
 * - compute: CPU-only inference at 10–15 FPS for detections;
 * - steering: hobby servo at about 0.1 s / 60°, no angle feedback;
 * - localization: overhead camera or AprilTags (decision Q3).
 */
export const RC_PI_PROFILE: PlatformProfile = {
  name: 'rc-pi',
  label: 'RC car on Raspberry Pi (1:10)',
  scale: 10,
  vehicle: { length: 0.45, width: 0.2, height: 0.15, wheelBase: 0.26, maxSteer: 0.45, maxSteerRate: 6.0, maxAccel: 2, maxBrake: 3, maxSpeed: 3 },
  actuators: {
    controlHz: 20,
    computeDelay: 0.06,
    actuationDelay: 0.02,
    delayJitter: 0.015,
    accelTimeConstant: 0.15,
    accelDeadband: 0.1,
    steerDeadband: 0.02,
    steerBiasStd: 0.03,
  },
  sensors: {
    privileged: false,
    // yawBiasWalk is not in the plan's table: a typical MEMS gyro value, also an assumption.
    egoState: { rateHz: 30, latency: 0.02, speedStd: 0.03, speedQuantum: 0.01, accelStd: 0.2, yawRateStd: 0.02, yawBiasWalk: 0.001, steer: 'commanded' },
    localization: { rateHz: 30, latency: 0.05, posStd: 0.02, headingStd: 0.02, driftStd: 0.03, driftTau: 5 },
    lidar: { rateHz: 10, latency: 0.05, range: 12, rangeStd: 0.02, minRange: 0.05, dropout: 0.02 },
    objects: {
      rateHz: 10,
      latency: 0.1,
      fovDeg: 100,
      range: 3,
      posStd: 0.03,
      posStdPerMeter: 0.03,
      velStd: 0.05,
      missRate: 0.05,
      missRatePerMeter: 0.03,
      occlusion: true,
    },
    signals: { rateHz: 10, latency: 0.1, range: 5, missRate: 0.05, misclassify: 0.02 },
  },
  world: {
    // PLACEHOLDER track (decision Q4: the room is not measured yet). Sim units: a 2×2 grid
    // at 30 m spacing is a 4.7 m square of floor at 1:10. Its four corners are plain turns
    // (two one-way loops, no signals); buildings become cardboard boxes, which also occlude.
    city: { gridX: 2, gridY: 2, minSpacing: 30, maxSpacing: 30, arterialLanes: 1, localLanes: 1, outerDepth: 5, parkProbability: 0, downtownHeight: 0 },
    vehicleCount: 0,
    pedestrianCount: 0,
    // The 14 m lanes and the 47 m square cannot fit the full city's 50 m lanes and 320 m routes.
    spawnLaneMinLength: 12,
    minRouteDistance: 20,
    maxEpisodeTime: 300,
  },
};
