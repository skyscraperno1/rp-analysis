import { create } from "zustand";
import type { Box, LabelMode, PredJson, RestoreItem, ToolMode } from "../types";
import { computeSort, type SortOptions } from "../lib/sorting";
import { guessTrackId } from "../lib/tracks";
import { recomputeTracks, type RecomputeTracksOptions } from "../lib/tracksort";
import {
  buildExport,
  downloadJson,
  fileTimestamp,
  toBoxes
} from "../lib/jsonio";
import { clamp } from "../lib/geometry";

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
  coordinate_system?: string;
  params?: Record<string, unknown>;
}

interface StoreState {
  image: ImageInfo | null;
  imageEl: HTMLImageElement | null;
  meta: Meta | null;
  boxes: Box[];
  /** 每次导入新数据自增，用于把视图类状态（排序等）重置回默认 */
  dataVersion: number;
  mode: ToolMode;
  labelMode: LabelMode;
  selected: string[];
  /** 轨道筛选：null = 全部。左侧图例和右下角状态栏图例共用 */
  trackFilter: number | null;
  /** 使用说明卡片是否展开：加载图片时置 true（仅当还没有数据），
   *  导入 JSON 时置 false —— 也就是只在"有图没数据"时自动出现 */
  helpOpen: boolean;
  /** 启动时的「开始标注」引导弹窗；加载过图片或数据后关闭 */
  setupPromptOpen: boolean;
  /** 已记住的文件句柄数量（0/1/2）：顶栏「清除缓存」按钮据此显隐 */
  cacheCount: number;
  /** 缓存里记着、启动时正在恢复的文件条目；空数组 = 不在恢复中 */
  restoreItems: RestoreItem[];
  view: ViewState;
  vp: { width: number; height: number };
  loading: boolean;
  /** 正在加载的文件名：加载过程中显示，让人知道当前在开哪个文件 */
  loadingName: string | null;
  error: string | null;
  notice: string | null;
  sortOpen: boolean;
  /** 「重算轨道」确认弹窗是否打开 */
  recomputeOpen: boolean;
  past: Box[][];
  future: Box[][];

  setLoading: (v: boolean, name?: string) => void;
  setError: (v: string | null) => void;
  setNotice: (v: string | null) => void;
  loadPrediction: (json: PredJson) => void;
  setImage: (info: ImageInfo, el: HTMLImageElement) => void;
  setViewport: (w: number, h: number) => void;
  setMode: (m: ToolMode) => void;
  setLabelMode: (m: LabelMode) => void;
  setSortOpen: (v: boolean) => void;
  setRecomputeOpen: (v: boolean) => void;
  setTrackFilter: (v: number | null) => void;
  setHelpOpen: (v: boolean) => void;
  setSetupPromptOpen: (v: boolean) => void;
  setCacheCount: (n: number) => void;
  setRestoreItems: (v: RestoreItem[]) => void;

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
  /** 修改一个点位的轨道号（画布颜色与右侧面板同步） */
  setTrackId: (id: string, trackId: number) => void;
  /** 批量修改选中点位的轨道号 */
  setSelectedTrackId: (trackId: number) => void;
  moveSelected: (dx: number, dy: number) => void;
  deleteSelected: () => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  applySort: (opts: SortOptions, offsets?: number[]) => void;
  /** 按几何（中心 x）重算所有点位的 track_id：先开确认弹窗预览，用户确认后才真正改写 */
  openRecomputeTracks: () => void;
  /** 确认重算：真正改写 track_id，进历史栈可 Ctrl+Z */
  applyRecomputeTracks: (
    opts: RecomputeTracksOptions,
    offsets?: number[]
  ) => void;
  exportJson: () => void;
}

function clampView(
  v: ViewState,
  vp: { width: number; height: number },
  img: ImageInfo | null
): ViewState {
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
  dataVersion: 0,
  mode: "select",
  labelMode: "on",
  selected: [],
  trackFilter: null,
  helpOpen: false,
  setupPromptOpen: true,
  cacheCount: 0,
  restoreItems: [],
  view: { scale: 0.5, x: 0, y: 0 },
  vp: { width: 0, height: 0 },
  loading: false,
  loadingName: null,
  error: null,
  notice: null,
  sortOpen: false,
  recomputeOpen: false,
  past: [],
  future: [],

  setLoading: (v, name) =>
    setState({ loading: v, loadingName: v ? (name ?? null) : null }),
  setError: v => setState({ error: v }),
  setNotice: v => setState({ notice: v }),

  loadPrediction: json =>
    setState(s => ({
      meta: {
        image: json.image,
        image_width: json.image_width,
        image_height: json.image_height,
        coordinate_system: json.coordinate_system,
        params: json.params
      },
      boxes: toBoxes(json.studs),
      selected: [],
      trackFilter: null,
      past: [],
      future: [],
      dataVersion: s.dataVersion + 1,
      // 数据一到就收起说明：只在这之前（有图没数据）自动显示
      helpOpen: false,
      setupPromptOpen: false
    })),

  setImage: (info, el) =>
    setState(s => ({
      image: info,
      imageEl: el,
      // 图片加载完弹出使用说明；但如果数据已经在（先导 JSON 再导图），就不弹
      helpOpen: s.boxes.length === 0,
      // 数据还没导入就留着引导弹窗，让用户接着走第二步（选 JSON）；
      // 数据已经在了才说明它的使命完成了
      setupPromptOpen: s.boxes.length === 0 ? s.setupPromptOpen : false,
      // 图片尺寸与 JSON 声明不一致时给出提示
      notice:
        s.meta?.image_width && s.meta.image_width !== info.width
          ? `注意：JSON 声明宽度 ${s.meta.image_width}，实际图片宽度 ${info.width}`
          : s.notice
    })),

  setViewport: (w, h) => setState({ vp: { width: w, height: h } }),
  setMode: m => setState({ mode: m }),
  setLabelMode: m => setState({ labelMode: m }),
  setSortOpen: v => setState({ sortOpen: v }),
  setRecomputeOpen: v => setState({ recomputeOpen: v }),
  setTrackFilter: v => setState({ trackFilter: v }),
  setHelpOpen: v => setState({ helpOpen: v }),
  setSetupPromptOpen: v => setState({ setupPromptOpen: v }),
  setCacheCount: n => setState({ cacheCount: n }),
  setRestoreItems: v => setState({ restoreItems: v }),

  select: (ids, additive) =>
    setState(s => ({
      selected: additive ? Array.from(new Set([...s.selected, ...ids])) : ids
    })),
  toggleSelect: id =>
    setState(s => ({
      selected: s.selected.includes(id)
        ? s.selected.filter(x => x !== id)
        : [...s.selected, id]
    })),
  /** 全选：只选当前列表可见的点位（受轨道筛选影响），不是把所有点都选上 */
  selectAll: () =>
    setState(s => ({
      selected: s.boxes
        .filter(b => s.trackFilter == null || b.track_id === s.trackFilter)
        .map(b => b.id)
    })),

  setView: v => setState(s => ({ view: clampView(v, s.vp, s.image) })),

  zoomAt: (factor, cx, cy) =>
    setState(s => {
      const scale = clamp(s.view.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = scale / s.view.scale;
      const v = {
        scale,
        x: cx - (cx - s.view.x) * k,
        y: cy - (cy - s.view.y) * k
      };
      return { view: clampView(v, s.vp, s.image) };
    }),

  fitWidth: () =>
    setState(s => {
      if (!s.image || s.vp.width < 10) return {};
      const scale = (s.vp.width - 24) / s.image.width;
      // 保持当前视口中心对应的图像位置
      const centerImgY = (s.vp.height / 2 - s.view.y) / s.view.scale;
      const v = {
        scale,
        x: (s.vp.width - s.image.width * scale) / 2,
        y: s.vp.height / 2 - centerImgY * scale
      };
      return { view: clampView(v, s.vp, s.image) };
    }),

  zoomToScale: scale =>
    setState(s => {
      const sc = clamp(scale, MIN_SCALE, MAX_SCALE);
      const cx = s.vp.width / 2;
      const cy = s.vp.height / 2;
      const k = sc / s.view.scale;
      const v = {
        scale: sc,
        x: cx - (cx - s.view.x) * k,
        y: cy - (cy - s.view.y) * k
      };
      return { view: clampView(v, s.vp, s.image) };
    }),

  zoomTo100: () => getState().zoomToScale(1),

  focusBox: id =>
    setState(s => {
      const b = s.boxes.find(x => x.id === id);
      if (!b || !s.image) return {};
      const bw = Math.max(4, b.bbox[2] - b.bbox[0]);
      const bh = Math.max(4, b.bbox[3] - b.bbox[1]);
      // 聚焦缩放：让选中框约占视口的 FOCUS_VIEWPORT_RATIO，且最大只放到 FOCUS_MAX_SCALE
      // （大屏上 0.35 的比例总是被 cap 顶满，故 cap 与比例都不宜过大）
      const want = Math.min(
        FOCUS_MAX_SCALE,
        (s.vp.width * FOCUS_VIEWPORT_RATIO) / bw,
        (s.vp.height * FOCUS_VIEWPORT_RATIO) / bh
      );
      const scale = clamp(Math.max(s.view.scale, want), MIN_SCALE, MAX_SCALE);
      const cx = (b.bbox[0] + b.bbox[2]) / 2;
      const cy = (b.bbox[1] + b.bbox[3]) / 2;
      const v = {
        scale,
        x: s.vp.width / 2 - cx * scale,
        y: s.vp.height / 2 - cy * scale
      };
      return { view: clampView(v, s.vp, s.image), selected: [id] };
    }),

  addBox: bbox => {
    const id = uid();
    setState(s => {
      // 按 x 方向猜最近的列；离所有列都远才新开一条轨道
      const trackId = guessTrackId(s.boxes, bbox);
      // 这批数据本来就有 id 才接着往下编号；否则新框也不发号，避免凭空造
      const usesIds = s.boxes.some(b => b.studId != null);
      const studId = usesIds
        ? s.boxes.reduce((m, b) => Math.max(m, b.studId ?? 0), 0) + 1
        : null;
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: [],
        boxes: [
          ...s.boxes,
          { id, bbox, track_id: trackId, studId, hasTrack: true, index: null }
        ],
        selected: [id],
        notice: "已新增 1 个方框"
      };
    });
    return id;
  },

  updateBox: (id, bbox) =>
    setState(s => ({
      past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
      future: [],
      boxes: s.boxes.map(b => (b.id === id ? { ...b, bbox } : b))
    })),

  setTrackId: (id, trackId) =>
    setState(s => {
      const t = Math.max(0, Math.floor(trackId));
      if (!Number.isFinite(t)) return {};
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: [],
        boxes: s.boxes.map(b =>
          b.id === id ? { ...b, track_id: t, hasTrack: true } : b
        )
      };
    }),

  setSelectedTrackId: trackId =>
    setState(s => {
      if (s.selected.length === 0) return {};
      const t = Math.max(0, Math.floor(trackId));
      if (!Number.isFinite(t)) return {};
      const sel = new Set(s.selected);
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: [],
        boxes: s.boxes.map(b =>
          sel.has(b.id) ? { ...b, track_id: t, hasTrack: true } : b
        ),
        notice: `已将 ${sel.size} 个点位设为轨道 ${t}`
      };
    }),

  updateBoxes: updates =>
    setState(s => ({
      past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
      future: [],
      boxes: s.boxes.map(b =>
        updates.has(b.id) ? { ...b, bbox: updates.get(b.id)! } : b
      )
    })),

  updateBoxLive: (id, bbox) =>
    setState(s => ({
      boxes: s.boxes.map(b => (b.id === id ? { ...b, bbox } : b))
    })),

  moveSelected: (dx, dy) =>
    setState(s => {
      const sel = new Set(s.selected);
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: [],
        boxes: s.boxes.map(b =>
          sel.has(b.id)
            ? {
                ...b,
                bbox: [
                  b.bbox[0] + dx,
                  b.bbox[1] + dy,
                  b.bbox[2] + dx,
                  b.bbox[3] + dy
                ] as [number, number, number, number]
              }
            : b
        )
      };
    }),

  deleteSelected: () =>
    setState(s => {
      if (s.selected.length === 0) return {};
      const sel = new Set(s.selected);
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: [],
        boxes: s.boxes.filter(b => !sel.has(b.id)),
        selected: [],
        notice: `已删除 ${sel.size} 个方框`
      };
    }),

  pushHistory: () =>
    setState(s => ({
      past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
      future: []
    })),

  undo: () =>
    setState(s => {
      if (s.past.length === 0) return {};
      const prev = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        future: [s.boxes, ...s.future].slice(0, HISTORY_LIMIT),
        boxes: prev,
        selected: s.selected.filter(id => prev.some(b => b.id === id))
      };
    }),

  redo: () =>
    setState(s => {
      if (s.future.length === 0) return {};
      const next = s.future[0];
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        boxes: next,
        selected: s.selected.filter(id => next.some(b => b.id === id))
      };
    }),

  applySort: (opts, offsets) =>
    setState(s => {
      const res = computeSort(s.boxes, opts, offsets);
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: [],
        boxes: s.boxes.map(b => ({ ...b, index: res.order.get(b.id) ?? null })),
        sortOpen: false,
        notice: `编号完成：${res.rowCount} 行 / ${s.boxes.length} 个点位`
      };
    }),

  openRecomputeTracks: () => setState({ recomputeOpen: true }),

  applyRecomputeTracks: (opts, offsets) =>
    setState(s => {
      const res = recomputeTracks(s.boxes, { ...opts, offsets });
      // 文件没有 ID 时就只报轨道号变化，别把 null 拼进去
      const moves = res.moves
        .map(m => `${m.studId ?? "#"}:${m.from}→${m.to}`)
        .join(" ");
      return {
        past: [...s.past, s.boxes].slice(-HISTORY_LIMIT),
        future: [],
        boxes: res.boxes,
        recomputeOpen: false,
        notice:
          res.changed === 0
            ? `已重算轨道：${res.trackCount} 条轨道 / ${s.boxes.length} 个点位 · 无变化`
            : `已重算轨道：${res.trackCount} 条轨道 / ${s.boxes.length} 个点位 · ${res.changed} 个点位轨道号有变化${moves ? `（${moves}${res.changed > res.moves.length ? " …" : ""}）` : ""}`
      };
    }),

  exportJson: () =>
    setState(s => {
      const out = buildExport(s.boxes, s.meta ?? {}, s.image?.name ?? "");
      const filename = `annotations_annotated_${fileTimestamp()}.json`;
      downloadJson(out, filename);
      return { notice: `已导出 ${filename}` };
    })
}));
