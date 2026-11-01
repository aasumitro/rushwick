import type { Rng } from '../core/rng';
import type { Vec2 } from '../core/vec2';
import type { SignalSystem } from '../traffic/signals';
import type { City, PedEdge } from '../world/types';

/** Static context shared by the pedestrian behaviour modules. */
export interface PedWorld {
  city: City;
  signals: SignalSystem;
  rng: Rng;
  jaywalkProbability: number;
}

export const nodePos = (w: PedWorld, id: number): Vec2 => w.city.pedNodes[id]!.pos;
export const edgeAt = (w: PedWorld, id: number): PedEdge => w.city.pedEdges[id]!;

/** Seconds a would-be jaywalker waits for a gap before walking on to the corner. */
export const JAYWALK_PATIENCE = 25;
/** Seconds a crossing pedestrian waits behind a blocking (background) car before squeezing past. */
export const BLOCKED_PATIENCE = 4;
