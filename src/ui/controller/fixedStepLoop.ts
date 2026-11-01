/**
 * Converts variable frame time into a whole number of fixed physics steps
 * plus an interpolation factor for rendering between the last two states.
 */
export class FixedStepLoop {
  private accumulator = 0;

  constructor(
    private readonly dt: number,
    private readonly maxStepsPerFrame = 12,
  ) {}

  advance(realDt: number, speed: number): { steps: number; alpha: number } {
    this.accumulator += Math.min(realDt, 0.1) * speed;
    let steps = Math.floor(this.accumulator / this.dt);
    if (steps > this.maxStepsPerFrame) {
      // Too slow to keep up: drop the backlog instead of spiralling.
      steps = this.maxStepsPerFrame;
      this.accumulator = 0;
    } else this.accumulator -= steps * this.dt;
    return { steps, alpha: this.accumulator / this.dt };
  }

  reset(): void {
    this.accumulator = 0;
  }
}
