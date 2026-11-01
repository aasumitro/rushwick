import { IdleAgent, ManualAgent, RuleBasedAgent, type DrivingAgent } from '../../sim';
import type { AgentKind } from '../settings';

/** The decision models selectable in the UI. Add learned policies here. */
export function createAgent(kind: AgentKind): DrivingAgent {
  switch (kind) {
    case 'manual':
      return new ManualAgent();
    case 'idle':
      return new IdleAgent();
    default:
      return new RuleBasedAgent();
  }
}

export const AGENT_LABELS: Record<AgentKind, string> = {
  autopilot: 'Autopilot (rule-based)',
  manual: 'Manual (keyboard)',
  idle: 'Idle (null baseline)',
};
