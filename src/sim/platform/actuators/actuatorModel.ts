import type { Rng } from '../../core/rng';
import { clamp } from '../../core/vec2';
import type { DrivingAction, EgoParams } from '../../ego/egoParams';
import { isTick } from '../clock';
import type { ActuatorModelConfig } from './types';

interface QueuedCommand {
  /** Episode step at which the command reaches the wheels. */
  due: number;
  action: DrivingAction;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);

/**
 * What happens between a decision model and the wheels (design decision D6),
 * in sim units: commands are accepted only on control ticks and held in
 * between, arrive after a jittered delay, pass deadbands and a per-episode
 * steering-center error, and the longitudinal response lags. The output still
 * goes through the unchanged EgoVehicle limits.
 */
export class ActuatorModel {
  /** Newest command accepted on a control tick (sanitized, before delay); the steering a servo-only car "measures". */
  lastCommanded: DrivingAction = { acceleration: 0, steering: 0 };
  /** Delay of the newest accepted command (physics steps). */
  lastDelaySteps = 0;
  /** Steering-center error for this episode (rad). */
  readonly steerBias: number;
  private readonly queue: QueuedCommand[] = [];
  private readonly lagGain: number;
  private target: DrivingAction = { acceleration: 0, steering: 0 };
  private accel = 0;
  private lastDue = 0;

  constructor(
    private readonly cfg: ActuatorModelConfig,
    private readonly vehicle: EgoParams,
    private readonly dt: number,
    private readonly rng: Rng,
  ) {
    this.steerBias = rng.normal(0, cfg.steerBiasStd);
    this.lagGain = cfg.accelTimeConstant > 0 ? 1 - Math.exp(-dt / cfg.accelTimeConstant) : 1;
  }

  /** True when episode step k accepts a new command (always when controlHz ≥ 1/dt). */
  controlDue(k: number): boolean {
    return isTick(k, this.dt, this.cfg.controlHz);
  }

  /** The action the ego receives at episode step k for the model's `action`. */
  apply(action: DrivingAction, k: number): DrivingAction {
    if (this.controlDue(k)) this.accept(action, k);
    while (this.queue.length > 0 && this.queue[0]!.due <= k) this.target = this.queue.shift()!.action;
    const c = this.cfg;
    const { acceleration, steering } = this.target;
    const accelCmd = Math.abs(acceleration) < c.accelDeadband ? 0 : acceleration;
    const steerCmd = Math.abs(steering) < c.steerDeadband ? 0 : steering;
    this.accel = this.lagGain === 1 ? accelCmd : this.accel + (accelCmd - this.accel) * this.lagGain;
    return { acceleration: this.accel, steering: steerCmd + this.steerBias / this.vehicle.maxSteer };
  }

  private accept(action: DrivingAction, k: number): void {
    const v = this.vehicle;
    const c = this.cfg;
    const cmd = {
      acceleration: clamp(finite(action.acceleration), -v.maxBrake, v.maxAccel),
      steering: clamp(finite(action.steering), -1, 1),
    };
    const delay = Math.max(0, c.computeDelay + c.actuationDelay + c.delayJitter * this.rng.normal());
    // Commands never overtake each other: a fast one waits for the slower one before it.
    this.lastDue = Math.max(this.lastDue, k + Math.round(delay / this.dt));
    this.lastDelaySteps = this.lastDue - k;
    this.queue.push({ due: this.lastDue, action: cmd });
    this.lastCommanded = cmd;
  }
}
