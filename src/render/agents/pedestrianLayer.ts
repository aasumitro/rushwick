import * as THREE from 'three';
import type { Pedestrian } from '../../sim';
import { interpolate } from '../core/coords';
import { PALETTE } from '../core/palette';

const HIP = 0.9;
const SLAB = 0.15;

/** Pedestrians as instanced torso / legs / head with a simple walk cycle. */
export class PedestrianLayer {
  readonly group = new THREE.Group();
  private readonly torso: THREE.InstancedMesh;
  private readonly legs: THREE.InstancedMesh;
  private readonly heads: THREE.InstancedMesh;
  private readonly base = new THREE.Matrix4();
  private readonly local = new THREE.Matrix4();
  private readonly out = new THREE.Matrix4();
  private readonly color = new THREE.Color();

  constructor(capacity: number) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    this.torso = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.62, 0.42).translate(0, HIP + 0.31, 0), mat, capacity);
    this.legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, HIP, 0.15).translate(0, -HIP / 2, 0), mat, capacity * 2);
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 8).translate(0, HIP + 0.76, 0), mat, capacity);
    for (const m of [this.torso, this.legs, this.heads]) {
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
  }

  update(peds: readonly Pedestrian[], alpha: number): void {
    const up = new THREE.Vector3(0, 1, 0);
    peds.forEach((ped, i) => {
      const p = interpolate(ped, alpha);
      const s = ped.height / 1.72;
      const swing = ped.speed > 0.05 ? Math.sin(ped.walkPhase) * 0.45 : 0;
      const bob = ped.speed > 0.05 ? Math.abs(Math.cos(ped.walkPhase)) * 0.035 : 0;
      this.base.compose(
        new THREE.Vector3(p.x, (ped.onRoad ? 0 : SLAB) + bob, -p.y),
        new THREE.Quaternion().setFromAxisAngle(up, p.heading),
        new THREE.Vector3(s, s, s),
      );
      this.torso.setMatrixAt(i, this.base);
      this.heads.setMatrixAt(i, this.base);
      this.torso.setColorAt(i, this.color.setHex(ped.shirt));
      this.heads.setColorAt(i, this.color.setHex(PALETTE.skin[ped.id % PALETTE.skin.length] as number));
      for (const side of [0, 1]) {
        this.local.makeRotationZ(side === 0 ? swing : -swing).setPosition(0, HIP, side === 0 ? 0.1 : -0.1);
        this.legs.setMatrixAt(i * 2 + side, this.out.multiplyMatrices(this.base, this.local));
        this.legs.setColorAt(i * 2 + side, this.color.setHex(ped.pants));
      }
    });
    this.torso.count = this.heads.count = peds.length;
    this.legs.count = peds.length * 2;
    for (const m of [this.torso, this.legs, this.heads]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
