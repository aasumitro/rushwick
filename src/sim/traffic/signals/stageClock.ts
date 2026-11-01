import type { SignalPlan } from '../../world/types';
import type { StagePhase } from './types';

/** Where a fixed-time controller is in its cycle. */
export interface ClockState {
  stage: number;
  phase: StagePhase;
  elapsed: number;
  left: number;
  /** Position inside the cycle (s). */
  tau: number;
}

/** Start time of each stage's green within the cycle. */
export function stageStarts(plan: SignalPlan): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const st of plan.stages) {
    starts.push(acc);
    acc += st.green + plan.yellow + plan.allRed;
  }
  return starts;
}

/** Pure function of time: stage -> green, yellow, all-red, next stage ... */
export function readClock(plan: SignalPlan, t: number, out: ClockState): void {
  const tau = (((t + plan.offset) % plan.cycle) + plan.cycle) % plan.cycle;
  out.tau = tau;
  let acc = 0;
  for (let i = 0; i < plan.stages.length; i++) {
    const g = plan.stages[i]!.green;
    const span = g + plan.yellow + plan.allRed;
    if (tau < acc + span || i === plan.stages.length - 1) {
      const local = tau - acc;
      out.stage = i;
      if (local < g) set(out, 'green', local, g - local);
      else if (local < g + plan.yellow) set(out, 'yellow', local - g, g + plan.yellow - local);
      else set(out, 'allred', local - g - plan.yellow, Math.max(0, span - local));
      return;
    }
    acc += span;
  }
}

function set(out: ClockState, phase: StagePhase, elapsed: number, left: number): void {
  out.phase = phase;
  out.elapsed = elapsed;
  out.left = left;
}
