import type { DrivingAction } from '../ego/egoParams';
import type { Observation } from '../ego/observation';

/**
 * A decision model. Implementations receive an Observation every control
 * step and return a DrivingAction. This is the plug-in point for learned
 * policies (imitation learning, RL, world-model planners, ...).
 */
export interface DrivingAgent {
  readonly name: string;
  reset?(): void;
  act(obs: Observation): DrivingAction;
}

export type { DrivingAction };
