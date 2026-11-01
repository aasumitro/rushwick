import { isVertical, type ConnectorSegment, type Crosswalk, type Intersection, type SignalPlan, type SignalStage } from '../types';
import { isArterialLine, type GenContext } from './context';

type StageRule = { filter: (c: ConnectorSegment) => boolean; green: number };

function stageRules(ctx: GenContext, node: Intersection, protectedTurns: boolean): StageRule[] {
  const { config } = ctx;
  const vGreen = isArterialLine(config, node.gx, config.gridX) ? config.arterialGreen : config.localGreen;
  const hGreen = isArterialLine(config, node.gy, config.gridY) ? config.arterialGreen : config.localGreen;
  const v = (c: ConnectorSegment) => isVertical(c.approachArm);
  if (!protectedTurns) return [{ filter: v, green: vGreen }, { filter: (c) => !v(c), green: hGreen }];
  return [
    { filter: (c) => v(c) && c.turn !== 'far', green: vGreen },
    { filter: (c) => v(c) && c.turn === 'far', green: config.farTurnGreen },
    { filter: (c) => !v(c) && c.turn !== 'far', green: hGreen },
    { filter: (c) => !v(c) && c.turn === 'far', green: config.farTurnGreen },
  ];
}

/** Within a shared stage, far turns yield to conflicting straight/near movements. */
function assignPriorities(ctx: GenContext, stages: SignalStage[]): void {
  stages.forEach((st, idx) => {
    const inStage = new Set(st.connectors);
    for (const id of st.connectors) {
      const c = ctx.segments[id] as ConnectorSegment;
      c.stage = idx;
      if (c.turn !== 'far') continue;
      c.yieldTo = c.conflicts.filter((k) => inStage.has(k) && (ctx.segments[k] as ConnectorSegment).turn !== 'far');
    }
  });
}

/** Pedestrians may walk during a stage only if every movement crossing them must yield. */
function assignWalkStages(ctx: GenContext, node: Intersection, stages: SignalStage[], protectedTurns: boolean): void {
  for (const cwId of node.crosswalks) {
    const cw = ctx.crosswalks[cwId] as Crosswalk;
    stages.forEach((st, idx) => {
      const crossing = st.connectors.map((id) => ctx.segments[id] as ConnectorSegment).filter((c) => c.crosswalks.includes(cwId));
      if (crossing.every((c) => c.turn === 'near' || (c.turn === 'far' && !protectedTurns))) cw.walkStages.push(idx);
    });
  }
}

/** Fixed-time plans for every junction with 3+ arms; random offsets (no green-wave coordination). */
export function buildSignalPlans(ctx: GenContext): SignalPlan[] {
  const { config } = ctx;
  const rng = ctx.rng.fork('signals');
  const plans: SignalPlan[] = [];
  for (const node of ctx.nodes) {
    if (node.arms.filter(Boolean).length < 3) continue;
    const conns = node.connectors.map((id) => ctx.segments[id] as ConnectorSegment);
    const protectedTurns =
      config.signalMode === 'protected' || (isArterialLine(config, node.gx, config.gridX) && isArterialLine(config, node.gy, config.gridY));
    const stages: SignalStage[] = [];
    for (const rule of stageRules(ctx, node, protectedTurns)) {
      const ids = conns.filter(rule.filter).map((c) => c.id);
      if (ids.length > 0) stages.push({ connectors: ids, green: rule.green });
    }
    assignPriorities(ctx, stages);
    const cycle = stages.reduce((acc, s) => acc + s.green + config.yellowTime + config.allRedTime, 0);
    plans.push({ nodeId: node.id, stages, yellow: config.yellowTime, allRed: config.allRedTime, cycle, offset: rng.range(0, cycle) });
    node.signalized = true;
    assignWalkStages(ctx, node, stages, protectedTurns);
  }
  return plans;
}
