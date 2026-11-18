import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import { useStore } from '../store/useStore';
import { intersects, normalizeRect } from '../lib/geometry';
import { BOX_COLORS } from '../lib/colors';
import { loadImageFile, loadJsonFile } from '../lib/loaders';
import { Minimap } from './Minimap';
import { StatusBar } from './StatusBar';
import { ToolDock } from './ToolDock';

type Rect4 = { x0: number; y0: number; x1: number; y1: number };

type Gesture =
  | { type: 'pan'; sx: number; sy: number; ox: number; oy: number }
  | { type: 'band'; x0: number; y0: number }
  | { type: 'draw'; x0: number; y0: number };

export function AnnotationStage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Rect>());

  const gesture = useRef<Gesture | null>(null);
  const bandRef = useRef<Rect4 | null>(null);
  const draftRef = useRef<Rect4 | null>(null);
  const multiDrag = useRef<{ startX: number; startY: number; orig: Map<string, [number, number]> } | null>(null);

  const image = useStore((s) => s.image);
  const imageEl = useStore((s) => s.imageEl);
  const boxes = useStore((s) => s.boxes);
  const selected = useStore((s) => s.selected);
  const mode = useStore((s) => s.mode);
  const labelMode = useStore((s) => s.labelMode);
  const view = useStore((s) => s.view);
  const vp = useStore((s) => s.vp);
  const loading = useStore((s) => s.loading);

  const [size, setSize] = useState({ width: 100, height: 100 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [band, setBand] = useState<Rect4 | null>(null);
  const [draft, setDraft] = useState<Rect4 | null>(null);
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  /* ---------- 视口测量 ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(50, Math.round(r.width));
      const h = Math.max(50, Math.round(r.height));
      setSize({ width: w, height: h });
      useStore.getState().setViewport(w, h);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  /* ---------- 首次加载后适应宽度 ---------- */
  const didFit = useRef(false);
  useEffect(() => {
    if (!image) {
      didFit.current = false;
      return;
    }
    if (vp.width > 100 && !didFit.current) {
      didFit.current = true;
      useStore.getState().fitWidth();
    }
  }, [image, vp.width]);

  /* ---------- 视口裁剪：只渲染可见的框 ---------- */
  const visible = useMemo(() => {
    if (!image) return [];
    const pad = 150 / view.scale;
    const x0 = -view.x / view.scale - pad;
    const y0 = -view.y / view.scale - pad;
    const x1 = (vp.width - view.x) / view.scale + pad;
    const y1 = (vp.height - view.y) / view.scale + pad;
    const sel = new Set(selected);
    return boxes.filter(
      (b) => sel.has(b.id) || !(b.bbox[2] < x0 || b.bbox[0] > x1 || b.bbox[3] < y0 || b.bbox[1] > y1),
    );
  }, [boxes, view, vp, image, selected]);

  /* ---------- 滚轮：平移 / Ctrl+滚轮 缩放 ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const st = useStore.getState();
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.container().getBoundingClientRect();
      const cx = ev.clientX - r.left;
      const cy = ev.clientY - r.top;
      if (ev.ctrlKey || ev.metaKey) {
        st.zoomAt(Math.exp(-ev.deltaY * 0.0015), cx, cy);
      } else {
        st.setView({ ...st.view, x: st.view.x - (ev.deltaX || 0), y: st.view.y - ev.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* ---------- 空格临时平移 ---------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  /* ---------- 全局手势：平移 / 框选 / 绘制 ---------- */
  useEffect(() => {
    const toImg = (sx: number, sy: number) => {
      const v = useStore.getState().view;
      return { x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale };
    };
    const stagePos = (ev: MouseEvent) => {
      const stage = stageRef.current;
      if (!stage) return null;
      const r = stage.container().getBoundingClientRect();
      return { sx: ev.clientX - r.left, sy: ev.clientY - r.top };
    };
    const onMove = (ev: MouseEvent) => {
      const g = gesture.current;
      if (!g) return;
      const p = stagePos(ev);
      if (!p) return;
      const st = useStore.getState();
      if (g.type === 'pan') {
        st.setView({ ...st.view, x: g.ox + (p.sx - g.sx), y: g.oy + (p.sy - g.sy) });
      } else {
        const q = toImg(p.sx, p.sy);
        const next = { x0: g.x0, y0: g.y0, x1: q.x, y1: q.y };
        if (g.type === 'band') {
          bandRef.current = next;
          setBand(next);
        } else {
          draftRef.current = next;
          setDraft(next);
        }
      }
    };
    const onUp = (ev: MouseEvent) => {
      const g = gesture.current;
      gesture.current = null;
      setPanning(false);
      if (!g) return;
      const st = useStore.getState();
      if (g.type === 'band') {
        const b = bandRef.current;
        bandRef.current = null;
        setBand(null);
        if (!b) return;
        const rect = normalizeRect(b.x0, b.y0, b.x1, b.y1);
        if (rect[2] - rect[0] < 3 && rect[3] - rect[1] < 3) {
          if (!ev.shiftKey) st.select([]);
          return;
        }
        const hit = st.boxes
          .filter((bx) =>
            intersects(bx.bbox, { x: rect[0], y: rect[1], w: rect[2] - rect[0], h: rect[3] - rect[1] }),
          )
          .map((bx) => bx.id);
        st.select(hit, ev.shiftKey);
      } else if (g.type === 'draw') {
        const d = draftRef.current;
        draftRef.current = null;
        setDraft(null);
        if (!d) return;
        const rect = normalizeRect(d.x0, d.y0, d.x1, d.y1);
        if (rect[2] - rect[0] >= 4 && rect[3] - rect[1] >= 4) st.addBox(rect);
        st.setMode('select');
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  /* ---------- Transformer 绑定 ---------- */
  // 选中框在屏幕上的尺寸太小（手柄排不下）时隐藏手柄，
  // 此时仍可拖动方框，或用右侧属性面板的 X/Y 数值精修
  const selBox = selected.length === 1 ? boxes.find((b) => b.id === selected[0]) ?? null : null;
  const showHandles =
    selBox != null &&
    mode === 'select' &&
    Math.min(selBox.bbox[2] - selBox.bbox[0], selBox.bbox[3] - selBox.bbox[1]) * view.scale >= 24;

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (showHandles) {
      const n = nodeRefs.current.get(selected[0]);
      tr.nodes(n ? [n] : []);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selected, visible, mode, view, showHandles]);

  const setNodeRef = useCallback(
    (id: string) => (node: Konva.Rect | null) => {
      if (node) nodeRefs.current.set(id, node);
      else nodeRefs.current.delete(id);
    },
    [],
  );

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const st = useStore.getState();
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const v = st.view;
    const p = { x: (pos.x - v.x) / v.scale, y: (pos.y - v.y) / v.scale };
    const isEmpty = e.target === stage || e.target instanceof Konva.Layer;

    if (st.mode === 'pan' || spaceDown || e.evt.button === 1) {
      gesture.current = { type: 'pan', sx: pos.x, sy: pos.y, ox: v.x, oy: v.y };
      setPanning(true);
      e.evt.preventDefault();
      return;
    }
    if (st.mode === 'draw' && isEmpty && e.evt.button === 0) {
      gesture.current = { type: 'draw', x0: p.x, y0: p.y };
      const init = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      draftRef.current = init;
      setDraft(init);
      return;
    }
    if (st.mode === 'select' && isEmpty && e.evt.button === 0) {
      gesture.current = { type: 'band', x0: p.x, y0: p.y };
      const init = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      bandRef.current = init;
      setBand(init);
    }
  };

  const onStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const v = useStore.getState().view;
    setCursor({ x: (pos.x - v.x) / v.scale, y: (pos.y - v.y) / v.scale });
  };

  // 光标：悬停未选中的框 = pointer（可点击）；悬停已选中的框 = move 十字箭头（可拖动）
  const hoverIsSelected = hoverId != null && selected.includes(hoverId);
  const cursorStyle = panning
    ? 'grabbing'
    : spaceDown || mode === 'pan'
      ? 'grab'
      : mode === 'draw'
        ? 'crosshair'
        : mode === 'select' && hoverIsSelected
          ? 'move'
          : mode === 'select' && hoverId
            ? 'pointer'
            : 'default';

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    const file = ev.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      void loadImageFile(file);
    } else if (file.name.endsWith('.json')) {
      void loadJsonFile(file);
    }
  };

  const strokeW = 1.5 / view.scale;

  return (
    <div className="canvas-wrap">
      <div
        className="canvas-stage"
        ref={wrapRef}
        style={{ cursor: cursorStyle }}
        onDrop={onDrop}
        onDragOver={(ev) => ev.preventDefault()}
      >
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          onMouseDown={onStageMouseDown}
          onMouseMove={onStageMouseMove}
        >
        <Layer listening={false}>
          {imageEl && image && (
            <KonvaImage image={imageEl} width={image.width} height={image.height} listening={false} />
          )}
        </Layer>
        <Layer>
          {visible.map((b) => {
            const isSel = selected.includes(b.id);
            const w = b.bbox[2] - b.bbox[0];
            const h = b.bbox[3] - b.bbox[1];
            return (
              <Rect
                key={b.id}
                id={b.id}
                ref={setNodeRef(b.id)}
                x={b.bbox[0]}
                y={b.bbox[1]}
                width={w}
                height={h}
                fill={
                  isSel
                    ? BOX_COLORS.selected.fill
                    : b.manual
                      ? BOX_COLORS.manual.fill
                      : BOX_COLORS.existing.fill
                }
                stroke={
                  isSel
                    ? BOX_COLORS.selected.stroke
                    : hoverId === b.id
                      ? BOX_COLORS.hover
                      : b.manual
                        ? BOX_COLORS.manual.stroke
                        : BOX_COLORS.existing.stroke
                }
                strokeWidth={isSel ? 2 / view.scale : strokeW}
                hitStrokeWidth={Math.max(2, 10 / view.scale)}
                draggable={mode === 'select'}
                listening={mode === 'select'}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
                onMouseDown={(e) => {
                  const st = useStore.getState();
                  if (st.mode !== 'select') return;
                  if (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey) st.toggleSelect(b.id);
                  else if (!st.selected.includes(b.id)) st.select([b.id]);
                }}
                onDragStart={() => {
                  const st = useStore.getState();
                  st.pushHistory();
                  if (st.selected.length > 1 && st.selected.includes(b.id)) {
                    const orig = new Map<string, [number, number]>();
                    for (const id of st.selected) {
                      const bx = st.boxes.find((x) => x.id === id);
                      if (bx) orig.set(id, [bx.bbox[0], bx.bbox[1]]);
                    }
                    multiDrag.current = { startX: 0, startY: 0, orig };
                  }
                }}
                onDragMove={(e) => {
                  const md = multiDrag.current;
                  const st = useStore.getState();
                  if (md) {
                    const node = e.target as Konva.Rect;
                    const dx = node.x() - (md.orig.get(b.id)?.[0] ?? node.x());
                    const dy = node.y() - (md.orig.get(b.id)?.[1] ?? node.y());
                    for (const [id, [ox, oy]] of md.orig) {
                      if (id === b.id) continue;
                      nodeRefs.current.get(id)?.position({ x: ox + dx, y: oy + dy });
                    }
                  } else {
                    const node = e.target as Konva.Rect;
                    const nx = node.x();
                    const ny = node.y();
                    st.updateBoxLive(b.id, [nx, ny, nx + w, ny + h]);
                  }
                }}
                onDragEnd={(e) => {
                  const md = multiDrag.current;
                  multiDrag.current = null;
                  const st = useStore.getState();
                  if (md) {
                    const node = e.target as Konva.Rect;
                    const dx = node.x() - (md.orig.get(b.id)?.[0] ?? 0);
                    const dy = node.y() - (md.orig.get(b.id)?.[1] ?? 0);
                    const updates = new Map<string, [number, number, number, number]>();
                    for (const [id, [ox, oy]] of md.orig) {
                      const bx = st.boxes.find((x) => x.id === id);
                      if (!bx) continue;
                      updates.set(id, [ox + dx, oy + dy, ox + dx + (bx.bbox[2] - bx.bbox[0]), oy + dy + (bx.bbox[3] - bx.bbox[1])]);
                    }
                    st.updateBoxes(updates);
                  } else {
                    const node = e.target as Konva.Rect;
                    const nx = node.x();
                    const ny = node.y();
                    st.updateBox(b.id, [nx, ny, nx + w, ny + h]);
                  }
                }}
                onMouseEnter={() => setHoverId(b.id)}
                onMouseLeave={() => setHoverId(null)}
              />
            );
          })}

          {/* 编号文字（框内左上角，避免顶部行显示不下） */}
          {labelMode !== 'off' &&
            visible.map((b) => {
              if (b.index == null) return null;
              const h = b.bbox[3] - b.bbox[1];
              const fs = Math.min(12 / view.scale, h * 0.55);
              // 框在屏幕上太小、字号会低于 2.5px 时不画（避免糊成一片）
              if (fs < 2.5) return null;
              const pad = fs * 0.3;
              return (
                <Text
                  key={`t_${b.id}`}
                  x={b.bbox[0] + pad}
                  y={b.bbox[1] + pad}
                  text={String(b.index)}
                  fontSize={fs}
                  fontStyle="bold"
                  fill="#ffd666"
                  stroke="#000000"
                  strokeWidth={Math.max(0.4, fs * 0.16)}
                  fillAfterStrokeEnabled
                  align="left"
                  verticalAlign="top"
                  listening={false}
                  perfectDrawEnabled={false}
                />
              );
            })}

          <Transformer
            ref={trRef}
            rotateEnabled={false}
            keepRatio={false}
            flipEnabled
            anchorSize={6}
            anchorCornerRadius={0}
            anchorStroke="#ffb300"
            anchorStrokeWidth={1}
            anchorFill="#ffffff"
            borderStroke="#ffb300"
            borderDash={[4 / view.scale, 4 / view.scale]}
            ignoreStroke
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 4 || newBox.height < 4 ? oldBox : newBox
            }
            onTransformStart={() => useStore.getState().pushHistory()}
            onTransformEnd={(e) => {
              const n = e.target as Konva.Rect;
              const id = n.id();
              const sx = n.scaleX();
              const sy = n.scaleY();
              const x1 = n.x();
              const y1 = n.y();
              const x2 = x1 + n.width() * sx;
              const y2 = y1 + n.height() * sy;
              const nw = Math.max(4, Math.abs(x2 - x1));
              const nh = Math.max(4, Math.abs(y2 - y1));
              const bx = Math.min(x1, x2);
              const by = Math.min(y1, y2);
              n.setAttrs({ x: bx, y: by, scaleX: 1, scaleY: 1, width: nw, height: nh });
              useStore.getState().updateBox(id, [bx, by, bx + nw, by + nh]);
            }}
          />

          {band && (
            <Rect
              x={Math.min(band.x0, band.x1)}
              y={Math.min(band.y0, band.y1)}
              width={Math.abs(band.x1 - band.x0)}
              height={Math.abs(band.y1 - band.y0)}
              fill="rgba(79,140,255,0.10)"
              stroke="#4f8cff"
              strokeWidth={1 / view.scale}
              dash={[4 / view.scale, 4 / view.scale]}
              listening={false}
            />
          )}
          {draft && (
            <Rect
              x={Math.min(draft.x0, draft.x1)}
              y={Math.min(draft.y0, draft.y1)}
              width={Math.abs(draft.x1 - draft.x0)}
              height={Math.abs(draft.y1 - draft.y0)}
              fill={BOX_COLORS.manual.fill}
              stroke={BOX_COLORS.manual.stroke}
              strokeWidth={1.5 / view.scale}
              dash={[6 / view.scale, 4 / view.scale]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {loading && (
        <div className="overlay">
          <div className="spinner" />
          <div>正在加载图像（2048 × 18611，约 67MB）…</div>
        </div>
      )}
      {!image && !loading && (
        <div className="overlay">
          <div>未加载图片</div>
          <button className="btn primary" onClick={() => document.getElementById('img-input')?.click()}>
            打开图片
          </button>
          <div className="dim">也可以把图片或 JSON 拖到这里</div>
        </div>
      )}
      {image && !loading && boxes.length === 0 && (
        <div className="overlay hint">没有点位数据，可导入 JSON 或按 D 进入画框模式</div>
      )}

        <Minimap />
        <ToolDock />
      </div>
      <StatusBar cursor={cursor} />
    </div>
  );
}
