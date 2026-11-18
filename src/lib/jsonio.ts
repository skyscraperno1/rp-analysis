import type { Box, Detection, PredJson } from '../types';

/** 解析算法输出的 sahi 预测 JSON */
export function parsePredJson(text: string): PredJson {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON 解析失败，不是合法的 JSON 文件');
  }
  const obj = data as Record<string, unknown>;
  if (!obj || !Array.isArray(obj.detections)) {
    throw new Error('JSON 中找不到 detections 数组');
  }
  const dets: Detection[] = [];
  obj.detections.forEach((d: unknown) => {
    const item = d as Record<string, unknown>;
    if (!item || !Array.isArray(item.bbox) || item.bbox.length < 4) return;
    const nums = item.bbox.slice(0, 4).map((v) => Number(v));
    if (nums.some((v) => !Number.isFinite(v))) return;
    dets.push({
      bbox: [nums[0], nums[1], nums[2], nums[3]],
      score: typeof item.score === 'number' ? item.score : 1,
      class_id: typeof item.class_id === 'number' ? item.class_id : 0,
      class_name: typeof item.class_name === 'string' ? item.class_name : 'item',
      index: typeof item.index === 'number' ? item.index : null,
      manual: item.manual === true,
    });
  });
  if (dets.length === 0) throw new Error('detections 为空或格式不正确');
  return {
    image: typeof obj.image === 'string' ? obj.image : undefined,
    image_width: typeof obj.image_width === 'number' ? obj.image_width : undefined,
    image_height: typeof obj.image_height === 'number' ? obj.image_height : undefined,
    params: (obj.params as Record<string, unknown>) ?? undefined,
    detections: dets,
  };
}

export function toBoxes(dets: Detection[]): Box[] {
  return dets.map((d, i) => ({
    bbox: [d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3]] as [number, number, number, number],
    score: d.score,
    class_id: d.class_id,
    class_name: d.class_name,
    id: `d${i}`,
    // 应用导入的编号与人工标记（没有则为 null / false）
    index: typeof d.index === 'number' ? d.index : null,
    manual: d.manual === true,
  }));
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** 导出：保留原始字段，按编号排序，新增 index 字段 */
export function buildExport(
  boxes: Box[],
  meta: { image?: string; image_width?: number; image_height?: number; params?: Record<string, unknown> },
  imageName: string,
) {
  const hasIndex = boxes.some((b) => b.index != null);
  const sorted = [...boxes].sort((a, b) => {
    const ia = a.index ?? Number.MAX_SAFE_INTEGER;
    const ib = b.index ?? Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
  return {
    image: meta.image || imageName,
    image_width: meta.image_width,
    image_height: meta.image_height,
    params: meta.params ?? {},
    detections: sorted.map((b) => {
      const d: Record<string, unknown> = {
        bbox: [r2(b.bbox[0]), r2(b.bbox[1]), r2(b.bbox[2]), r2(b.bbox[3])],
        score: b.score,
        class_id: b.class_id,
        class_name: b.class_name,
      };
      if (hasIndex && b.index != null) d.index = b.index;
      if (b.manual) d.manual = true;
      return d;
    }),
  };
}

/** 本地时间戳，用于导出文件名：20261118_153045 */
export function fileTimestamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
