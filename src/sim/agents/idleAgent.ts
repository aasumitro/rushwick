import type { DrivingAction, DrivingAgent } from './types';

/** Does nothing: a null baseline and a test helper. */
export class IdleAgent implements DrivingAgent {
  readonly name = 'idle';

  act(): DrivingAction {
    return { acceleration: 0, steering: 0 };
  }
}
