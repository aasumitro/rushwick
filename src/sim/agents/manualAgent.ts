import { clamp } from '../core/vec2';
import type { Observation } from '../ego/observation';
import type { DrivingAction, DrivingAgent } from './types';

export interface ManualInput {
  /** All normalised: throttle/brake in [0, 1], steer in [-1, 1] (left positive). */
  throttle: number;
  brake: number;
  steer: number;
}

/** Human driving: the UI writes `input`, the agent turns it into a smooth action. */
export class ManualAgent implements DrivingAgent {
  readonly name = 'manual';
  input: ManualInput = { throttle: 0, brake: 0, steer: 0 };
  private steer = 0;

  reset(): void {
    this.steer = 0;
    this.input = { throttle: 0, brake: 0, steer: 0 };
  }

  act(obs: Observation): DrivingAction {
    // Speed-sensitive steering keeps keyboard driving controllable.
    const authority = 1 / (1 + obs.ego.speed / 9);
    this.steer += clamp(this.input.steer * authority - this.steer, -0.12, 0.12);
    const { throttle, brake } = this.input;
    const acceleration = brake > 0 ? -7 * brake : throttle > 0 ? 2.6 * throttle : -0.25;
    return { acceleration, steering: this.steer };
  }
}
