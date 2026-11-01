import * as THREE from 'three';
import type { Route } from '../../sim';
import { PALETTE } from '../core/palette';

/** The ego's planned route drawn as a ribbon of points slightly above the road. */
export class RouteOverlay {
  readonly line: THREE.Line;
  private current: Route | null = null;

  constructor() {
    this.line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: PALETTE.route, transparent: true, opacity: 0.9 }),
    );
    this.line.frustumCulled = false;
  }

  update(route: Route | null, visible: boolean): void {
    this.line.visible = visible && route !== null;
    if (!route || route === this.current) return;
    this.current = route;
    const pts: number[] = [];
    for (let s = 0; s <= route.length; s += 1) {
      const p = route.path.sample(s);
      pts.push(p.x, 0.08, -p.y);
    }
    this.line.geometry.dispose();
    this.line.geometry = new THREE.BufferGeometry();
    this.line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }
}
