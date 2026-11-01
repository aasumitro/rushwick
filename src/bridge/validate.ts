import type { CommandMessage } from './messages';

/** A message that breaks protocol v1. */
export class ProtocolError extends Error {
  override name = 'ProtocolError';
}

const clip = (s: string): string => (s.length > 80 ? `${s.slice(0, 80)}…` : s);
/** A value as JSON (strings quoted), clipped for error messages. */
const show = (v: unknown): string => clip(JSON.stringify(v) ?? String(v));

/** Validate a message from the car program (raw WebSocket text or parsed JSON); throws ProtocolError with the reason. */
export function parseCommand(data: unknown): CommandMessage {
  let msg = data;
  if (typeof data === 'string') {
    try {
      msg = JSON.parse(data);
    } catch {
      throw new ProtocolError(`Malformed JSON from the car program: ${clip(data)}`);
    }
  }
  if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) throw new ProtocolError(`Expected a JSON object, got ${show(msg)}`);
  const m = msg as Record<string, unknown>;
  if (m.type !== 'command') throw new ProtocolError(`Expected a message of type 'command', got type ${show(m.type)}`);
  const { seq, acceleration, steering } = m;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) throw new ProtocolError(`Command 'seq' must be a non-negative integer, got ${show(seq)}`);
  if (typeof acceleration !== 'number' || !Number.isFinite(acceleration)) throw new ProtocolError(`Command 'acceleration' must be a finite number, got ${show(acceleration)}`);
  if (typeof steering !== 'number' || !Number.isFinite(steering)) throw new ProtocolError(`Command 'steering' must be a finite number, got ${show(steering)}`);
  return { type: 'command', seq, acceleration, steering };
}
