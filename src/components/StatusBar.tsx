import { useStore } from '../store/useStore';
import { BOX_COLORS } from '../lib/colors';

export function StatusBar({ cursor }: { cursor: { x: number; y: number } | null }) {
  const view = useStore((s) => s.view);
  const vp = useStore((s) => s.vp);
  const image = useStore((s) => s.image);
  const boxes = useStore((s) => s.boxes);
  const selected = useStore((s) => s.selected);

  const y0 = Math.max(0, Math.round(-view.y / view.scale));
  const y1 = image ? Math.min(image.height, Math.round((vp.height - view.y) / view.scale)) : 0;

  return (
    <div className="statusbar">
      <span>{cursor ? `X ${cursor.x.toFixed(1)}  Y ${cursor.y.toFixed(1)}` : '光标 —'}</span>
      <span className="sep">|</span>
      <span>
        可见 y {y0} ~ {y1}
      </span>
      <span className="sep">|</span>
      <span>
        {boxes.length} 个点位 · 选中 {selected.length}
      </span>
      <div className="spacer" />
      <span className="legend">
        <i style={{ background: BOX_COLORS.existing.stroke }} />
        已有
        <i style={{ background: BOX_COLORS.manual.stroke }} />
        新增
        <i style={{ background: BOX_COLORS.selected.stroke }} />
        选中
      </span>
    </div>
  );
}
