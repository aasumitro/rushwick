import * as THREE from 'three';
import type { EgoVehicle } from '../../sim';
import { interpolate } from '../core/coords';
import { PALETTE } from '../core/palette';
import { passengerCar } from './carModels';

/** The ego car: distinct paint, a roof-mounted lidar puck and a ground halo. */
export class EgoActor {
  readonly group = new THREE.Group();

  constructor() {
    const model = passengerCar(4.6, 1.85, 1.5);
    const paint = new THREE.MeshStandardMaterial({ color: PALETTE.ego, roughness: 0.3, metalness: 0.4 });
    const detail = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    const lamps = new THREE.MeshBasicMaterial({ color: 0xff3030 });
    const meshes = [
      new THREE.Mesh(model.body.build(), paint),
      new THREE.Mesh(model.detail.build(), detail),
      new THREE.Mesh(model.lights.build(), lamps),
    ];
    const lidar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.25, 0.25, 16),
      new THREE.MeshStandardMaterial({ color: 0x222831, metalness: 0.6, roughness: 0.3 }),
    );
    lidar.position.set(-0.2, 1.65, 0);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(2.9, 3.2, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: PALETTE.route, transparent: true, opacity: 0.55 }),
    );
    halo.position.y = 0.03;
    for (const m of meshes) m.castShadow = true;
    this.group.add(...meshes, lidar, halo);
    this.group.visible = false;
  }

  update(ego: EgoVehicle | null, alpha: number): void {
    this.group.visible = ego !== null;
    if (!ego) return;
    const p = interpolate(ego, alpha);
    this.group.position.set(p.x, 0, -p.y);
    this.group.rotation.y = p.heading;
  }
}
