import type { Obb } from '../core/obb';
import { clamp } from '../core/vec2';
import { DEFAULT_EGO_PARAMS, type DrivingAction, type EgoParams } from './egoParams';

/** Kinematic bicycle model referenced at the vehicle centre, with actuator limits. */
export class EgoVehicle {
  x: number;
  y: number;
  heading: number;
  speed = 0;
  accel = 0;
  steer = 0;
  yawRate = 0;
  prevX: number;
  prevY: number;
  prevHeading: number;
  odometer = 0;

  constructor(
    x: number,
    y: number,
    heading: number,
    readonly params: EgoParams = DEFAULT_EGO_PARAMS,
  ) {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.heading = this.prevHeading = heading;
  }

  step(action: DrivingAction, dt: number): void {
    const p = this.params;
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevHeading = this.heading;
    const target = clamp(Number.isFinite(action.steering) ? action.steering : 0, -1, 1) * p.maxSteer;
    this.steer += clamp(target - this.steer, -p.maxSteerRate * dt, p.maxSteerRate * dt);
    const a = clamp(Number.isFinite(action.acceleration) ? action.acceleration : 0, -p.maxBrake, p.maxAccel);
    const v0 = this.speed;
    this.speed = clamp(this.speed + a * dt, 0, p.maxSpeed);
    this.accel = (this.speed - v0) / dt;
    const vMid = (v0 + this.speed) / 2;
    const lr = p.wheelBase / 2;
    const beta = Math.atan(0.5 * Math.tan(this.steer));
    this.yawRate = (vMid / lr) * Math.sin(beta);
    this.x += vMid * Math.cos(this.heading + beta) * dt;
    this.y += vMid * Math.sin(this.heading + beta) * dt;
    this.heading += this.yawRate * dt;
    this.odometer += vMid * dt;
  }

  obb(): Obb {
    return { x: this.x, y: this.y, heading: this.heading, halfLength: this.params.length / 2, halfWidth: this.params.width / 2 };
  }
}
