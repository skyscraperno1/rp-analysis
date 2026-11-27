import type { Box, Detection, PredJson } from "../types";

/** 解析算法输出的 studs.json（兼容旧版 sahi 预测 JSON 的 detections 数组） */
export function parsePredJson(text: string): PredJson {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON 解析失败，不是合法的 JSON 文件");
  }
  const obj = data as Record<string, unknown>;
  // 新格式是 studs 数组，旧格式是 detections 数组
  const raw = Array.isArray(obj?.studs)
    ? obj.studs
    : Array.isArray(obj?.detections)
      ? obj.detections
      : null;
  if (!raw) {
    throw new Error("JSON 中找不到 studs 数组");
  }
  const dets: Detection[] = [];
  raw.forEach((d: unknown) => {
    const item = d as Record<string, unknown>;
    if (!item || !Array.isArray(item.bbox) || item.bbox.length < 4) return;
    const nums = item.bbox.slice(0, 4).map(v => Number(v));
    if (nums.some(v => !Number.isFinite(v))) return;
    dets.push({
      id: typeof item.id === "number" ? item.id : undefined,
      bbox: [nums[0], nums[1], nums[2], nums[3]],
      // 旧数据没有 track_id：记为 0（配色用），但不标记为"有轨道"
      track_id: typeof item.track_id === "number" ? item.track_id : 0,
      hasTrack: typeof item.track_id === "number",
      index: typeof item.index === "number" ? item.index : null,
      score: typeof item.score === "number" ? item.score : undefined,
      class_id: typeof item.class_id === "number" ? item.class_id : undefined,
      class_name:
        typeof item.class_name === "string" ? item.class_name : undefined
    });
  });
  if (dets.length === 0) throw new Error("studs 为空或格式不正确");
  return {
    image: typeof obj.image === "string" ? obj.image : undefined,
    image_width:
      typeof obj.image_width === "number" ? obj.image_width : undefined,
    image_height:
      typeof obj.image_height === "number" ? obj.image_height : undefined,
    coordinate_system:
      typeof obj.coordinate_system === "string"
        ? obj.coordinate_system
        : undefined,
    params: (obj.params as Record<string, unknown>) ?? undefined,
    studs: dets
  };
}

export function toBoxes(dets: Detection[]): Box[] {
  // 旧格式没有 id：保持 null，不自动编号（编号会和"文件本来就有"混在一起）
  return dets.map((d, i) => ({
    bbox: [d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3]] as [
      number,
      number,
      number,
      number
    ],
    track_id: d.track_id,
    hasTrack: d.hasTrack,
    score: d.score,
    id: `d${i}`,
    studId: typeof d.id === "number" ? d.id : null,
    index: typeof d.index === "number" ? d.index : null
  }));
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** 导出：保留原始字段，按编号排序，写回 id / track_id / bbox */
export function buildExport(
  boxes: Box[],
  meta: {
    image?: string;
    image_width?: number;
    image_height?: number;
    coordinate_system?: string;
    params?: Record<string, unknown>;
  },
  imageName: string
) {
  const hasIndex = boxes.some(b => b.index != null);
  const sorted = [...boxes].sort((a, b) => {
    const ia = a.index ?? Number.MAX_SAFE_INTEGER;
    const ib = b.index ?? Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
  return {
    image: meta.image || imageName,
    image_width: meta.image_width,
    image_height: meta.image_height,
    coordinate_system: meta.coordinate_system,
    params: meta.params,
    total_studs: boxes.length,
    studs: sorted.map(b => {
      const d: Record<string, unknown> = {
        bbox: [r2(b.bbox[0]), r2(b.bbox[1]), r2(b.bbox[2]), r2(b.bbox[3])]
      };
      // 文件本来没有 id / track_id 的，导出时也不写，别凭空造一个
      if (b.studId != null) d.id = b.studId;
      if (b.hasTrack) d.track_id = b.track_id;
      if (hasIndex && b.index != null) d.index = b.index;
      return d;
    })
  };
}

/** 本地时间戳，用于导出文件名：20261118_153045 */
export function fileTimestamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
