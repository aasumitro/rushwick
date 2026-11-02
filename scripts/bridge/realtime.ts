import { buildFrame, commandToAction } from '../../src/bridge';
import type { DrivingAction, EpisodeMetrics, Simulation } from '../../src/sim';
import type { CarConnection } from './connection';
import { anotherEpisode, endEpisode, startEpisode, type RunOptions } from './lockstep';
import type { StepLog } from './stepLog';

/** Without a fresh command for this long, the sim brakes fully, mirroring the watchdog on the car. */
const WATCHDOG_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

/**
 * Realtime clock: one physics step per `dt` of wall-clock time. Each frame is
 * sent at the start of its period, and at the end of the period the newest
 * command received so far drives the next step. Not deterministic by nature;
 * every step logs its round trip and whether the command made the deadline.
 */
export async function runRealtime(sim: Simulation, conn: CarConnection, log: StepLog, o: RunOptions): Promise<EpisodeMetrics[]> {
  const scale = sim.platform.scale;
  const periodMs = sim.config.dt * 1000;
  const brake: DrivingAction = { acceleration: -sim.config.ego.params.maxBrake, steering: 0 };
  const arrivals = new Map<number, number>();
  conn.onCommand = (r) => arrivals.set(r.cmd.seq, r.at);
  const results: EpisodeMetrics[] = [];
  const runStart = performance.now();
  for (let ep = 0; anotherEpisode(o, ep, runStart); ep++) {
    const teacher = startEpisode(sim, conn, ep, o.teacher);
    const started = performance.now();
    const firstSeq = sim.steps;
    let next = started;
    while (!sim.episodeDone) {
      const frame = buildFrame(sim, teacher?.act(sim.observeIdeal()));
      const sent = performance.now();
      conn.send(frame);
      next += periodMs;
      if (next < performance.now()) next = performance.now(); // fell behind: drop the backlog instead of bursting
      await sleep(next - performance.now());
      const arrived = arrivals.get(frame.seq);
      arrivals.clear();
      const latest = conn.latest;
      const fresh = latest !== null && latest.cmd.seq >= firstSeq && performance.now() - latest.at <= WATCHDOG_MS;
      const quiet = performance.now() - Math.max(started, latest?.at ?? started) > WATCHDOG_MS;
      const action = fresh ? commandToAction(latest.cmd, scale) : quiet ? brake : { acceleration: 0, steering: 0 };
      const command = fresh ? { acceleration: latest.cmd.acceleration, steering: latest.cmd.steering } : null;
      const rttMs = arrived === undefined ? null : arrived - sent;
      log.add({ seq: frame.seq, stamp: frame.stamp, controlTick: frame.controlTick, rttMs, command, deadlineMiss: frame.controlTick && rttMs === null, watchdog: quiet });
      sim.step(action);
    }
    results.push(endEpisode(sim, conn, ep));
  }
  return results;
}
