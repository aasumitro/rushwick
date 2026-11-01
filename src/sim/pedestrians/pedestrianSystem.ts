import type { Rng } from '../core/rng';
import type { SignalSystem } from '../traffic/signals';
import type { City } from '../world/types';
import { mayCross } from './crossingRules';
import { bodyAhead, move } from './locomotion';
import { followEdge } from './navigation';
import { BLOCKED_PATIENCE, edgeAt, JAYWALK_PATIENCE, type PedWorld } from './pedWorld';
import { spawnPedestrians } from './spawner';
import type { PedStepContext, Pedestrian } from './types';

/** Pedestrians wandering the sidewalk graph, using crosswalks (and sometimes jaywalking). */
export class PedestrianSystem {
  readonly peds: Pedestrian[] = [];
  private readonly world: PedWorld;

  constructor(city: City, signals: SignalSystem, rng: Rng, jaywalkProbability: number) {
    this.world = { city, signals, rng, jaywalkProbability };
  }

  spawnRandom(count: number): void {
    this.peds.push(...spawnPedestrians(this.world, count, this.peds.length + 1));
  }

  step(dt: number, ctx: PedStepContext): void {
    for (const p of this.peds) {
      p.prevX = p.x;
      p.prevY = p.y;
      p.prevHeading = p.heading;
      if (p.state === 'idle') this.idle(p, dt);
      else if (p.state === 'wait') this.wait(p, dt, ctx);
      else if (p.state === 'walk') move(this.world, p, dt);
      else this.cross(p, dt, ctx);
      if (p.speed > 0.05) p.walkPhase += dt * p.speed * 5.2;
      p.crosswalkId = p.crossing?.kind === 'crosswalk' ? p.crossing.crosswalkId : -1;
      p.waiting = p.state === 'wait';
    }
  }

  private idle(p: Pedestrian, dt: number): void {
    p.speed = 0;
    p.idleTime -= dt;
    if (p.idleTime <= 0) p.state = 'walk';
  }

  private wait(p: Pedestrian, dt: number, ctx: PedStepContext): void {
    p.speed = 0;
    p.waitTime += dt;
    if (p.crossing?.kind === 'jaywalk' && p.waitTime > JAYWALK_PATIENCE) {
      // Give up on jaywalking and keep walking to the corner.
      followEdge(this.world, p, edgeAt(this.world, p.edge).id, p.toNode, false);
      p.crossing = null;
      p.state = 'walk';
      return;
    }
    if (mayCross(this.world, p, ctx)) {
      p.state = 'cross';
      p.onRoad = true;
      p.target = p.crossing!.to;
    }
  }

  /** Never walk into a car; squeeze past background traffic after a while, never through the ego. */
  private cross(p: Pedestrian, dt: number, ctx: PedStepContext): void {
    const blocker = bodyAhead(p, ctx);
    if (blocker === 'ego' || (blocker === 'vehicle' && p.blockedTime < BLOCKED_PATIENCE)) {
      p.speed = 0;
      p.blockedTime += dt;
      return;
    }
    if (blocker === 'none') p.blockedTime = 0;
    move(this.world, p, dt);
  }
}
