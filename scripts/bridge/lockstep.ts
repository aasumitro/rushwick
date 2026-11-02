import { buildFrame, commandToAction, episodeEnd, episodeStart } from '../../src/bridge';
import { RuleBasedAgent, type EpisodeMetrics, type Simulation } from '../../src/sim';
import type { CarConnection } from './connection';
import type { StepLog } from './stepLog';

export interface RunOptions {
  episodes: number;
  /** When set, episodes keep starting until this many minutes of wall time have passed. */
  minutes: number | null;
  /** Send the privileged rule-based teacher's action with every frame. */
  teacher: boolean;
  /** Lockstep: abort when a command takes longer (ms). */
  timeoutMs: number;
}

/** Whether to start episode `ep` (0-based) of a run that started at `startedMs` (performance.now()). */
export const anotherEpisode = (o: RunOptions, ep: number, startedMs: number): boolean =>
  o.minutes === null ? ep < o.episodes : performance.now() - startedMs < o.minutes * 60_000;

/** Spawn the next episode and announce it; a fresh teacher per episode, as runEpisode resets agents. */
export function startEpisode(sim: Simulation, conn: CarConnection, index: number, teacher: boolean): RuleBasedAgent | null {
  if (!sim.spawnEgo()) throw new Error('Could not place the ego vehicle');
  conn.send(episodeStart(index));
  return teacher ? new RuleBasedAgent() : null;
}

export function endEpisode(sim: Simulation, conn: CarConnection, index: number): EpisodeMetrics {
  const m = sim.episodeMetrics()!;
  conn.send(episodeEnd(index, m, sim.platform.scale));
  return m;
}

/**
 * Lockstep clock: send frame k, wait for the command with seq k, apply it and
 * step. Deterministic whenever the car program is (and uses `stamp` as its
 * clock), and faster than real time.
 */
export async function runLockstep(sim: Simulation, conn: CarConnection, log: StepLog, o: RunOptions): Promise<EpisodeMetrics[]> {
  const scale = sim.platform.scale;
  const periodMs = 1000 / Math.min(sim.platform.actuators.controlHz, 1 / sim.config.dt);
  const results: EpisodeMetrics[] = [];
  const runStart = performance.now();
  for (let ep = 0; anotherEpisode(o, ep, runStart); ep++) {
    const teacher = startEpisode(sim, conn, ep, o.teacher);
    while (!sim.episodeDone) {
      const frame = buildFrame(sim, teacher?.act(sim.observeIdeal()));
      const sent = performance.now();
      conn.send(frame);
      const cmd = await conn.waitFor(frame.seq, o.timeoutMs);
      const rttMs = performance.now() - sent;
      const command = { acceleration: cmd.acceleration, steering: cmd.steering };
      log.add({ seq: frame.seq, stamp: frame.stamp, controlTick: frame.controlTick, rttMs, command, deadlineMiss: frame.controlTick && rttMs > periodMs, watchdog: false });
      sim.step(commandToAction(cmd, scale));
    }
    results.push(endEpisode(sim, conn, ep));
  }
  return results;
}
