import * as THREE from 'three';

/**
 * Accumulates boxes and quads into one non-indexed BufferGeometry so a whole
 * layer (buildings, markings, a vehicle model) renders in a single draw call.
 */
export class GeometryBuilder {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly uv: number[] = [];
  private readonly col: number[] = [];

  /** Quad from four corners (counter-clockwise seen from the normal side). */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color = 0xffffff, uvs?: number[]): this {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const tc = new THREE.Color(color);
    const u = uvs ?? [0, 0, 1, 0, 1, 1, 0, 1];
    const corners = [a, b, c, a, c, d];
    const uvIdx = [0, 1, 2, 0, 2, 3];
    corners.forEach((p, i) => {
      this.pos.push(p.x, p.y, p.z);
      this.nrm.push(n.x, n.y, n.z);
      const k = uvIdx[i] as number;
      this.uv.push(u[k * 2] as number, u[k * 2 + 1] as number);
      this.col.push(tc.r, tc.g, tc.b);
    });
    return this;
  }

  /** Horizontal rectangle at height y, centred at (x, z), rotated by `rotY` around the vertical axis. */
  flatRect(x: number, y: number, z: number, sx: number, sz: number, rotY = 0, color = 0xffffff): this {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const p = (lx: number, lz: number) => new THREE.Vector3(x + lx * c + lz * s, y, z - lx * s + lz * c);
    const hx = sx / 2;
    const hz = sz / 2;
    return this.quad(p(-hx, hz), p(hx, hz), p(hx, -hz), p(-hx, -hz), color);
  }

  /**
   * Axis-aligned box in a local frame (x forward, y up, z lateral) placed at
   * (x, y, z) and yawed by `rotY`. `uvScale` maps metres to texture repeats.
   */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, color = 0xffffff, rotY = 0, uvScale?: [number, number]): this {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const P = (lx: number, ly: number, lz: number) => new THREE.Vector3(x + lx * c + lz * s, y + ly, z - lx * s + lz * c);
    const [hx, hy, hz] = [sx / 2, sy / 2, sz / 2];
    const faceUv = (w: number, h: number) => (uvScale ? [0, 0, w * uvScale[0], 0, w * uvScale[0], h * uvScale[1], 0, h * uvScale[1]] : undefined);
    this.quad(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), color, faceUv(sz, sy)); // +x
    this.quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), color, faceUv(sz, sy)); // -x
    this.quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), color, faceUv(sx, sy)); // +z
    this.quad(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), color, faceUv(sx, sy)); // -z
    this.quad(P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz), color); // top
    this.quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), color); // bottom
    return this;
  }

  get isEmpty(): boolean {
    return this.pos.length === 0;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}
