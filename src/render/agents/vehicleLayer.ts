import * as THREE from 'three';
import type { Vehicle, VehicleKind } from '../../sim';
import { interpolate } from '../core/coords';
import { sedan, suv, taxi } from './carModels';
import { bus, motorbike, truck } from './heavyModels';
import type { VehicleModel } from './modelTypes';

const MODELS: Record<VehicleKind, () => VehicleModel> = { car: sedan, suv, taxi, motorbike, bus, truck };
const BRAKE_ON = new THREE.Color(0xff2626);
const BRAKE_OFF = new THREE.Color(0x4a0d0d);

interface KindMeshes {
  body: THREE.InstancedMesh;
  detail: THREE.InstancedMesh;
  lights: THREE.InstancedMesh;
  length: number;
}

/** Background traffic: three instanced meshes (paint, details, brake lamps) per vehicle kind. */
export class VehicleLayer {
  readonly group = new THREE.Group();
  private readonly kinds = new Map<VehicleKind, KindMeshes>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly color = new THREE.Color();

  constructor(capacity: number) {
    const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 });
    const detail = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    const lamp = new THREE.MeshBasicMaterial({ vertexColors: true });
    for (const kind of Object.keys(MODELS) as VehicleKind[]) {
      const model = MODELS[kind]();
      const make = (g: THREE.BufferGeometry, mat: THREE.Material, shadow: boolean) => {
        const mesh = new THREE.InstancedMesh(g, mat, capacity);
        mesh.castShadow = shadow;
        mesh.count = 0;
        mesh.frustumCulled = false;
        this.group.add(mesh);
        return mesh;
      };
      this.kinds.set(kind, {
        body: make(model.body.build(), paint, true),
        detail: make(model.detail.build(), detail, true),
        lights: make(model.lights.build(), lamp, false),
        length: model.length,
      });
    }
  }

  update(vehicles: readonly Vehicle[], alpha: number): void {
    const counts = new Map<VehicleKind, number>();
    const up = new THREE.Vector3(0, 1, 0);
    for (const v of vehicles) {
      const set = this.kinds.get(v.kind) as KindMeshes;
      const i = counts.get(v.kind) ?? 0;
      counts.set(v.kind, i + 1);
      const p = interpolate(v, alpha);
      this.q.setFromAxisAngle(up, p.heading);
      this.m.compose(new THREE.Vector3(p.x, 0, -p.y), this.q, new THREE.Vector3(v.length / set.length, 1, 1));
      set.body.setMatrixAt(i, this.m);
      set.detail.setMatrixAt(i, this.m);
      set.lights.setMatrixAt(i, this.m);
      set.body.setColorAt(i, this.color.setHex(v.color));
      set.lights.setColorAt(i, v.accel < -0.6 || v.speed < 0.3 ? BRAKE_ON : BRAKE_OFF);
    }
    for (const [kind, set] of this.kinds) {
      const n = counts.get(kind) ?? 0;
      for (const mesh of [set.body, set.detail, set.lights]) {
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
