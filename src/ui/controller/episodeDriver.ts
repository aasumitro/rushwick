import { ManualAgent, type DrivingAgent, type ManualInput, type Observation, type Simulation } from '../../sim';
import type { AgentKind } from '../settings';
import { createAgent } from './agentFactory';
import { RemoteAgent } from './remoteAgent';

const RESTART_DELAY = 2.5;

/** Runs the closed loop observe -> act -> step for one simulation and restarts finished episodes. */
export class EpisodeDriver {
  lastObs: Observation | null = null;
  private agent: DrivingAgent;
  private doneFor = 0;

  constructor(
    readonly sim: Simulation,
    kind: AgentKind,
    remoteUrl: string,
  ) {
    this.agent = createAgent(kind, sim, remoteUrl);
    this.newEpisode();
  }

  /** The remote decision model, when one drives (for its connection status). */
  get remote(): RemoteAgent | null {
    return this.agent instanceof RemoteAgent ? this.agent : null;
  }

  setAgent(kind: AgentKind, remoteUrl: string): void {
    this.dispose();
    this.agent = createAgent(kind, this.sim, remoteUrl);
    this.agent.reset?.();
  }

  /** Close the remote connection, if any. */
  dispose(): void {
    this.remote?.close();
  }

  newEpisode(): void {
    this.sim.spawnEgo();
    this.agent.reset?.();
    this.doneFor = 0;
    this.lastObs = this.sim.ego ? this.sim.observe() : null;
  }

  advance(steps: number, manual: ManualInput): void {
    const sim = this.sim;
    if (this.agent instanceof ManualAgent) this.agent.input = manual;
    for (let i = 0; i < steps; i++) {
      const active = sim.ego !== null && !sim.episodeDone;
      if (active) this.lastObs = sim.observe();
      sim.step(active && this.lastObs ? this.agent.act(this.lastObs) : null);
    }
  }

  /** After an episode ends, wait a moment (so the outcome is visible) and start the next one. */
  maybeRestart(realDt: number, enabled: boolean): void {
    if (!this.sim.episodeDone || !enabled) return;
    this.doneFor += realDt;
    if (this.doneFor > RESTART_DELAY) this.newEpisode();
  }
}
