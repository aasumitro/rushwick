import type { ManualInput } from '../../sim';

const STEER_LEFT = ['ArrowLeft', 'KeyA'];
const STEER_RIGHT = ['ArrowRight', 'KeyD'];
const THROTTLE = ['ArrowUp', 'KeyW'];
const BRAKE = ['ArrowDown', 'KeyS'];

/** Tracks held keys and exposes them as normalised manual-driving input. */
export class KeyboardInput {
  private readonly held = new Set<string>();
  private readonly down = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    this.held.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  };
  private readonly up = (e: KeyboardEvent) => this.held.delete(e.code);

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.down);
    target.addEventListener('keyup', this.up);
  }

  read(): ManualInput {
    const any = (codes: string[]) => codes.some((c) => this.held.has(c));
    return {
      throttle: any(THROTTLE) ? 1 : 0,
      brake: any(BRAKE) ? 1 : 0,
      steer: (any(STEER_LEFT) ? 1 : 0) - (any(STEER_RIGHT) ? 1 : 0),
    };
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.down);
    this.target.removeEventListener('keyup', this.up);
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.isContentEditable);
}
