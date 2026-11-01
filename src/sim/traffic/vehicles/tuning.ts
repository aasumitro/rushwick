import type { TurnType } from '../../world/types';

/** Driver-model constants shared by the vehicle modules. */
export const TUNING = {
  maxDecel: 8,
  /** Above this required deceleration a driver runs a yellow instead of stopping. */
  yellowStopDecel: 3.2,
  /** Bumper-to-stop-line distance when stopped. */
  stopMargin: 0.4,
  laneChangeTime: 2.6,
  pedRadius: 0.3,
  /** Sampling step of the swept-corridor check (m). */
  corridorStep: 1.5,
  /** Seconds of pedestrian motion drivers anticipate. */
  pedPredict: 1.6,
  /** Vehicles longer than this avoid tight turns and need wide clearance. */
  longVehicle: 6,
  /** Time gap a permissive turner needs in priority traffic (s). */
  criticalGap: 5.5,
  /** Diverging connectors whose vehicles still overlap near the junction entry (m). */
  siblingOverlap: 16,
} as const;

export const TURN_WEIGHTS: Record<TurnType, number> = { straight: 0.56, near: 0.24, far: 0.2 };
