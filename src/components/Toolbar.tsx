import { useEffect, useRef, useState } from 'react';
import {
  Download,
  ImageUp,
  MoveHorizontal,
  Redo2,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { loadImageFile, loadJsonFile } from '../lib/loaders';
import { TipButton } from './Tooltip';

/** 缩放输入框：显示当前缩放，可直接输入百分比，回车 / 失焦生效 */
function ZoomInput() {
  const view = useStore((s) => s.view);
  const zoomToScale = useStore((s) => s.zoomToScale);
  const [txt, setTxt] = useState(() => `${Math.round(view.scale * 100)}%`);

  // 外部缩放（滚轮 / 按钮 / 适应宽度）时同步显示
  useEffect(() => {
    setTxt(`${Math.round(view.scale * 100)}%`);
  }, [view.scale]);

  const current = () => `${Math.round(view.scale * 100)}%`;

  const commit = () => {
    const v = Number(txt.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(v) && v > 0) zoomToScale(v / 100);
    setTxt(current());
  };

  return (
    <input
      className="zoom-input"
      value={txt}
      title="当前缩放，可输入百分比后回车（2% ~ 400%）"
      onChange={(e) => setTxt(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setTxt(current());
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** 顶部工具栏：纯图标按钮 + tooltip（悬停 250ms 显示在下方） */
export function Toolbar() {
  const boxes = useStore((s) => s.boxes);
  const image = useStore((s) => s.image);
  const selected = useStore((s) => s.selected);
  const vp = useStore((s) => s.vp);
  const past = useStore((s) => s.past);
  const future = useStore((s) => s.future);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const zoomAt = useStore((s) => s.zoomAt);
  const fitWidth = useStore((s) => s.fitWidth);
  const exportJson = useStore((s) => s.exportJson);

  const imgInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const zoom = (factor: number) => zoomAt(factor, vp.width / 2, vp.height / 2);

  /* 当前还缺哪一步：没图 → 提示打开图片；有图没数据 → 提示导入 JSON。
     对应按钮会呼吸式高亮，用户不用去猜左上角该点哪个 */
  const needImage = !image;
  const needData = !!image && boxes.length === 0;

  return (
    <div className="toolbar">
      <span className="brand">辊面铸钉编辑器</span>

      <div className="group">
        <TipButton
          tip="打开图片"
          dir="bottom"
          className={`btn${needImage ? ' attention' : ''}`}
          onClick={() => imgInput.current?.click()}
        >
          <ImageUp size={16} strokeWidth={1.8} />
        </TipButton>
        <TipButton
          tip="导入 JSON"
          dir="bottom"
          className={`btn${needData ? ' attention' : ''}`}
          onClick={() => jsonInput.current?.click()}
        >
          <Upload size={16} strokeWidth={1.8} />
        </TipButton>
        <TipButton tip="导出 JSON（保留原始字段，按编号排序，文件名带时间戳）" dir="bottom" className="btn primary" onClick={exportJson}>
          <Download size={16} strokeWidth={1.8} />
        </TipButton>
        <input
          id="img-input"
          ref={imgInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadImageFile(f);
            e.target.value = '';
          }}
        />
        <input
          id="json-input"
          ref={jsonInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadJsonFile(f).catch((err) => useStore.getState().setError(String(err)));
            e.target.value = '';
          }}
        />
      </div>

      <div className="group">
        <TipButton tip="缩小" dir="bottom" className="btn" onClick={() => zoom(1 / 1.25)}>
          <ZoomOut size={16} strokeWidth={1.8} />
        </TipButton>
        <ZoomInput />
        <TipButton tip="放大" dir="bottom" className="btn" onClick={() => zoom(1.25)}>
          <ZoomIn size={16} strokeWidth={1.8} />
        </TipButton>
        <TipButton tip="适应宽度 (F)" dir="bottom" className="btn" onClick={fitWidth}>
          <MoveHorizontal size={16} strokeWidth={1.8} />
        </TipButton>
      </div>

      <div className="group">
        <TipButton tip="撤销 (Ctrl+Z)" dir="bottom" className="btn" disabled={!past.length} onClick={undo}>
          <Undo2 size={16} strokeWidth={1.8} />
        </TipButton>
        <TipButton tip="重做 (Ctrl+Shift+Z)" dir="bottom" className="btn" disabled={!future.length} onClick={redo}>
          <Redo2 size={16} strokeWidth={1.8} />
        </TipButton>
      </div>

      <div className="spacer" />
      <span className="stat">
        {boxes.length} 个点位 · 选中 {selected.length}
      </span>
    </div>
  );
}
