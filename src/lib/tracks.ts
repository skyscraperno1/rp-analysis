import type { Box } from "../types";

/**
 * 猜一个新框属于哪条轨道。
 * 轨道是竖着排的一列，所以只看 x：用每条轨道已有框的中心 x 均值当作"列轴线"，
 * 新框中心离哪条轴线最近就归入哪一列。
 * 只有当中心离最近的轴线还超过一个框宽（明显不在任何一列上）时，才新开一条轨道，
 * 免得和已有列撞色。
 */
export function guessTrackId(
  boxes: Box[],
  bbox: [number, number, number, number]
): number {
  if (boxes.length === 0) return 0;
  const cx = (bbox[0] + bbox[2]) / 2;

  // 每条轨道的轴线（中心 x 均值）与最大编号
  const axis = new Map<number, { sum: number; n: number }>();
  let maxId = boxes[0].track_id;
  for (const b of boxes) {
    maxId = Math.max(maxId, b.track_id);
    const e = axis.get(b.track_id) ?? { sum: 0, n: 0 };
    e.sum += (b.bbox[0] + b.bbox[2]) / 2;
    e.n++;
    axis.set(b.track_id, e);
  }

  let bestId = boxes[0].track_id;
  let bestD = Infinity;
  for (const [id, e] of axis) {
    const d = Math.abs(cx - e.sum / e.n);
    if (d < bestD) {
      bestD = d;
      bestId = id;
    }
  }

  // 离最近的列都超过一个框宽：认为是新的一列
  if (bestD > Math.max(bbox[2] - bbox[0], 24)) return maxId + 1;
  return bestId;
}
