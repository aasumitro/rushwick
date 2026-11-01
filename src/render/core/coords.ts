import * as THREE from 'three';

/**
 * The simulation uses a 2D frame (x = east, y = north, heading CCW from +x).
 * Three.js is Y-up, so sim (x, y) maps to (x, height, -y) and a sim heading
 * maps directly to a rotation about +Y.
 */
export const toThree = (x: number, y: number, height = 0): THREE.Vector3 => new THREE.Vector3(x, height, -y);

const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

/** Write a pose (sim coordinates) into `out`. */
export function poseMatrix(out: THREE.Matrix4, x: number, y: number, heading: number, height = 0, scale = 1): THREE.Matrix4 {
  tmpPos.set(x, height, -y);
  tmpQuat.setFromAxisAngle(UP, heading);
  tmpScale.set(scale, scale, scale);
  return out.compose(tmpPos, tmpQuat, tmpScale);
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

/** Pose of an agent interpolated between the previous and current physics step. */
export interface Interpolatable {
  x: number;
  y: number;
  heading: number;
  prevX: number;
  prevY: number;
  prevHeading: number;
}

export function interpolate(a: Interpolatable, alpha: number): { x: number; y: number; heading: number } {
  return {
    x: a.prevX + (a.x - a.prevX) * alpha,
    y: a.prevY + (a.y - a.prevY) * alpha,
    heading: lerpAngle(a.prevHeading, a.heading, alpha),
  };
}
