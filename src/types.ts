/** 算法输出的一条检测结果（与 sahi 预测 JSON 一致）；
 *  index / manual 是本工具导出时附加的字段，再次导入时应被应用 */
export interface Detection {
  /** [x1, y1, x2, y2] 原图坐标系 */
  bbox: [number, number, number, number];
  score: number;
  class_id: number;
  class_name: string;
  /** 空间排序编号（导出时写入，导入时读回） */
  index?: number | null;
  /** 是否人工新增（导出时写入，导入时读回） */
  manual?: boolean;
}

/** 编辑器内部的点位对象 = Detection + id + 编号 */
export interface Box extends Detection {
  id: string;
  /** 空间排序编号，1 起；未编号为 null */
  index: number | null;
  /** 人工新增的框 */
  manual?: boolean;
}

export interface PredJson {
  image?: string;
  image_width?: number;
  image_height?: number;
  params?: Record<string, unknown>;
  detections: Detection[];
}

export type ToolMode = 'select' | 'draw' | 'pan';
/** 编号显示：开 / 关 */
export type LabelMode = 'on' | 'off';
