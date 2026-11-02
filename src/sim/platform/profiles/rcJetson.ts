import type { PlatformProfile } from '../types';
import { RC_PI_PROFILE } from './rcPi';

/**
 * The `rc-pi` car with an NVIDIA Jetson Orin Nano 8 GB in place of the Pi 5,
 * in real units. Vehicle, track, actuation chain and the non-camera sensors
 * are rc-pi's, so they change together when rc-pi is calibrated. GPU
 * inference (TensorRT) changes the compute delay and the camera channels.
 * ESTIMATES (2026-11-02, no board yet), from autonomy/docs/hardware/jetson.md
 * section 7; replace them with hardware-in-the-loop measurements and note the
 * date and method next to each:
 * - compute: TensorRT detection at 20–30 FPS, about 20–30 ms per command;
 * - objects and signals: the low end, 20 Hz, about 50 ms from exposure to detection.
 */
export const RC_JETSON_PROFILE: PlatformProfile = {
  ...RC_PI_PROFILE,
  name: 'rc-jetson',
  label: 'RC car on Jetson Orin Nano (1:10)',
  actuators: { ...RC_PI_PROFILE.actuators, computeDelay: 0.025, delayJitter: 0.008 },
  sensors: {
    ...RC_PI_PROFILE.sensors,
    objects: { ...RC_PI_PROFILE.sensors.objects, rateHz: 20, latency: 0.05 },
    signals: { ...RC_PI_PROFILE.sensors.signals, rateHz: 20, latency: 0.05 },
  },
};
