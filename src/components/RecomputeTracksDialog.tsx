import { useEffect, useMemo, useRef, useState } from "react";
import { OverlayScrollbars } from "overlayscrollbars";
import "overlayscrollbars/overlayscrollbars.css";
import { useStore } from "../store/useStore";
import { recomputeTracks, DEFAULT_TRACK_TOLERANCE } from "../lib/tracksort";
import { trackColor } from "../lib/colors";
import { Modal } from "./Modal";

/** 变化明细最多列几条，超出折叠成「还有 N 个」 */
const MAX_MOVES = 40;

/** 分列容差滑杆：取值范围比排序编号的行容差（20~160px）小很多 */
const TOL_MIN = 2;
const TOL_MAX = 60;
const TOL_STEP = 2;

/** 给一组 (host, viewport) 挂细悬浮滚动条；deps 变化时重挂（内容出现/消失） */
function useThinScrollbars(
  pairs: Array<
    [
      React.RefObject<HTMLDivElement | null>,
      React.RefObject<HTMLDivElement | null>
    ]
  >,
  deps: unknown[]
) {
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    for (const [host, viewport] of pairs) {
      const h = host.current;
      const v = viewport.current;
      if (!h || !v) continue;
      const os = OverlayScrollbars(
        { target: h, elements: { viewport: v, content: v } },
        {
          scrollbars: { autoHide: "leave", autoHideDelay: 300 },
          overflow: { x: "hidden", y: "scroll" }
        }
      );
      cleanups.push(() => os.destroy());
    }
    return () => cleanups.forEach(fn => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * 「重算轨道」确认弹窗：先在这里预览结果，用户点「确认重算」后才真正改写 track_id。
 * 和「排序编号」同构：分列容差 + 每列偏移量（X 像素）可编辑，实时预览后再应用。
 */
export function RecomputeTracksDialog() {
  const open = useStore(s => s.recomputeOpen);
  const setOpen = useStore(s => s.setRecomputeOpen);
  const boxes = useStore(s => s.boxes);
  const apply = useStore(s => s.applyRecomputeTracks);

  const [tolerance, setTolerance] = useState(DEFAULT_TRACK_TOLERANCE);
  /** 用户手动编辑过的列偏移量；null 表示用自动聚类结果 */
  const [edited, setEdited] = useState<number[] | null>(null);

  // 自动聚类结果（作为初始偏移量）
  const auto = useMemo(
    () => recomputeTracks(boxes, { tolerance }),
    [boxes, tolerance]
  );
  const offsets = edited ?? auto.cols.map(c => c.offset);

  // 按当前偏移量实时预览
  const res = useMemo(
    () => recomputeTracks(boxes, { tolerance, offsets, maxMoves: MAX_MOVES }),
    [boxes, tolerance, offsets]
  );

  // 容差变化时放弃手动编辑，回到自动值
  useEffect(() => {
    setEdited(null);
  }, [tolerance]);

  const movesHostRef = useRef<HTMLDivElement>(null);
  const movesViewportRef = useRef<HTMLDivElement>(null);
  const offsetsHostRef = useRef<HTMLDivElement>(null);
  const offsetsViewportRef = useRef<HTMLDivElement>(null);
  useThinScrollbars(
    [
      [movesHostRef, movesViewportRef],
      [offsetsHostRef, offsetsViewportRef]
    ],
    [open, res.changed]
  );

  if (!open) return null;

  const extraPoints = res.cols
    .slice(offsets.length)
    .reduce((s, c) => s + c.size, 0);
  const emptyCols = res.cols
    .slice(0, offsets.length)
    .filter(c => c.size === 0).length;

  const setOffset = (i: number, v: number) => {
    if (!Number.isFinite(v)) return;
    const next = offsets.slice();
    next[i] = v;
    setEdited(next);
  };

  return (
    <Modal
      title="重算轨道"
      onClose={() => setOpen(false)}
      footer={
        <>
          <button className="btn" onClick={() => setOpen(false)}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={() => apply({ tolerance }, offsets)}
          >
            确认重算
          </button>
        </>
      }
    >
      <p className="desc">
        按方框中心 x 重新分列，从左到右重写 track_id（0..N-1）。
      </p>

      <div className="row">
        <span className="row-label">分列容差</span>
        <input
          type="range"
          min={TOL_MIN}
          max={TOL_MAX}
          step={TOL_STEP}
          value={tolerance}
          onChange={e => setTolerance(Number(e.target.value))}
        />
        <span className="mono">{tolerance} px</span>
      </div>

      <div className="preview">
        共 <b>{res.trackCount}</b> 条轨道 / <b>{boxes.length}</b> 个点位（空列{" "}
        <b>{emptyCols}</b> 列）·{" "}
        {res.changed === 0 ? (
          <b>无变化</b>
        ) : (
          <>
            <b className="warn">{res.changed}</b> 个点位轨道号会变
          </>
        )}
        {extraPoints > 0 && (
          <span className="warn">
            {" "}
            · {extraPoints} 个点未落入任何列，已各自成列
          </span>
        )}
      </div>

      <div className="offsets">
        <div className="offsets-head">
          <span>每列偏移量（X 像素，可编辑）</span>
          <button
            className="btn small"
            onClick={() => setEdited(null)}
            disabled={!edited}
          >
            重算自动值
          </button>
        </div>
        <div className="offsets-scroll" ref={offsetsHostRef}>
          <div ref={offsetsViewportRef}>
            {offsets.map((o, i) => {
              const col = res.cols[i];
              const size = col?.size ?? 0;
              return (
                <div
                  key={i}
                  className={`offset-row${size === 0 ? " empty" : ""}`}
                >
                  <span className="tno">
                    <i
                      className="dot"
                      style={{ background: trackColor(col?.trackId ?? i) }}
                    />
                    {col?.trackId ?? i}
                  </span>
                  <input
                    type="number"
                    value={Math.round(o * 10) / 10}
                    onChange={e => setOffset(i, Number(e.target.value))}
                  />
                  <span className="osize">{size} 个</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {res.changed > 0 && (
        <>
          <div className="section-label">会变化的点位（原轨道 → 新轨道）</div>
          <div className="offsets">
            <div className="offsets-head">
              <span>共 {res.changed} 个</span>
            </div>
            <div className="offsets-scroll" ref={movesHostRef}>
              <div ref={movesViewportRef}>
                {res.moves.map((m, i) => (
                  <div key={m.studId ?? i} className="offset-row">
                    <span className="orno">
                      {m.studId != null ? `#${m.studId}` : ""}
                    </span>
                    <span className="mono">
                      {m.from} → {m.to}
                    </span>
                  </div>
                ))}
                {res.changed - res.moves.length > 0 && (
                  <div className="offset-row empty">
                    <span className="orno" />
                    <span className="mono">
                      …还有 {res.changed - res.moves.length} 个
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="hint">
        确认后可 Ctrl+Z 撤销。重算只改 track_id，不影响编号（index）和方框位置。
      </div>
    </Modal>
  );
}
