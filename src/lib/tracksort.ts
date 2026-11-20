import type { Box } from '../types';

/**
 * 重算 track_id。
 */

/** 默认分列容差（像素）：相邻点中心 x 的间距小于它就算同一列。
 *  调大会把相近的列并成一列（40px → 16 列，60px → 14 列），调小会把一列拆开。
 *  取值比排序编号的行容差（默认 70px、20~160px）小很多：列间距本就比行间距密。 */
export const DEFAULT_TRACK_TOLERANCE = 22;

export interface RecomputeTracksOptions {
  /** 分列容差（像素），默认 DEFAULT_TRACK_TOLERANCE */
  tolerance?: number;
  /** 每列的参考偏移量（图像 X 坐标，像素）；传入后按偏移量分配 */
  offsets?: number[];
  /** 返回的 moves 明细最多几条，默认 8（只用于 toast / 预览） */
  maxMoves?: number;
}

export interface TrackMove {
  /** 文件里的 stud 编号；旧格式没有 id 时为 null */
  studId: number | null;
  from: number;
  to: number;
}

export interface TrackColOffset {
  /** 该列的参考偏移量（图像 X 坐标，像素） */
  offset: number;
  /** 落入该列的点数 */
  size: number;
  /** 该列重算后的轨道号 */
  trackId: number;
}

export interface RecomputeTracksResult {
  /** 重算后的框数组（全新对象，入参不被修改；只改 track_id） */
  boxes: Box[];
  /** 重算出的列数 */
  trackCount: number;
  /** 每列的点数（按轨道号 0..N-1） */
  sizes: number[];
  /** 每列信息（与传入的 offsets 顺序一致，末尾附带"各自成列"的散点列） */
  cols: TrackColOffset[];
  /** 轨道号发生变化的点数 */
  changed: number;
  /** 变化明细（最多 maxMoves 条） */
  moves: TrackMove[];
}

interface Pt {
  b: Box;
  x: number;
  tid: number;
}

interface Col {
  offset: number;
  items: Pt[];
}

/** 中心 x；异常值退化成 0，保证排序是全序 */
function toPoints(boxes: Box[]): Pt[] {
  return boxes
    .map((b) => {
      const cx = (b.bbox[0] + b.bbox[2]) / 2;
      return { b, x: Number.isFinite(cx) ? cx : 0, tid: Number.isFinite(b.track_id) ? b.track_id : 0 };
    })
    .sort((a, b) => a.x - b.x || a.tid - b.tid || (a.b.studId ?? Infinity) - (b.b.studId ?? Infinity));
}

/** 顺序聚类：逐点扫描，与列的滑动均值比较，落在容差内归入该列 */
function clusterCols(pts: Pt[], tol: number): Col[] {
  const cols: { sum: number; n: number; items: Pt[] }[] = [];
  for (const p of pts) {
    const last = cols[cols.length - 1];
    if (last && Math.abs(p.x - last.sum / last.n) <= tol) {
      last.sum += p.x;
      last.n++;
      last.items.push(p);
    } else {
      cols.push({ sum: p.x, n: 1, items: [p] });
    }
  }
  return cols.map((c) => ({ offset: c.sum / c.n, items: c.items }));
}

/** 按给定的每列偏移量分配：点归入"偏移量最近且距离 ≤ 容差"的列；都不满足的各自成列 */
function assignCols(pts: Pt[], offsets: number[], tol: number): Col[] {
  const cols: Col[] = offsets.map((o) => ({ offset: o, items: [] }));
  const extra: Pt[] = [];
  for (const p of pts) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < offsets.length; i++) {
      const d = Math.abs(p.x - offsets[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && bestD <= tol) cols[best].items.push(p);
    else extra.push(p);
  }
  for (const p of extra) cols.push({ offset: p.x, items: [p] });
  return cols;
}

/**
 * 重算 track_id：把所有点按中心 x 重新分列，从左到右编 0..N-1。
 *
 * 算法：按中心 x 排序后顺序扫描，与当前列的滑动均值比较，超出容差就新开一列。
 * 和 computeSort 的行聚类同构，只是换成 x 方向。列天然按 x 升序，直接编号。
 *
 * 传入 offsets 时按每列偏移量分配（列中心不齐时可直接修改某一列的偏移量），
 * 此时轨道号仍按偏移量升序编，空列也占一个号，偏移量列表和轨道号保持 1:1。
 *
 * 确定性：同一份输入永远得到同一份输出，与传入顺序无关。
 *
 * 注意：在中间插入一列，其后所有列号都会 +1（从左到右连续编号的必然结果），
 * 所以 changed 可能远大于"真正动过"的点数。toast 里会报出来，且可 Ctrl+Z 撤销。
 */
export function recomputeTracks(boxes: Box[], opts: RecomputeTracksOptions = {}): RecomputeTracksResult {
  const tol = Math.max(1, opts.tolerance ?? DEFAULT_TRACK_TOLERANCE);
  const maxMoves = Math.max(0, opts.maxMoves ?? 8);

  const pts = toPoints(boxes);

  const explicit = Array.isArray(opts.offsets) && opts.offsets.length > 0;
  const cols: Col[] = explicit ? assignCols(pts, opts.offsets!, tol) : clusterCols(pts, tol);

  // 编号顺序：按列的偏移量升序（稳定排序；用户编辑偏移量后顺序可能变）
  const numOrder = cols.map((_, i) => i).sort((a, b) => cols[a].offset - cols[b].offset);

  const newId = new Map<string, number>();
  const colIds = cols.map(() => 0);
  const sizes: number[] = [];
  numOrder.forEach((ci, tid) => {
    colIds[ci] = tid;
    sizes.push(cols[ci].items.length);
    for (const p of cols[ci].items) newId.set(p.b.id, tid);
  });

  const moves: TrackMove[] = [];
  let changed = 0;
  const out = boxes.map((b) => {
    const to = newId.get(b.id) ?? 0;
    if (to !== b.track_id) {
      changed++;
      if (moves.length < maxMoves) moves.push({ studId: b.studId, from: b.track_id, to });
    }
    return { ...b, track_id: to, hasTrack: true };
  });

  return {
    boxes: out,
    trackCount: cols.length,
    sizes,
    cols: cols.map((c, i) => ({ offset: c.offset, size: c.items.length, trackId: colIds[i] })),
    changed,
    moves,
  };
}
