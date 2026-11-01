/**
 * Uniform-grid spatial index over a fixed world rectangle. Rebuilt every
 * step (clear + insert), which is cheaper than maintaining a tree for a few
 * thousand moving agents.
 */
export class SpatialGrid {
  private readonly cells: number[][];
  /** Indices of non-empty cells, so clear() costs O(occupied) instead of O(all cells). */
  private readonly used: number[] = [];
  private readonly cols: number;
  private readonly rows: number;

  constructor(
    private readonly minX: number,
    private readonly minY: number,
    maxX: number,
    maxY: number,
    private readonly cellSize: number,
  ) {
    this.cols = Math.max(1, Math.ceil((maxX - minX) / cellSize));
    this.rows = Math.max(1, Math.ceil((maxY - minY) / cellSize));
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear(): void {
    for (const i of this.used) (this.cells[i] as number[]).length = 0;
    this.used.length = 0;
  }

  private cellCoord(v: number, min: number, n: number): number {
    const c = Math.floor((v - min) / this.cellSize);
    return c < 0 ? 0 : c >= n ? n - 1 : c;
  }

  insert(id: number, x: number, y: number): void {
    const cx = this.cellCoord(x, this.minX, this.cols);
    const cy = this.cellCoord(y, this.minY, this.rows);
    const i = cy * this.cols + cx;
    const cell = this.cells[i] as number[];
    if (cell.length === 0) this.used.push(i);
    cell.push(id);
  }

  /** Visit every id whose cell intersects the square of half-size r around (x, y). */
  query(x: number, y: number, r: number, visit: (id: number) => void): void {
    const x0 = this.cellCoord(x - r, this.minX, this.cols);
    const x1 = this.cellCoord(x + r, this.minX, this.cols);
    const y0 = this.cellCoord(y - r, this.minY, this.rows);
    const y1 = this.cellCoord(y + r, this.minY, this.rows);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells[cy * this.cols + cx] as number[];
        for (let i = 0; i < cell.length; i++) visit(cell[i] as number);
      }
    }
  }
}
