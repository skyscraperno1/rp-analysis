/** 算法输出的一条检测结果（studs.json 格式）；
 *  竖着排列的每一列是一个 track，track_id 即该列的编号 */
export interface Detection {
  /** [x1, y1, x2, y2] 原图坐标系 */
  bbox: [number, number, number, number];
  /** 算法按竖排列计算出的轨道号：同一列的点位共享同一个 track_id。
   *  旧格式没有这个字段，导入时记为 0（颜色用），但不视为"有轨道" */
  track_id: number;
  /** 原始数据里的 stud 编号（导入时读回，导出时写回） */
  id?: number;
  /** 轨道号是否真实存在：文件给了 track_id 才有；旧格式没有这个字段，
   *  导入时 track_id 记为 0（只用来拿颜色），但不视为"有轨道" */
  hasTrack: boolean;
  /** 排序编号（导出时写入，导入时读回） */
  index?: number | null;
  /* ---- 以下为旧版 sahi 预测 JSON 的字段，新格式不再产出，仅导入时兼容 ---- */
  score?: number;
  class_id?: number;
  class_name?: string;
}

/** 编辑器内部的点位对象 = Detection + id + 编号 */
export interface Box extends Omit<Detection, 'id'> {
  id: string;
  /** 文件里的 stud 编号；旧格式没有 id 时为 null，不凭空造号 */
  studId: number | null;
  /** 排序编号，1 起；未编号为 null */
  index: number | null;
}

export interface PredJson {
  image?: string;
  image_width?: number;
  image_height?: number;
  coordinate_system?: string;
  params?: Record<string, unknown>;
  studs: Detection[];
}

export type ToolMode = 'select' | 'draw' | 'pan';
/** 画布标签显示：开 / 关 */
export type LabelMode = 'on' | 'off';
