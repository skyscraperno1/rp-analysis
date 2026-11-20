import { useEffect, useMemo, useRef, useState } from 'react';
import { OverlayScrollbars } from 'overlayscrollbars';
import 'overlayscrollbars/overlayscrollbars.css';
import { useStore } from '../store/useStore';
import { computeSort, DEFAULT_TOLERANCE } from '../lib/sorting';
import { Modal } from './Modal';

export function SortDialog() {
  const open = useStore((s) => s.sortOpen);
  const setOpen = useStore((s) => s.setSortOpen);
  const boxes = useStore((s) => s.boxes);
  const applySort = useStore((s) => s.applySort);

  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  /** 用户手动编辑过的行偏移量；null 表示用自动聚类结果 */
  const [edited, setEdited] = useState<number[] | null>(null);

  /* OverlayScrollbars：偏移量列表的细悬浮滚动条（内层 div 由 React 持有，
      充当 OS 的 viewport，避免 OS 搬动 React 子节点导致崩溃） */
  const offsetsHostRef = useRef<HTMLDivElement>(null);
  const offsetsViewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const host = offsetsHostRef.current;
    const viewport = offsetsViewportRef.current;
    if (!host || !viewport) return;
    const os = OverlayScrollbars(
      { target: host, elements: { viewport, content: viewport } },
      {
        scrollbars: { autoHide: 'leave', autoHideDelay: 300 },
        overflow: { x: 'hidden', y: 'scroll' },
      },
    );
    return () => os.destroy();
  }, [open]);

  // 自动聚类结果（作为初始偏移量）
  const auto = useMemo(() => computeSort(boxes, { tolerance }), [boxes, tolerance]);
  const offsets = edited ?? auto.rows.map((r) => r.offset);

  // 按当前偏移量实时预览
  const result = useMemo(() => computeSort(boxes, { tolerance }, offsets), [boxes, tolerance, offsets]);

  // 容差变化时放弃手动编辑，回到自动值
  useEffect(() => {
    setEdited(null);
  }, [tolerance]);

  if (!open) return null;

  const extraPoints = result.rows.slice(offsets.length).reduce((s, r) => s + r.size, 0);
  const emptyRows = result.rows.slice(0, offsets.length).filter((r) => r.size === 0).length;

  const setOffset = (i: number, v: number) => {
    if (!Number.isFinite(v)) return;
    const next = offsets.slice();
    next[i] = v;
    setEdited(next);
  };

  return (
    <Modal title="排序编号" onClose={() => setOpen(false)}>
      <p className="desc">
        从上到下一行一行编号，每行内从左到右。每行有独立的参考偏移量（Y 坐标，像素）：
        点距离某行偏移量在容差内即归入该行（取最近的一行），行中心不齐时可直接修改该行的偏移量。
      </p>

      <div className="row">
        <span className="row-label">行容差</span>
        <input
          type="range"
          min={20}
          max={160}
          step={2}
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
        />
        <span className="mono">{tolerance} px</span>
      </div>

      <div className="preview">
        共 <b>{offsets.length}</b> 行（有效 {result.rowCount} 行，空行 {emptyRows} 行）· 已编号{' '}
        <b>{result.order.size}</b> / {boxes.length} 个点位
        {extraPoints > 0 && <span className="warn"> · {extraPoints} 个点未落入任何行，已各自成行</span>}
      </div>

      <div className="offsets">
        <div className="offsets-head">
          <span>每行偏移量（Y 像素，可编辑）</span>
          <button className="btn small" onClick={() => setEdited(null)} disabled={!edited}>
            重算自动值
          </button>
        </div>
        <div className="offsets-scroll" ref={offsetsHostRef}>
          <div ref={offsetsViewportRef}>
            {offsets.map((o, i) => {
              const size = result.rows[i]?.size ?? 0;
              return (
                <div key={i} className={`offset-row${size === 0 ? ' empty' : ''}`}>
                  <span className="orno">{i + 1}</span>
                  <input
                    type="number"
                    value={Math.round(o * 10) / 10}
                    onChange={(e) => setOffset(i, Number(e.target.value))}
                  />
                  <span className="osize">{size} 个</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={() => setOpen(false)}>
          取消
        </button>
        <button className="btn primary" onClick={() => applySort({ tolerance }, offsets)}>
          应用编号
        </button>
      </div>
    </Modal>
  );
}
