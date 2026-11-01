import type { City, ConnectorSegment, Crosswalk, SignalPlan } from '../../world/types';
import { readClock, stageStarts, type ClockState } from './stageClock';
import type { LightState, StagePhase, WalkState } from './types';

/** Minimum pedestrian WALK time even when the clearance interval is long. */
const MIN_WALK = 5;

interface NodeSignal extends ClockState {
  plan: SignalPlan;
  starts: number[];
}

/** All fixed-time controllers of a city; state is a pure function of simulation time. */
export class SignalSystem {
  private readonly byNode: (NodeSignal | null)[];

  constructor(city: City) {
    this.byNode = city.nodes.map(() => null);
    for (const plan of city.signals) {
      this.byNode[plan.nodeId] = { plan, starts: stageStarts(plan), stage: 0, phase: 'green', elapsed: 0, left: 0, tau: 0 };
    }
    this.update(0);
  }

  update(t: number): void {
    for (const st of this.byNode) if (st) readClock(st.plan, t, st);
  }

  isSignalized(nodeId: number): boolean {
    return this.byNode[nodeId] != null;
  }

  connectorState(conn: ConnectorSegment): LightState {
    const st = this.byNode[conn.nodeId];
    if (!st || conn.stage < 0) return 'green';
    if (conn.stage !== st.stage) return 'red';
    return st.phase === 'green' ? 'green' : st.phase === 'yellow' ? 'yellow' : 'red';
  }

  /** The connector's own stage is ending (yellow or all-red): permissive turners may clear the junction. */
  inClearance(conn: ConnectorSegment): boolean {
    const st = this.byNode[conn.nodeId];
    return !!st && conn.stage === st.stage && st.phase !== 'green';
  }

  /** Seconds until the connector's light changes (Infinity when unsignalised). */
  connectorTimeLeft(conn: ConnectorSegment): number {
    const st = this.byNode[conn.nodeId];
    if (!st || conn.stage < 0) return Infinity;
    if (conn.stage === st.stage && st.phase !== 'allred') return st.left;
    const cycle = st.plan.cycle;
    return (((st.starts[conn.stage]! - st.tau) % cycle) + cycle) % cycle;
  }

  /** Pedestrian signal, or null when the junction is unsignalised. */
  crosswalkState(cw: Crosswalk): WalkState | null {
    const st = this.byNode[cw.nodeId];
    if (!st) return null;
    const stage = st.plan.stages[st.stage];
    if (!stage || !cw.walkStages.includes(st.stage)) return 'dont';
    if (st.phase === 'green') {
      const walkTime = Math.max(MIN_WALK, stage.green + st.plan.yellow + st.plan.allRed - cw.clearanceTime);
      return st.elapsed < walkTime ? 'walk' : 'flash';
    }
    return st.phase === 'yellow' ? 'flash' : 'dont';
  }

  nodeStage(nodeId: number): { stage: number; phase: StagePhase } | null {
    const st = this.byNode[nodeId];
    return st ? { stage: st.stage, phase: st.phase } : null;
  }
}
