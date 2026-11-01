import * as THREE from 'three';
import type { City, LightState, SignalSystem } from '../../sim';
import { poseMatrix } from '../core/coords';
import { PALETTE } from '../core/palette';
import { layoutSignalHeads, type SignalHead } from './signalLayout';

const HEAD_H = 5.4;
const LAMPS_PER_HEAD = 4; // red, yellow, green, far-turn arrow

/** Traffic-light poles, mast arms and lamps; lamp colours follow the live signal state. */
export class SignalLayer {
  readonly group = new THREE.Group();
  private readonly heads: SignalHead[];
  private readonly lamps: THREE.InstancedMesh;
  private readonly color = new THREE.Color();

  constructor(city: City) {
    this.heads = layoutSignalHeads(city);
    const n = Math.max(1, this.heads.length);
    const dark = new THREE.MeshStandardMaterial({ color: PALETTE.signalPole, roughness: 0.6 });
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, HEAD_H + 0.6, 8).translate(0, (HEAD_H + 0.6) / 2, 0), dark, n);
    const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.12, 0.12), dark, n);
    const box = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 1.1, 0.5), dark, n);
    this.lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial(), n * LAMPS_PER_HEAD);
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    this.heads.forEach((h, i) => {
      pole.setMatrixAt(i, poseMatrix(m, h.poleX, h.poleY, 0));
      const dx = h.headX - h.poleX;
      const dy = h.headY - h.poleY;
      const len = Math.hypot(dx, dy);
      m.compose(new THREE.Vector3((h.poleX + h.headX) / 2, HEAD_H + 0.5, -(h.poleY + h.headY) / 2), new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(dy, dx)), new THREE.Vector3(len, 1, 1));
      arm.setMatrixAt(i, m);
      box.setMatrixAt(i, poseMatrix(m, h.headX, h.headY, h.facing, HEAD_H));
      [0.36, 0, -0.36, -0.36].forEach((dz, k) => {
        const side = k === 3 ? 0.36 : 0;
        const fx = h.headX + Math.cos(h.facing) * 0.2 - Math.sin(h.facing) * side;
        const fy = h.headY + Math.sin(h.facing) * 0.2 + Math.cos(h.facing) * side;
        this.lamps.setMatrixAt(i * LAMPS_PER_HEAD + k, poseMatrix(m, fx, fy, h.facing, HEAD_H + dz, k === 3 ? 0.8 : 1));
      });
    });
    pole.castShadow = arm.castShadow = box.castShadow = true;
    this.group.add(pole, arm, box, this.lamps);
  }

  update(signals: SignalSystem): void {
    this.heads.forEach((h, i) => {
      const state = signals.connectorState(h.main);
      const arrow: LightState | null = h.arrow ? signals.connectorState(h.arrow) : null;
      this.setLamp(i, 0, state === 'red' ? PALETTE.lampRed : PALETTE.lampOff);
      this.setLamp(i, 1, state === 'yellow' ? PALETTE.lampYellow : PALETTE.lampOff);
      this.setLamp(i, 2, state === 'green' ? PALETTE.lampGreen : PALETTE.lampOff);
      this.setLamp(i, 3, arrow === 'green' ? PALETTE.lampGreen : arrow === 'yellow' ? PALETTE.lampYellow : PALETTE.lampOff);
    });
    if (this.lamps.instanceColor) this.lamps.instanceColor.needsUpdate = true;
  }

  private setLamp(head: number, k: number, hex: number): void {
    this.lamps.setColorAt(head * LAMPS_PER_HEAD + k, this.color.setHex(hex));
  }
}
