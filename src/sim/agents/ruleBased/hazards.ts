import type { AgentObservation, Observation } from '../../ego/observation';
import { projectOnPath, type LocalPath } from './pathGeometry';

/** An obstacle on our path: bumper gap (m) and its speed along the path (m/s). */
export interface PathObstacle {
  gap: number;
  speed: number;
}

/** Seconds of constant-velocity prediction checked for road users entering our corridor. */
const PREDICTION_TIMES = [0, 1, 2];

/**
 * Road users in, or predicted to enter, the swept corridor along the route.
 * Users only predicted to enter are treated as stationary at the entry point.
 */
export function corridorObstacles(obs: Observation, path: LocalPath): PathObstacle[] {
  const { ego } = obs;
  const out: PathObstacle[] = [];
  const check = (a: AgentObservation, otherHalfW: number, otherHalfL: number, margin: number) => {
    const ax = a.vx + ego.speed; // agent velocity in ego-frame axes
    const ay = a.vy;
    for (const t of PREDICTION_TIMES) {
      const pr = projectOnPath(path, a.x + ax * t, a.y + ay * t);
      if (pr.s <= 0 || pr.s > path.length) continue;
      if (Math.abs(pr.lateral) > ego.width / 2 + otherHalfW + margin) continue;
      const along = t === 0 ? Math.max(0, ax * Math.cos(pr.heading) + ay * Math.sin(pr.heading)) : 0;
      out.push({ gap: pr.s - ego.length / 2 - otherHalfL, speed: along });
      return;
    }
  };
  for (const a of obs.vehicles) check(a, a.width / 2, a.length / 2, 0.45);
  for (const p of obs.pedestrians) check(p, 0.3, 0.3, 0.7);
  return out;
}
