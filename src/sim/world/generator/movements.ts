import { DIR_VEC, DIRS, opposite, type Arm, type Dir, type Intersection, type TurnType } from '../types';
import type { GenContext } from './context';
import { makeConnector } from './connectorGeometry';

function classifyTurn(ctx: GenContext, inDir: Dir, outDir: Dir): TurnType | null {
  if (outDir === inDir) return 'straight';
  if (outDir === opposite(inDir)) return null; // no U-turns
  const a = DIR_VEC[inDir]!;
  const b = DIR_VEC[outDir]!;
  const isLeft = a.x * b.y - a.y * b.x > 0;
  return isLeft === (ctx.config.drivingSide === 'left') ? 'near' : 'far';
}

/** Allowed movements per lane: curb lane straight+near, inner lane straight+far. */
function lanePreference(lanes: number, i: number): TurnType[] {
  if (lanes === 1) return ['straight', 'near', 'far'];
  if (i === 0) return ['straight', 'near'];
  if (i === lanes - 1) return ['straight', 'far'];
  return ['straight'];
}

/** Target lane: near turns and straights keep the index; far turns align from the inner side. */
function targetIndex(turn: TurnType, i: number, nIn: number, nOut: number): number {
  if (turn === 'far') return Math.max(0, nOut - 1 - (nIn - 1 - i));
  return Math.min(i, nOut - 1);
}

function connectApproach(ctx: GenContext, node: Intersection, approach: Dir, arm: Arm): void {
  const inDir = opposite(approach);
  const exits: { arm: Arm; turn: TurnType }[] = [];
  for (const exitDir of DIRS) {
    const ex = node.arms[exitDir];
    if (!ex || exitDir === approach) continue;
    const turn = classifyTurn(ctx, inDir, exitDir);
    if (turn) exits.push({ arm: ex, turn });
  }
  const nIn = arm.incoming.length;
  arm.incoming.forEach((laneId, i) => {
    const pref = lanePreference(nIn, i);
    let moves = exits.filter((e) => pref.includes(e.turn));
    if (moves.length === 0) moves = exits;
    for (const mv of moves) {
      const to = mv.arm.outgoing[targetIndex(mv.turn, i, nIn, mv.arm.outgoing.length)] as number;
      makeConnector(ctx, node, { from: laneId, to, approach, exit: mv.arm.dir, turn: mv.turn });
    }
  });
}

export function buildConnectors(ctx: GenContext): void {
  for (const node of ctx.nodes) {
    for (const approach of DIRS) {
      const arm = node.arms[approach];
      if (arm) connectApproach(ctx, node, approach, arm);
    }
  }
}
