import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import type { Box } from "../types";
import { trackColor } from "../lib/colors";

/** Figma 风格的轴输入框：X/Y 前缀内嵌，整体是一个控件 */
function AxisInput({
  axis,
  tip,
  value,
  onCommit
}: {
  axis: "X" | "Y";
  tip: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  const [txt, setTxt] = useState(() => String(Math.round(value * 10) / 10));
  useEffect(() => {
    setTxt(String(Math.round(value * 10) / 10));
  }, [value]);
  const commit = () => {
    const v = Number(txt);
    if (Number.isFinite(v) && txt.trim() !== "") onCommit(v);
    else setTxt(String(Math.round(value * 10) / 10));
  };
  return (
    <label className="axis-input" title={tip}>
      <span className="axis">{axis}</span>
      <input
        value={txt}
        onChange={e => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") commit();
        }}
      />
    </label>
  );
}

/** 轨道号输入框：与 X/Y 轴输入同款（全宽、前缀内嵌），
 *  前面的色块就是该轨道在画布上的颜色，改号即变色 */
function TrackInput({
  value,
  onCommit
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  const [txt, setTxt] = useState(() => String(value));
  useEffect(() => {
    setTxt(String(value));
  }, [value]);
  const commit = () => {
    const v = Number(txt);
    if (Number.isFinite(v) && txt.trim() !== "" && v >= 0)
      onCommit(Math.floor(v));
    else setTxt(String(value));
  };
  return (
    <label
      className="axis-input track-input"
      title="轨道号（竖排的列号），回车生效"
    >
      <i className="swatch" style={{ background: trackColor(value) }} />
      <input
        value={txt}
        onChange={e => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") commit();
        }}
      />
    </label>
  );
}

function BoxProps({ box }: { box: Box }) {
  const updateBox = useStore(s => s.updateBox);
  const setTrackId = useStore(s => s.setTrackId);
  const focusBox = useStore(s => s.focusBox);
  const deleteSelected = useStore(s => s.deleteSelected);

  const setCorner = (i: 0 | 1 | 2 | 3, v: number) => {
    const bb: [number, number, number, number] = [
      box.bbox[0],
      box.bbox[1],
      box.bbox[2],
      box.bbox[3]
    ];
    bb[i] = v;
    if (bb[2] - bb[0] < 4) {
      if (i === 0) bb[0] = bb[2] - 4;
      else bb[2] = bb[0] + 4;
    }
    if (bb[3] - bb[1] < 4) {
      if (i === 1) bb[1] = bb[3] - 4;
      else bb[3] = bb[1] + 4;
    }
    updateBox(box.id, bb);
  };

  const cx = (box.bbox[0] + box.bbox[2]) / 2;
  const cy = (box.bbox[1] + box.bbox[3]) / 2;

  return (
    <div className="props">
      <div className="section-label">左上角</div>
      <div className="axis-row">
        <AxisInput
          axis="X"
          tip="左上角 X"
          value={box.bbox[0]}
          onCommit={v => setCorner(0, v)}
        />
        <AxisInput
          axis="Y"
          tip="左上角 Y"
          value={box.bbox[1]}
          onCommit={v => setCorner(1, v)}
        />
      </div>
      <div className="section-label">右下角</div>
      <div className="axis-row">
        <AxisInput
          axis="X"
          tip="右下角 X"
          value={box.bbox[2]}
          onCommit={v => setCorner(2, v)}
        />
        <AxisInput
          axis="Y"
          tip="右下角 Y"
          value={box.bbox[3]}
          onCommit={v => setCorner(3, v)}
        />
      </div>

      <div className="section-label">轨道</div>
      <TrackInput value={box.track_id} onCommit={v => setTrackId(box.id, v)} />

      <div className="kv">
        <span>宽 × 高</span>
        <span>
          {(box.bbox[2] - box.bbox[0]).toFixed(1)} ×{" "}
          {(box.bbox[3] - box.bbox[1]).toFixed(1)}
        </span>
      </div>
      <div className="kv">
        <span>中心点</span>
        <span>
          {cx.toFixed(1)}, {cy.toFixed(1)}
        </span>
      </div>
      {box.score != null && (
        <div className="kv">
          <span>置信度</span>
          <span>{box.score.toFixed(3)}</span>
        </div>
      )}
      {box.studId != null && (
        <div className="kv">
          <span>ID</span>
          <span>#{box.studId}</span>
        </div>
      )}
      <div className="props-actions">
        <button className="btn" onClick={() => focusBox(box.id)}>
          跳到视图
        </button>
        <button className="btn danger" onClick={deleteSelected}>
          删除
        </button>
      </div>
      <div className="hint">方向键微移 1px（Shift 10px）</div>
      <div className="hint">轨道号 = 竖排的列号，改号会同时改变方框颜色</div>
    </div>
  );
}

export function PropertiesPanel() {
  const boxes = useStore(s => s.boxes);
  const selected = useStore(s => s.selected);
  const select = useStore(s => s.select);
  const setSelectedTrackId = useStore(s => s.setSelectedTrackId);
  const deleteSelected = useStore(s => s.deleteSelected);
  const selBoxes = boxes.filter(b => selected.includes(b.id));

  return (
    <div className="panel props-panel">
      <div className="panel-head">
        <span className="title">属性</span>
        {selBoxes.length > 0 && (
          <span className="count">{selBoxes.length}</span>
        )}
      </div>
      {selBoxes.length === 1 && <BoxProps box={selBoxes[0]} />}
      {selBoxes.length > 1 && (
        <div className="props">
          <div className="kv">
            <span>已选中</span>
            <span>{selBoxes.length} 个方框</span>
          </div>
          <div className="section-label">统一为轨道</div>
          <TrackInput
            value={selBoxes[0].track_id}
            onCommit={setSelectedTrackId}
          />
          <div className="hint">可整体拖动；改大小请单选</div>
          <div className="props-actions">
            <button className="btn" onClick={() => select([])}>
              取消选择
            </button>
            <button className="btn danger" onClick={deleteSelected}>
              删除
            </button>
          </div>
        </div>
      )}
      {selBoxes.length === 0 && (
        <div className="props empty">
          <div>未选中点位</div>
          <div className="hint">点击画布中的方框进行查看和编辑</div>
          <div className="hint">左键拖框空白处 = 框选</div>
          <div className="hint">D = 画新框 · Del = 删除</div>
          <div className="hint">列表：单击定位 · Shift 范围选 · Ctrl 多选</div>
        </div>
      )}
    </div>
  );
}
