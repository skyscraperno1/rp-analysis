import { create } from 'zustand';
import type { Box, LabelMode, PredJson, ToolMode } from '../types';
import { computeSort, type SortOptions } from '../lib/sorting';
import { buildExport, downloadJson, fileTimestamp, toBoxes } from '../lib/jsonio';
import { clamp } from '../lib/geometry';

let idc = 0;
const uid = () => `b${Date.now().toString(36)}${(idc++).toString(36)}`;

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 4;
/** 聚焦（点击列表行）时的最大缩放：不再放到 150%，120% 足够编辑 */
export const FOCUS_MAX_SCALE = 1.2;
/** 聚焦时选中框约占视口的比例（宽/高各自不超过此比例） */
export const FOCUS_VIEWPORT_RATIO = 0.25;
const HISTORY_LIMIT = 60;

export interface ImageInfo {
  src: string;
  width: number;
  height: number;
  name: string;
}

export interface ViewState {
  scale: number;
  x: number;
  y: number;
}

interface Meta {
  image?: string;
  image_width?: number;
  image_height?: number;
  params?: Record<string, unknown>;
}

interface StoreState {
  image: ImageInfo | null;
  imageEl: HTMLImageElement | null;
  meta: Meta | null;
  boxes: Box[];
  mode: ToolMode;
  labelMode: LabelMode;
  selected: string[];
  view: ViewState;
  vp: { width: number; height: number };
  loading: boolean;
  error: string | null;
  notice: string | null;
  sortOpen: boolean;
  past: Box[][];
  future: Box[][];

  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setNotice: (v: string | null) => void;
  loadPrediction: (json: PredJson) => void;
  setImage: (info: ImageInfo, el: HTMLImageElement) => void;
  setViewport: (w: number, h: number) => void;
  setMode: (m: ToolMode) => void;
  setLabelMode: (m: LabelMode) => void;
  setSortOpen: (v: boolean) => void;

  select: (ids: string[], additive?: boolean) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;

  setView: (v: ViewState) => void;
  zoomAt: (factor: number, cx: number, cy: number) => void;
  /** 缩放到指定比例（0.02 ~ 4），以视口中心为锚点 */
  zoomToScale: (scale: number) => void;
  fitWidth: () => void;
  zoomTo100: () => void;
  focusBox: (id: string) => void;

  addBox: (bbox: [number, number, number, number]) => string;
  updateBox: (id: string, bbox: [number, number, number, number]) => void;
  updateBoxes: (updates: Map<string, [number, number, number, number]>) => void;
  updateBoxLive: (id: string, bbox: [number, number, number, number]) => void;
  moveSelected: (dx: number, dy: number) => void;
  deleteSelected: () => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  applySort: (opts: SortOptions, offsets?: number[]) => void;
  clearIndex: () => void;
  exportJson: () => void;
}

function clampView(v: ViewState, vp: { width: number; height: number }, img: ImageInfo | null): ViewState {
  if (!img || vp.width < 10 || vp.height < 10) return v;
  const iw = img.width * v.scale;
  const ih = img.height * v.scale;
  let { x, y } = v;
  if (iw <= vp.width) x = (vp.width - iw) / 2;
  else x = clamp(x, vp.width - iw, 0);
  if (ih <= vp.height) y = (vp.height - ih) / 2;
  else y = clamp(y, vp.height - ih, 0);
  return { scale: v.scale, x, y };
}

export const useStore = create<StoreState>((setState, getState) => ({
  image: null,
  imageEl: null,
  meta: null,
  boxes: [],
  mode: 'select',
  labelMode: 'on',
  selected: [],
  view: { scale: 0.5, x: 0, y: 0 },
  vp: { width: 0, height: 0 },
  loading: true,
  error: null,
  notice: null,
  sortOpen: false,
  past: [],
  future: [],

  setLoading: (v) => setState({ loading: v }),
  setError: (v) => setState({ error: v }),
  setNotice: (v) => setState({ notice: v }),

  loadPrediction: (json) =>
    setState({
      meta: {
        image: json.image,
        image_width: json.image_width,
        image_height: json.image_height,
        params: json.params,
      },
      boxes: toBoxes(json.detections),
      selected: [],
      past: [],
      future: [],
    }),

  setImage: (info, el) =>
    setState((s) => ({
      image: info,
      imageEl: el,
      // 图片尺寸与 JSON 声明不一致时给出提示
      notice:
        s.meta?.image_width && s.meta.image_width !== info.width
          ? `注意：JSON 声明宽度 ${s.meta.image_width}，实际图片宽度 ${info.width}`
          : s.notice,
    })),

  setViewport: (w, h) => setState({ vp: { width: w, height: h } }),
  setMode: (m) => setState({ mode: m }),
  setLabelMode: (m) => setState({ labelMode: m }),
  setSortOpen: (v) => setState({ sortOpen: v }),

  select: (ids, additive) =>
    setState((s) => ({
      selected: additive ? Array.from(new Set([...s.selected, ...ids])) : ids,
    })),
  toggleSelect: (id) =>
    setState((s) => ({
      selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
    })),
  selectAll: () => setState((s) => ({ selected: s.boxes.map((b) => b.id) })),

  setView: (v) => setState((s) => ({ view: clampView(v, s.vp, s.image) })),

  zoomAt: (factor, cx, cy) =>
    setState((s) => {
      const scale = clamp(s.view.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = scale / s.view.scale;
      const v = { scale, x: cx - (cx - s.view.x) * k, y: cy - (cy - s.view.y) * k };
      return { view: clampView(v, s.vp, s.image) };
    }),

  fitWidth: () =>
    setState((s) => {
      if (!s.image || s.vp.width < 10) return {};
      const scale = (s.vp.width - 24) / s.image.width;
      // 保持当前视口中心对应的图像位置
      const centerImgY = (s.vp.height / 2 - s.view.y) / s.view.scale;
      const v = { scale, x: (s.vp.width - s.image.width * scale) / 2, y: s.vp.height / 2 - centerImgY * scale };
      return { view: clampView(v, s.vp, s.image) };
    }),

  zoomToScale: (scale) =>
    setState((s) => {
      const sc = clamp(scale, MIN_SCALE, MAX_SCALE);
      const cx = s.vp.width / 2;
      const cy = s.vp.height / 2;
      const k = sc / s.view.scale;
      const v = { scale: sc, x: cx - (cx - s.view.x) * k, y: cy - (cy - s.view.y) * k };
      return { view: clampView(v, s.vp, s.image) };
    }),

  zoomTo100: () => getState().zoomToScale(1),

  focusBox: (id) =>
    setState((s) => {
      const b = s.boxes.find((x) => x.id === id);
      if (!b || !s.image) return {};
      const bw = Math.max(4, b.bbox[2] - b.bbox[0]);
      const bh = Math.max(4, b.bbox[3] - b.bbox[1]);
      // 聚焦缩放：让选中框约占视口的 FOCUS_VIEWPORT_RATIO，且最大只放到 FOCUS_MAX_SCALE
      // （大屏上 0.35 的比例总是被 cap 顶满，故 cap 与比例都不宜过大）
      const want = Math.min(
        FOCUS_MAX_SCALE,
        (s.vp.width * FOCUS_VIEWPORT_RATIO) / bw,
        (s.vp.height * FOCUS_VIEWPORT_RATIO) / bh,
      );
      const scale = clamp(Math.max(s.view.scale, want), MIN_SCALE, MAX_SCALE);
      const cx = (b.bbox[0] + b.bbox[2]) / 2;
      const cy = (b.bbox[1] + b.bbox[3]) / 2;
      const v = { scale, x: s.vp.width / 2 - cx * scale, y: s.vp.height / 2 - cy * scale };
      return { view: clampView(v, s.vp, s.image), selected: [id] };
    }),

  addBox: (bbox) => {
    const id = uid();
    setState((s) => ({
      past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
      future: [],
      boxes: [
        ...s.boxes,
        { id, bbox, score: 1, class_id: 0, class_name: 'item', index: null, manual: true },
      ],
      selected: [id],
      notice: '已新增 1 个方框',
    }));
    return id;
  },

  updateBox: (id, bbox) =>
    setState((s) => ({
      past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
      future: [],
      boxes: s.boxes.map((b) => (b.id === id ? { ...b, bbox } : b)),
    })),

  updateBoxes: (updates) =>
    setState((s) => ({
      past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
      future: [],
      boxes: s.boxes.map((b) => (updates.has(b.id) ? { ...b, bbox: updates.get(b.id)! } : b)),
    })),

  updateBoxLive: (id, bbox) =>
    setState((s) => ({ boxes: s.boxes.map((b) => (b.id === id ? { ...b, bbox } : b)) })),

  moveSelected: (dx, dy) =>
    setState((s) => {
      const sel = new Set(s.selected);
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: [],
        boxes: s.boxes.map((b) =>
          sel.has(b.id)
            ? { ...b, bbox: [b.bbox[0] + dx, b.bbox[1] + dy, b.bbox[2] + dx, b.bbox[3] + dy] as [number, number, number, number] }
            : b,
        ),
      };
    }),

  deleteSelected: () =>
    setState((s) => {
      if (s.selected.length === 0) return {};
      const sel = new Set(s.selected);
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: [],
        boxes: s.boxes.filter((b) => !sel.has(b.id)),
        selected: [],
        notice: `已删除 ${sel.size} 个方框`,
      };
    }),

  pushHistory: () =>
    setState((s) => ({ past: [...s.past, s.boxes].slice(-HISTORY_LIMIT), future: [] })),

  undo: () =>
    setState((s) => {
      if (s.past.length === 0) return {};
      const prev = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        future: [s.boxes, ...s.future].slice(0, HISTORY_LIMIT),
        boxes: prev,
        selected: s.selected.filter((id) => prev.some((b) => b.id === id)),
      };
    }),

  redo: () =>
    setState((s) => {
      if (s.future.length === 0) return {};
      const next = s.future[0];
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        boxes: next,
        selected: s.selected.filter((id) => next.some((b) => b.id === id)),
      };
    }),

  applySort: (opts, offsets) =>
    setState((s) => {
      const res = computeSort(s.boxes, opts, offsets);
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: [],
        boxes: s.boxes.map((b) => ({ ...b, index: res.order.get(b.id) ?? null })),
        sortOpen: false,
        notice: `编号完成：${res.rowCount} 行 / ${s.boxes.length} 个点位`,
      };
    }),

  clearIndex: () =>
    setState((s) => ({
      past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
      future: [],
      boxes: s.boxes.map((b) => ({ ...b, index: null })),
      notice: '已清除全部编号',
    })),

  exportJson: () =>
    setState((s) => {
      const out = buildExport(s.boxes, s.meta ?? {}, s.image?.name ?? '');
      const filename = `annotations_annotated_${fileTimestamp()}.json`;
      downloadJson(out, filename);
      return { notice: `已导出 ${filename}` };
    }),
}));
