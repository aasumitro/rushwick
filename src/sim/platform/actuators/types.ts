/** How commands reach the wheels on the target platform. Real units in a profile, sim units once resolved. */
export interface ActuatorModelConfig {
  /** Commands are accepted at this rate and held in between (Hz). Capped at 1/dt. */
  controlHz: number;
  /** Perception + inference time on the target computer (s). Zeroed in real-time HIL, where it happens for real. */
  computeDelay: number;
  /** Command transport + PWM + servo/ESC reaction (s). */
  actuationDelay: number;
  /** Standard deviation of the total delay per command (s). */
  delayJitter: number;
  /** First-order lag of the longitudinal response (s); 0 disables it. */
  accelTimeConstant: number;
  /** Requested accelerations smaller than this become 0 (m/s²). */
  accelDeadband: number;
  /** Normalized steering commands smaller than this become 0 (fraction of maxSteer). */
  steerDeadband: number;
  /** Std of the steering-center error, sampled once per episode (rad). */
  steerBiasStd: number;
}
