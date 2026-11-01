import type { IdmParams } from '../../traffic/idm';

export interface RuleBasedOptions {
  /** Lateral acceleration budget in curves (m/s^2). */
  latAccel: number;
  /** Fraction of the posted speed limit to target. */
  speedFactor: number;
  idm: IdmParams;
}

export const DEFAULT_RULE_BASED_OPTIONS: RuleBasedOptions = {
  latAccel: 2.2,
  speedFactor: 0.95,
  idm: { aMax: 2.0, bComf: 2.6, T: 1.4, s0: 2.5 },
};
