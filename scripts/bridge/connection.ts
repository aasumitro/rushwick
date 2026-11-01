import { parseCommand, ProtocolError, type CommandMessage, type RushwickMessage } from '../../src/bridge';

/** A validated command and its arrival time (performance.now(), ms). */
export interface Received {
  cmd: CommandMessage;
  at: number;
}

interface Waiter {
  seq: number;
  resolve: (cmd: CommandMessage) => void;
  reject: (e: Error) => void;
}

/**
 * The WebSocket to the car program (Node's built-in client). Every incoming
 * message is validated; commands are matched to frames by `seq`. Any protocol
 * error or a closed socket fails the connection for good.
 */
export class CarConnection {
  /** Newest command by arrival. */
  latest: Received | null = null;
  onCommand: ((r: Received) => void) | null = null;
  private waiter: Waiter | null = null;
  private failure: Error | null = null;

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (e) => this.receive(e.data));
    ws.addEventListener('close', () => this.fail(new Error('The car program closed the connection')));
  }

  static open(url: string, timeoutMs = 5000): Promise<CarConnection> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error(`No car program answered at ${url} within ${timeoutMs} ms`));
      }, timeoutMs);
      ws.addEventListener('open', () => (clearTimeout(timer), resolve(new CarConnection(ws))), { once: true });
      ws.addEventListener('error', () => (clearTimeout(timer), reject(new Error(`Cannot connect to a car program at ${url}`))), { once: true });
    });
  }

  send(msg: RushwickMessage): void {
    if (this.failure) throw this.failure;
    this.ws.send(JSON.stringify(msg));
  }

  /** Lockstep: resolves with the command for frame `seq`; commands for older frames are skipped. */
  waitFor(seq: number, timeoutMs: number): Promise<CommandMessage> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.latest?.cmd.seq === seq) return Promise.resolve(this.latest.cmd);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`No command for frame ${seq} within ${timeoutMs} ms`)), timeoutMs);
      const done = () => clearTimeout(timer);
      this.waiter = { seq, resolve: (c) => (done(), resolve(c)), reject: (e) => (done(), reject(e)) };
    });
  }

  close(): void {
    this.failure ??= new Error('Connection closed');
    this.ws.close();
  }

  private receive(data: unknown): void {
    let cmd: CommandMessage;
    try {
      cmd = parseCommand(typeof data === 'string' ? data : String(data));
    } catch (e) {
      return this.fail(e as Error);
    }
    this.latest = { cmd, at: performance.now() };
    this.onCommand?.(this.latest);
    const w = this.waiter;
    if (!w || cmd.seq < w.seq) return;
    this.waiter = null;
    if (cmd.seq === w.seq) w.resolve(cmd);
    else w.reject(new ProtocolError(`Command for frame ${cmd.seq} arrived while frame ${w.seq} was waiting`));
  }

  private fail(e: Error): void {
    if (this.failure) return;
    this.failure = e;
    this.waiter?.reject(e);
    this.waiter = null;
  }
}
