import type { Box } from "../types";

export interface SortOptions {
  /** 行容差（像素）：点与行偏移量的 Y 距离在容差内即归入该行 */
  tolerance: number;
}

export interface RowOffset {
  /** 该行的参考偏移量（图像 Y 坐标，像素） */
  offset: number;
  /** 落入该行的点数 */
  size: number;
}

export interface SortResult {
  /** id -> 1 起始的编号 */
  order: Map<string, number>;
  /** 非空行数 */
  rowCount: number;
  rowSizes: number[];
  /** 每行信息（与传入的 offsets 顺序一致，末尾附带"各自成行"的散点行） */
  rows: RowOffset[];
}

/** 默认行容差（像素） */
export const DEFAULT_TOLERANCE = 70;

interface Pt {
  id: string;
  x: number;
  y: number;
}

interface Row {
  offset: number;
  items: Pt[];
}

function toPoints(boxes: Box[]): Pt[] {
  return boxes
    .map(b => ({
      id: b.id,
      x: (b.bbox[0] + b.bbox[2]) / 2,
      y: (b.bbox[1] + b.bbox[3]) / 2
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** 顺序聚类：逐点扫描，与行的滑动均值比较，落在容差内归入该行 */
function clusterRows(pts: Pt[], tol: number): Row[] {
  const rows: { sum: number; n: number; items: Pt[] }[] = [];
  for (const p of pts) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(p.y - last.sum / last.n) <= tol) {
      last.sum += p.y;
      last.n++;
      last.items.push(p);
    } else {
      rows.push({ sum: p.y, n: 1, items: [p] });
    }
  }
  return rows.map(r => ({ offset: r.sum / r.n, items: r.items }));
}

/** 按给定的每行偏移量分配：点归入"偏移量最近且距离 ≤ 容差"的行；都不满足的各自成行 */
function assignRows(pts: Pt[], offsets: number[], tol: number): Row[] {
  const rows: Row[] = offsets.map(o => ({ offset: o, items: [] }));
  const extra: Pt[] = [];
  for (const p of pts) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < offsets.length; i++) {
      const d = Math.abs(p.y - offsets[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && bestD <= tol) rows[best].items.push(p);
    else extra.push(p);
  }
  for (const p of extra) rows.push({ offset: p.y, items: [p] });
  return rows;
}

/**
 * 空间排序：从上到下一行一行编号，每行内从左到右（横向排列）。
 * 不传 offsets 时自动聚类求每行偏移量；传入 offsets 时按偏移量分配
 * （每行偏移量可不同，解决行中心不齐的问题）。
 * 容差单位为像素。
 */
export function computeSort(
  boxes: Box[],
  opts: SortOptions,
  offsets?: number[]
): SortResult {
  const empty: SortResult = {
    order: new Map(),
    rowCount: 0,
    rowSizes: [],
    rows: []
  };
  if (boxes.length === 0) return empty;
  const tol = Math.max(2, opts.tolerance);
  const pts = toPoints(boxes);

  const explicit = Array.isArray(offsets) && offsets.length > 0;
  const rows: Row[] = explicit
    ? assignRows(pts, offsets!, tol)
    : clusterRows(pts, tol);

  // 编号顺序：按行的偏移量升序（稳定排序）
  const numOrder = rows
    .map((_, i) => i)
    .sort((a, b) => rows[a].offset - rows[b].offset);

  const order = new Map<string, number>();
  const rowSizes: number[] = [];
  let idx = 1;
  for (const i of numOrder) {
    const r = rows[i];
    if (r.items.length === 0) continue;
    r.items.sort((a, b) => a.x - b.x);
    for (const p of r.items) order.set(p.id, idx++);
    rowSizes.push(r.items.length);
  }

  return {
    order,
    rowCount: rowSizes.length,
    rowSizes,
    rows: rows.map(r => ({ offset: r.offset, size: r.items.length }))
  };
}
