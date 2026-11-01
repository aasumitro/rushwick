import * as THREE from 'three';
import type { EgoVehicle } from '../../sim';
import { PALETTE } from '../core/palette';

const HEIGHT = 1.0;

/** Visualises the ego's 2D range scan as rays from the car centre. */
export class LidarOverlay {
  readonly lines: THREE.LineSegments;
  private readonly positions: Float32Array;

  constructor(private readonly rays: number) {
    this.positions = new Float32Array(rays * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.lines = new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ color: PALETTE.lidar, transparent: true, opacity: 0.55 }),
    );
    this.lines.frustumCulled = false;
  }

  update(ego: EgoVehicle | null, ranges: readonly number[] | null, visible: boolean): void {
    this.lines.visible = visible && ego !== null && ranges !== null;
    if (!this.lines.visible || !ego || !ranges) return;
    for (let i = 0; i < this.rays; i++) {
      const a = ego.heading + (2 * Math.PI * i) / this.rays;
      const r = ranges[i] ?? 0;
      this.positions.set([ego.x, HEIGHT, -ego.y, ego.x + Math.cos(a) * r, HEIGHT, -(ego.y + Math.sin(a) * r)], i * 6);
    }
    (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
