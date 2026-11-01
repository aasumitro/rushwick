import { IdleAgent, ManualAgent, RuleBasedAgent, type DrivingAgent, type Simulation } from '../../sim';
import type { AgentKind } from '../settings';
import { RemoteAgent } from './remoteAgent';

/** The decision models selectable in the UI. Add learned policies here. */
export function createAgent(kind: AgentKind, sim: Simulation, remoteUrl: string): DrivingAgent {
  switch (kind) {
    case 'manual':
      return new ManualAgent();
    case 'idle':
      return new IdleAgent();
    case 'remote':
      return new RemoteAgent(remoteUrl, sim);
    default:
      return new RuleBasedAgent();
  }
}

export const AGENT_LABELS: Record<AgentKind, string> = {
  autopilot: 'Autopilot (rule-based)',
  manual: 'Manual (keyboard)',
  idle: 'Idle (null baseline)',
  remote: 'Remote (WebSocket)',
};
