import { useEffect, useRef, useState } from 'react';
import { Columns3, Eye, EyeOff, Hand, ListOrdered, MousePointer2, SquareDashed } from 'lucide-react';
import { useStore } from '../store/useStore';
import { TipButton } from './Tooltip';
import type { ToolMode } from '../types';

const TOOLS: { key: ToolMode; tip: string; Icon: typeof MousePointer2 }[] = [
  { key: 'select', tip: '选择 (V)', Icon: MousePointer2 },
  { key: 'draw', tip: '画新框 (D)', Icon: SquareDashed },
  { key: 'pan', tip: '平移 (H，或按住空格拖动)', Icon: Hand },
];

/** 编号显示：显示 / 隐藏 两个 tab */
const LABEL_TABS: { key: 'on' | 'off'; tip: string; Icon: typeof Eye }[] = [
  { key: 'on', tip: '显示编号', Icon: Eye },
  { key: 'off', tip: '隐藏编号', Icon: EyeOff },
];

/** 测量分组内选中 tab 的位置，驱动滑动指示器 */
function useTabIndicator(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const active = c.querySelector('.dock-tab.active') as HTMLElement | null;
    if (!active) {
      setInd(null);
      return;
    }
    const cr = c.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    setInd({ x: ar.left - cr.left, w: ar.width });
  }, [dep]);
  return { ref, ind };
}

/**
 * 画布右下角浮动工具栏（同一个深色容器内，仅图标 + tooltip）：
 * 左侧是两个“按键”（排序编号 / 重算轨道，较大方块，同款无底色样式），
 * 右侧是两组 tab：工具（选择 / 画框 / 平移）和 编号显示（显示 / 隐藏），
 * 竖线分隔；每组各有一个滑动指示器（物理凸起背景）平滑滑动。
 *
 * 「排序编号」算的是 index（按行从上到下、从左到右）；
 * 「重算轨道」算的是 track_id（按中心 x 重新分列）—— 两者互不相干。
 */
export function ToolDock() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const labelMode = useStore((s) => s.labelMode);
  const setLabelMode = useStore((s) => s.setLabelMode);
  const setSortOpen = useStore((s) => s.setSortOpen);
  const openRecomputeTracks = useStore((s) => s.openRecomputeTracks);
  const hasBoxes = useStore((s) => s.boxes.length > 0);

  const toolsInd = useTabIndicator(mode);
  const labelsInd = useTabIndicator(labelMode);

  const renderIndicator = (ind: { x: number; w: number } | null) =>
    ind ? <span className="dock-tab-ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} /> : null;

  return (
    <div className="tool-dock">
      <div className="dock-actions">
        <TipButton
          tip="排序编号：按行从上到下、从左到右，写入编号"
          className="dock-action"
          aria-label="排序编号"
          onClick={() => setSortOpen(true)}
        >
          <ListOrdered size={17} strokeWidth={2} />
        </TipButton>
        <TipButton
          tip="重算轨道：按方框中心 x 重新分列，从左到右重写轨道号"
          className="dock-action"
          aria-label="重算轨道"
          onClick={openRecomputeTracks}
          disabled={!hasBoxes}
        >
          <Columns3 size={16} strokeWidth={2} />
        </TipButton>
      </div>

      <div className="dock-tabs">
        {/* 工具组 */}
        <div className="dock-tab-group" ref={toolsInd.ref}>
          {renderIndicator(toolsInd.ind)}
          {TOOLS.map((t) => (
            <TipButton
              key={t.key}
              role="tab"
              aria-selected={mode === t.key}
              aria-label={t.tip}
              tip={t.tip}
              className={`dock-tab${mode === t.key ? ' active' : ''}`}
              onClick={() => setMode(t.key)}
            >
              <t.Icon size={16} strokeWidth={1.8} />
            </TipButton>
          ))}
        </div>

        <span className="dock-sep" />

        {/* 编号显示组 */}
        <div className="dock-tab-group" ref={labelsInd.ref}>
          {renderIndicator(labelsInd.ind)}
          {LABEL_TABS.map((t) => (
            <TipButton
              key={t.key}
              role="tab"
              aria-selected={labelMode === t.key}
              aria-label={t.tip}
              tip={t.tip}
              className={`dock-tab${labelMode === t.key ? ' active' : ''}`}
              onClick={() => setLabelMode(t.key)}
            >
              <t.Icon size={16} strokeWidth={1.8} />
            </TipButton>
          ))}
        </div>
      </div>
    </div>
  );
}
