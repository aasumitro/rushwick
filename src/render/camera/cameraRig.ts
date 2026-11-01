import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type CameraMode = 'orbit' | 'chase' | 'top' | 'driver';

export interface FollowTarget {
  x: number;
  y: number;
  heading: number;
}

/** Camera behaviours: free orbit, chase cam, bird's-eye and driver's seat. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  mode: CameraMode = 'chase';
  private readonly desired = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  constructor(dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 3000);
    this.camera.position.set(260, 220, 260);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 1400;
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  update(target: FollowTarget | null, dt: number): void {
    if (this.mode === 'orbit' || !target) {
      if (target) this.controls.target.lerp(new THREE.Vector3(target.x, 0, -target.y), Math.min(1, dt * 2));
      this.controls.update();
      return;
    }
    const fx = Math.cos(target.heading);
    const fy = Math.sin(target.heading);
    if (this.mode === 'chase') {
      this.desired.set(target.x - fx * 13, 6.5, -(target.y - fy * 13));
      this.look.set(target.x + fx * 10, 1.2, -(target.y + fy * 10));
    } else if (this.mode === 'driver') {
      this.desired.set(target.x + fx * 0.3, 1.25, -(target.y + fy * 0.3));
      this.look.set(target.x + fx * 20, 1.0, -(target.y + fy * 20));
    } else {
      this.desired.set(target.x, 95, -target.y + 0.01);
      this.look.set(target.x, 0, -target.y);
    }
    const k = this.mode === 'driver' ? 1 : Math.min(1, dt * 4);
    this.camera.position.lerp(this.desired, k);
    this.camera.lookAt(this.look);
    this.controls.target.copy(this.look);
  }
}
