/** Timing of one sensor channel. */
export interface ChannelTiming {
  /** New measurements per second (Hz, capped at 1/dt). */
  rateHz: number;
  /** Age of a measurement when the agent first sees it (s). */
  latency: number;
}

export interface EgoStateChannelConfig extends ChannelTiming {
  /** Speed noise std (m/s). */
  speedStd: number;
  /** Speed resolution (m/s); 0 disables quantization. */
  speedQuantum: number;
  /** Longitudinal acceleration noise std (m/s²). */
  accelStd: number;
  /** Gyro noise std (rad/s). */
  yawRateStd: number;
  /** Gyro bias random walk (rad/s per √s). */
  yawBiasWalk: number;
  /** RC servos have no angle feedback: 'commanded' reports the commanded angle. */
  steer: 'measured' | 'commanded';
}

export interface LocalizationChannelConfig extends ChannelTiming {
  /** White position noise std (m). */
  posStd: number;
  /** White heading noise std (rad). */
  headingStd: number;
  /** Slowly varying pose error (Ornstein–Uhlenbeck): stationary std (m). */
  driftStd: number;
  /** Time constant of the pose drift (s). */
  driftTau: number;
}

export interface LidarChannelConfig extends ChannelTiming {
  /** Maximum range (m); missed and dropped rays read this value. */
  range: number;
  /** Range noise std (m). */
  rangeStd: number;
  /** Closest measurable range (m). */
  minRange: number;
  /** Probability that a ray returns nothing. */
  dropout: number;
}

export interface ObjectsChannelConfig extends ChannelTiming {
  /** Horizontal field of view centered on the heading (degrees). */
  fovDeg: number;
  /** Detection range (m). */
  range: number;
  /** Position noise std at distance 0 (m). */
  posStd: number;
  /** Extra position noise std per meter of distance (m/m, a ratio). */
  posStdPerMeter: number;
  /** Velocity noise std (m/s). */
  velStd: number;
  /** Miss probability at distance 0. */
  missRate: number;
  /** Extra miss probability per meter of distance (1/m). */
  missRatePerMeter: number;
  /** Hide agents with no clear sight line (buildings, nearer vehicles). */
  occlusion: boolean;
}

export interface SignalsChannelConfig extends ChannelTiming {
  /** Distance to the stop line beyond which the light reads 'unknown' (m). */
  range: number;
  /** Probability that a visible light reads 'unknown'. */
  missRate: number;
  /** Probability that a detected light reads a wrong state. */
  misclassify: number;
}

/** What the ego perceives and how badly. */
export interface SensorModelConfig {
  /** True only for `ideal`: keeps timeLeft and disables occlusion. */
  privileged: boolean;
  egoState: EgoStateChannelConfig;
  localization: LocalizationChannelConfig;
  lidar: LidarChannelConfig;
  objects: ObjectsChannelConfig;
  signals: SignalsChannelConfig;
}
