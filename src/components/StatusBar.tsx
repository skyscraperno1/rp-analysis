import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { trackColor } from "../lib/colors";
import { tipAttrs } from "../lib/tooltip";

/** 图例最多画多少个轨道色块，超出折叠成 “+N” */
const MAX_LEGEND = 24;

export function StatusBar({
  cursor
}: {
  cursor: { x: number; y: number } | null;
}) {
  const view = useStore(s => s.view);
  const vp = useStore(s => s.vp);
  const image = useStore(s => s.image);
  const boxes = useStore(s => s.boxes);
  const selected = useStore(s => s.selected);
  const trackFilter = useStore(s => s.trackFilter);
  const setTrackFilter = useStore(s => s.setTrackFilter);

  /** 出现的轨道（按编号升序）及各轨道的点数 */
  const tracks = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of boxes) {
      if (!b.hasTrack) continue;
      m.set(b.track_id, (m.get(b.track_id) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, count]) => ({ id, count }));
  }, [boxes]);

  const shown = tracks.slice(0, MAX_LEGEND);
  const hidden = tracks.length - shown.length;

  const y0 = Math.max(0, Math.round(-view.y / view.scale));
  const y1 = image
    ? Math.min(image.height, Math.round((vp.height - view.y) / view.scale))
    : 0;

  return (
    <div className="statusbar">
      <span>
        {cursor
          ? `X ${cursor.x.toFixed(1)}  Y ${cursor.y.toFixed(1)}`
          : "光标 —"}
      </span>
      <span className="sep">|</span>
      <span>
        可见 y {y0} ~ {y1}
      </span>
      <span className="sep">|</span>
      <span>
        {boxes.length} 个点位 · 选中 {selected.length}
        {trackFilter != null ? ` · 只看轨道 ${trackFilter}` : ""}
      </span>
      <div className="spacer" />
      {/* 轨道图例：点一下 = 左侧列表只看该轨道，与左侧图例效果相同；
         再点一下当前项 = 取消筛选 */}
      <span className="legend">
        {shown.map(t => (
          <button
            key={t.id}
            className={`legend-track${trackFilter === t.id ? " active" : ""}`}
            onClick={() => setTrackFilter(trackFilter === t.id ? null : t.id)}
            {...tipAttrs(`轨道 ${t.id}：${t.count} 个点位`, "top")}
          >
            <i style={{ background: trackColor(t.id) }} />
            {t.id}
          </button>
        ))}
        {hidden > 0 && (
          <span
            className="legend-track"
            {...tipAttrs(`还有 ${hidden} 条轨道未显示`, "top")}
          >
            +{hidden}
          </span>
        )}
      </span>
    </div>
  );
}
