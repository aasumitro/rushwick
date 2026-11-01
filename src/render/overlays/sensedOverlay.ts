import * as THREE from 'three';
import type { AgentObservation, Observation } from '../../sim';
import { PALETTE } from '../core/palette';

const HEIGHT = 0.12;
/** Outline drawn for a sensed pedestrian (m). */
const PED_SIZE = 0.6;
/** Four edges of two vertices each. */
const VERTS_PER_BOX = 8;

/**
 * What the ego's sensors report: an outline per sensed vehicle and pedestrian,
 * placed from the ego frame onto the current ego pose. Next to the true agents
 * it shows misses, occlusion, noise and latency. Reads the observation only.
 */
export class SensedOverlay {
  readonly lines: THREE.LineSegments;
  private readonly positions: Float32Array;

  constructor(private readonly capacity: number) {
    this.positions = new Float32Array(capacity * VERTS_PER_BOX * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: PALETTE.sensed }));
    this.lines.frustumCulled = false;
  }

  update(ego: { x: number; y: number; heading: number } | null, obs: Observation | null, visible: boolean): void {
    this.lines.visible = visible && ego !== null && obs !== null;
    if (!this.lines.visible || !ego || !obs) return;
    let n = 0;
    const box = (a: AgentObservation, length: number, width: number) => {
      if (n >= this.capacity) return;
      const c = Math.cos(ego.heading);
      const s = Math.sin(ego.heading);
      const x = ego.x + a.x * c - a.y * s;
      const y = ego.y + a.x * s + a.y * c;
      const h = ego.heading + a.heading;
      const fx = (Math.cos(h) * length) / 2;
      const fy = (Math.sin(h) * length) / 2;
      const lx = (-Math.sin(h) * width) / 2;
      const ly = (Math.cos(h) * width) / 2;
      const corners = [
        [x + fx + lx, y + fy + ly],
        [x + fx - lx, y + fy - ly],
        [x - fx - lx, y - fy - ly],
        [x - fx + lx, y - fy + ly],
      ] as const;
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = corners[i]!;
        const [bx, by] = corners[(i + 1) % 4]!;
        this.positions.set([ax, HEIGHT, -ay, bx, HEIGHT, -by], (n * VERTS_PER_BOX + i * 2) * 3);
      }
      n++;
    };
    for (const v of obs.vehicles) box(v, v.length, v.width);
    for (const p of obs.pedestrians) box(p, PED_SIZE, PED_SIZE);
    this.lines.geometry.setDrawRange(0, n * VERTS_PER_BOX);
    (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
