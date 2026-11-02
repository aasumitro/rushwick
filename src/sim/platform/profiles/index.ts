import type { PlatformProfile } from '../types';
import { IDEAL_PROFILE } from './ideal';
import { PASSENGER_CAR_PROFILE } from './passengerCar';
import { RC_JETSON_PROFILE } from './rcJetson';
import { RC_PI_PROFILE } from './rcPi';

/** Built-in platforms by name. Their values are a contract: changing one changes recorded datasets. */
export const PLATFORM_PROFILES: Readonly<Record<string, PlatformProfile>> = {
  [IDEAL_PROFILE.name]: IDEAL_PROFILE,
  [RC_PI_PROFILE.name]: RC_PI_PROFILE,
  [RC_JETSON_PROFILE.name]: RC_JETSON_PROFILE,
  [PASSENGER_CAR_PROFILE.name]: PASSENGER_CAR_PROFILE,
};

/** A built-in profile by name (real units); throws on an unknown name and lists the valid ones. */
export function getProfile(name: string): PlatformProfile {
  const p = Object.hasOwn(PLATFORM_PROFILES, name) ? PLATFORM_PROFILES[name] : undefined;
  if (!p) throw new Error(`Unknown platform profile '${name}'. Valid profiles: ${Object.keys(PLATFORM_PROFILES).join(', ')}`);
  return p;
}

/** The ideal profile builds no sensor or actuator model, so it keeps the exact pre-profile code path. */
export const isIdeal = (p: PlatformProfile): boolean => p.name === IDEAL_PROFILE.name;
