import { clamp } from '../../core/vec2';
import type { Observation } from '../../ego/observation';
import { idmFree, idmInteraction } from '../../traffic/idm';
import type { DrivingAction, DrivingAgent } from '../types';
import { corridorObstacles } from './hazards';
import { steeringCommand } from './lateralController';
import { DEFAULT_RULE_BASED_OPTIONS, type RuleBasedOptions } from './options';
import { buildLocalPath } from './pathGeometry';
import { SignalDecision } from './signalDecision';
import { desiredSpeed } from './speedPlanner';

/**
 * Transparent baseline / expert: curvature feed-forward + Stanley steering and
 * IDM speed control that obeys signals and yields to anything predicted to be
 * in its corridor. It only uses the Observation (no privileged simulator
 * access), so it is a fair baseline and a usable imitation-learning teacher.
 */
export class RuleBasedAgent implements DrivingAgent {
  readonly name = 'rule-based';
  private readonly o: RuleBasedOptions;
  private readonly signal = new SignalDecision();

  constructor(options: Partial<RuleBasedOptions> = {}) {
    this.o = { ...DEFAULT_RULE_BASED_OPTIONS, ...options };
  }

  reset(): void {
    this.signal.reset();
  }

  act(obs: Observation): DrivingAction {
    const v = obs.ego.speed;
    const idm = this.o.idm;
    const path = buildLocalPath(obs.route.waypoints);
    const v0 = desiredSpeed(obs, path, this.o);
    let interaction = 0;
    const consider = (gap: number, speed: number) => {
      interaction = Math.min(interaction, idmInteraction(idm, v, gap, speed));
    };
    // IDM settles at gap ~= s0, so this stops the bumper ~1 m before the line.
    const stop = this.signal.stopDistance(obs.route.nextStop, v);
    if (stop !== null) consider(stop - 1.0 + idm.s0, 0);
    for (const ob of corridorObstacles(obs, path)) consider(ob.gap, ob.speed);
    return {
      acceleration: clamp(idmFree(idm, v, v0) + interaction, -8, idm.aMax),
      steering: steeringCommand(obs, path),
    };
  }
}
