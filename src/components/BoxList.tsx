import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { OverlayScrollbars } from "overlayscrollbars";
import "overlayscrollbars/overlayscrollbars.css";
import { useStore } from "../store/useStore";
import { trackColor } from "../lib/colors";
import { tipAttrs } from "../lib/tooltip";

/** 列表排序方式 */
type SortKey = "json" | "index" | "track";

const ALL_SORTS: { key: SortKey; label: string; tip: string }[] = [
  { key: "json", label: "原序", tip: "按 JSON 文件里的原始顺序" },
  { key: "index", label: "编号", tip: "按排序编号从小到大" },
  { key: "track", label: "轨道", tip: "按轨道列分组，同列内从上到下" }
];

/** 测量分段控件内选中 tab 的位置，驱动滑动指示器。
 *  deps 里除了当前选中项，还要带上 tab 集合 —— tab 个数变化时所有 tab 都会
 *  变宽/变窄（等分 flex），指示器必须重新量，否则会停在旧尺寸上 */
function useSegIndicator(activeKey: string, tabsKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; y: number; w: number } | null>(
    null
  );
  // 用 layout effect：首帧测量完再绘制，避免指示器从左边滑入的闪跳
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const active = c.querySelector(".sort-tab.active") as HTMLElement | null;
    if (!active) {
      setInd(null);
      return;
    }
    const cr = c.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    setInd({ x: ar.left - cr.left, y: ar.top - cr.top, w: ar.width });
  }, [activeKey, tabsKey]);
  return { ref, ind };
}

export function BoxList() {
  const boxes = useStore(s => s.boxes);
  const dataVersion = useStore(s => s.dataVersion);
  const selected = useStore(s => s.selected);
  const select = useStore(s => s.select);
  const toggleSelect = useStore(s => s.toggleSelect);
  const focusBox = useStore(s => s.focusBox);
  const deleteSelected = useStore(s => s.deleteSelected);
  const selectAll = useStore(s => s.selectAll);
  const lastIdx = useRef<number | null>(null);
  /** 轨道筛选：null = 全部（与右下角状态栏图例共用） */
  const trackFilter = useStore(s => s.trackFilter);
  const setTrackFilter = useStore(s => s.setTrackFilter);
  /** 列表排序。默认按画面位置（从上到下、从左到右）——
   *  不依赖文件有没有 index / track_id，永远和画面一致 */
  const [sortKey, setSortKey] = useState<SortKey>("track");

  /* OverlayScrollbars：细悬浮滚动条（自动隐藏，不占布局宽度）
     注意：必须像官方 React 包装包那样，用一个 React 自己的内层 div 充当 OS 的
     viewport/content，否则 OS 会搬动 React 的子节点导致 removeChild 崩溃 */
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    const viewport = viewportRef.current;
    if (!host || !viewport) return;
    const os = OverlayScrollbars(
      { target: host, elements: { viewport, content: viewport } },
      {
        scrollbars: { autoHide: "leave", autoHideDelay: 300 },
        overflow: { x: "hidden", y: "scroll" }
      }
    );
    return () => os.destroy();
  }, []);

  /** 出现的轨道（按编号升序）及各轨道的点数 */
  const tracks = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of boxes) m.set(b.track_id, (m.get(b.track_id) ?? 0) + 1);
    return [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, count]) => ({ id, count }));
  }, [boxes]);

  /** 有没有编号可排：排序编号，或文件自带的 ID。两者都没有就不出「编号」tab */
  const hasNumber = useMemo(
    () => boxes.some(b => b.index != null || b.studId != null),
    [boxes]
  );
  /** 只有一列时「轨道」排序没有意义，不出这个 tab */
  const hasTracks = tracks.length > 1;
  const sorts = useMemo(
    () =>
      ALL_SORTS.filter(
        s =>
          (s.key !== "index" || hasNumber) && (s.key !== "track" || hasTracks)
      ),
    [hasNumber, hasTracks]
  );

  // 换一份数据就回到默认排序：按轨道列。
  // 只有一列时（没有 track_id 的旧格式）它就是画面位置 —— 从上到下、从左到右，
  // 此时「轨道」tab 不显示，分段控件里没有任何选中项
  useEffect(() => {
    setSortKey("track");
  }, [dataVersion]);

  // 刚跑完排序编号（编号从无到有）时跟着切到按编号排，别停在旧顺序上
  const hasIndex = useMemo(() => boxes.some(b => b.index != null), [boxes]);
  const hadIndex = useRef(false);
  useEffect(() => {
    if (hasIndex && !hadIndex.current) setSortKey("index");
    hadIndex.current = hasIndex;
  }, [hasIndex]);

  // 刚跑完重算轨道（轨道从无到有，「轨道」tab 刚出现）时跟着切到按轨道排，
  // 否则分段控件还停在选中项上，指示器也留着上一个 tab 集合的宽度
  const hadTracks = useRef(false);
  useEffect(() => {
    if (hasTracks && !hadTracks.current) setSortKey("track");
    hadTracks.current = hasTracks;
  }, [hasTracks]);

  // 当前筛选的轨道不存在了（被删完 / 换了数据）就回到全部
  useEffect(() => {
    if (trackFilter != null && !tracks.some(t => t.id === trackFilter))
      setTrackFilter(null);
  }, [tracks, trackFilter, setTrackFilter]);

  const rows = useMemo(() => {
    let arr = boxes.map((b, i) => ({ b, i }));
    if (trackFilter != null)
      arr = arr.filter(r => r.b.track_id === trackFilter);
    if (sortKey === "index") {
      // 编号 = 排序编号优先，退回文件里的 ID（和蓝色 # 列显示的数字一致）
      const num = (b: (typeof arr)[number]["b"]) =>
        b.index ?? b.studId ?? Infinity;
      arr.sort((a, b) => num(a.b) - num(b.b) || a.i - b.i);
    } else if (sortKey === "track") {
      // 同列内按从上到下、从左到右
      arr.sort(
        (a, b) =>
          a.b.track_id - b.b.track_id ||
          a.b.bbox[1] - b.b.bbox[1] ||
          a.b.bbox[0] - b.b.bbox[0] ||
          a.i - b.i
      );
    }
    // 'json'：boxes 本身就是上传时的文件顺序，不用排
    return arr;
  }, [boxes, trackFilter, sortKey]);

  const visibleSelected = useMemo(() => {
    const ids = new Set(rows.map(r => r.b.id));
    return selected.filter(id => ids.has(id)).length;
  }, [rows, selected]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 30,
    overscan: 24
  });

  const onClickRow = (e: React.MouseEvent, pos: number) => {
    const id = rows[pos].b.id;
    if (e.shiftKey && lastIdx.current != null) {
      const a = Math.min(lastIdx.current, pos);
      const b = Math.max(lastIdx.current, pos);
      select(rows.slice(a, b + 1).map(r => r.b.id));
    } else if (e.ctrlKey || e.metaKey) {
      toggleSelect(id);
      lastIdx.current = pos;
    } else {
      select([id]);
      focusBox(id);
      lastIdx.current = pos;
    }
  };

  const allVisibleSelected = rows.length > 0 && visibleSelected === rows.length;
  const sortInd = useSegIndicator(sortKey, sorts.map(s => s.key).join(" "));

  return (
    <div className="panel boxlist">
      <div className="panel-actions">
        <button
          className="btn"
          onClick={() => (allVisibleSelected ? select([]) : selectAll())}
          disabled={!rows.length}
          {...tipAttrs(
            trackFilter == null
              ? `选中全部 ${rows.length} 个点位（Ctrl+A）`
              : `选中当前轨道 ${trackFilter} 的 ${rows.length} 个点位（Ctrl+A）`,
            "bottom"
          )}
        >
          {allVisibleSelected ? "全不选" : "全选"} ({rows.length})
        </button>
        <button
          className="btn danger"
          onClick={deleteSelected}
          disabled={!visibleSelected}
        >
          删除{visibleSelected ? ` (${visibleSelected})` : ""}
        </button>
      </div>

      {/* 排序：原序 / ID / 轨道。当前排序键对应的那一列会在列表里提亮 */}
      <div className="sort-bar">
        <span className="sort-label">排序</span>
        <div className="sort-seg" ref={sortInd.ref}>
          {/* 滑动指示器：切换时平滑滑到新 tab，而不是瞬间跳过去 */}
          {sortInd.ind && (
            <span
              className="sort-tab-ind"
              style={{
                transform: `translate(${sortInd.ind.x}px, ${sortInd.ind.y}px)`,
                width: sortInd.ind.w
              }}
            />
          )}
          {sorts.map(s => (
            <button
              key={s.key}
              className={`sort-tab${sortKey === s.key ? " active" : ""}`}
              onClick={() => setSortKey(s.key)}
              {...tipAttrs(s.tip, "bottom")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="boxlist-scroll" ref={hostRef}>
        <div className="boxlist-viewport" ref={viewportRef}>
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map(vi => {
              const b = rows[vi.index].b;
              const isSel = selected.includes(b.id);
              const tc = trackColor(b.track_id);
              // 蓝色 # 列显示的数字：排序编号优先，没有编号才退回文件里的 ID；
              // 两者都没有（旧格式、又没编号）就只剩一个 #，后面不跟数字
              const num = b.index ?? b.studId;
              return (
                <div
                  key={b.id}
                  className={`boxrow${isSel ? " sel" : ""}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: vi.size,
                    transform: `translateY(${vi.start}px)`
                  }}
                  onClick={e => onClickRow(e, vi.index)}
                  {...tipAttrs(
                    [
                      b.studId != null ? `ID ${b.studId} · ` : "",
                      b.hasTrack ? `轨道 ${b.track_id} · ` : "",
                      b.index != null ? `#${b.index} · ` : "",
                      `起始点 (${b.bbox[0].toFixed(0)}, ${b.bbox[1].toFixed(0)}) · 宽 ${(b.bbox[2] - b.bbox[0]).toFixed(0)} × 高 ${(b.bbox[3] - b.bbox[1]).toFixed(0)} px`
                    ].join(""),
                    "right"
                  )}
                >
                  <span className={`id${sortKey === "index" ? " key" : ""}`}>
                    {num != null ? `#${num}` : "#"}
                  </span>
                  <span className={`track${sortKey === "track" ? " key" : ""}`}>
                    <i className="dot" style={{ background: tc }} />
                    {b.hasTrack ? b.track_id : ""}
                  </span>
                  <span className="coord">
                    {b.bbox[0].toFixed(0)}, {b.bbox[1].toFixed(0)}
                  </span>
                  <span className="dim">
                    {(b.bbox[2] - b.bbox[0]).toFixed(0)}×
                    {(b.bbox[3] - b.bbox[1]).toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
          {rows.length === 0 && (
            <div className="list-empty">
              {trackFilter == null
                ? "没有点位"
                : `轨道 ${trackFilter} 下没有点位`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
