/** 点位配色：普通状态按 track_id 上色（选中时也保持轨道色，只加粗）；
 *  悬停 = 白；selected 只用于选中后的手柄/变换边框这类交互控件，
 *  不再用来给方框本身染色。方框只画边框、不填底色（中间放一个小十字） */
export const BOX_COLORS = {
  selected: '#ffb300',
  hover: '#ffffff',
} as const;

/** 轨道色的 HSL 三段（不含 hsl() 包装），供描边 / 填充共用 */
function trackHsl(trackId: number): string {
  const i = Number.isFinite(trackId) ? Math.max(0, Math.floor(trackId)) : 0;
  const hue = (i * 137.508) % 360;
  const sat = i % 2 === 0 ? 76 : 64;
  const light = i % 2 === 0 ? 62 : 71;
  return `${hue.toFixed(1)} ${sat}% ${light}%`;
}

/** track_id → 描边色：竖排的每一列（一个 track）一个固定颜色。
 *  用黄金角在色相环上取色，相邻 track_id 的色相差最大，
 *  因此相邻的两列不会撞色；相邻项再交替明度，进一步拉开对比。
 *   track_id 不受调色板长度限制，任意大的编号都能拿到稳定且不重复的颜色。 */
export function trackColor(trackId: number): string {
  return `hsl(${trackHsl(trackId)})`;
}

/** track_id → 选中态的淡填充：同一套轨道色，低透明度。
 *  多选时（全选 / 框选一堆）光靠加粗在画布上看不出来，需要这一层底色。 */
export function trackFill(trackId: number, alpha = 0.18): string {
  return `hsl(${trackHsl(trackId)} / ${alpha})`;
}
