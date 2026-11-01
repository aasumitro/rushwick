import { buildFrame, buildHello, commandToAction, episodeStart, parseCommand, type CommandMessage, type RushwickMessage } from '../../bridge';
import type { DrivingAction, DrivingAgent, Simulation } from '../../sim';

/** Without a fresh command for this long (ms) the car brakes fully, like the watchdog on the car. */
const WATCHDOG_MS = 250;
/** Frames remembered for round-trip times when commands stop coming. */
const MAX_PENDING = 300;
const IDLE: DrivingAction = { acceleration: 0, steering: 0 };

/** Connection status for the HUD. */
export interface RemoteStatus {
  state: 'connecting' | 'connected' | 'closed';
  /** Frame sent → its command received (ms), for the newest command. */
  rttMs: number | null;
  /** The watchdog is braking because commands stopped. */
  braking: boolean;
  error: string | null;
}

/**
 * A decision model that runs in a car program on the other end of a WebSocket
 * (bridge protocol v1) with realtime semantics: every act() sends a frame, and
 * the newest command received so far drives the car. Without a fresh command
 * for 250 ms it brakes fully. Lets you watch a car program, or a Pi, drive in 3D.
 */
export class RemoteAgent implements DrivingAgent {
  readonly name = 'remote';
  readonly status: RemoteStatus = { state: 'connecting', rttMs: null, braking: false, error: null };
  private readonly ws: WebSocket;
  private readonly sentAt = new Map<number, number>();
  private latest: { cmd: CommandMessage; at: number } | null = null;
  private since = performance.now();

  constructor(
    url: string,
    private readonly sim: Simulation,
  ) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener('open', () => {
      this.status.state = 'connected';
      this.since = performance.now();
      this.send(buildHello(sim, 'realtime'));
    });
    this.ws.addEventListener('message', (e) => this.receive(e.data));
    this.ws.addEventListener('close', () => (this.status.state = 'closed'));
    this.ws.addEventListener('error', () => (this.status.error ??= `No car program at ${url}`));
  }

  reset(): void {
    this.latest = null;
    this.since = performance.now();
    this.send(episodeStart(this.sim.episodes - 1));
  }

  act(): DrivingAction {
    const now = performance.now();
    const frame = buildFrame(this.sim);
    this.sentAt.set(frame.seq, now);
    if (this.sentAt.size > MAX_PENDING) this.sentAt.delete(this.sentAt.keys().next().value!);
    this.send(frame);
    const latest = this.latest;
    if (latest && now - latest.at <= WATCHDOG_MS) {
      this.status.braking = false;
      return commandToAction(latest.cmd, this.sim.platform.scale);
    }
    this.status.braking = now - Math.max(this.since, latest?.at ?? this.since) > WATCHDOG_MS;
    return this.status.braking ? { acceleration: -this.sim.config.ego.params.maxBrake, steering: 0 } : IDLE;
  }

  close(): void {
    this.ws.close();
  }

  private send(msg: RushwickMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private receive(data: unknown): void {
    try {
      const cmd = parseCommand(String(data));
      const at = performance.now();
      const sent = this.sentAt.get(cmd.seq);
      if (sent !== undefined) this.status.rttMs = at - sent;
      for (const seq of this.sentAt.keys()) if (seq <= cmd.seq) this.sentAt.delete(seq);
      this.latest = { cmd, at };
    } catch (e) {
      // A protocol error ends the session: the watchdog brakes from here on.
      this.status.error = (e as Error).message;
      this.ws.close();
    }
  }
}
