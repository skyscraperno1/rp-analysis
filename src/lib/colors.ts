/** 点位配色：已有（JSON 导入）= 绿，新增（人工）= 蓝，选中 = 黄 */
export const BOX_COLORS = {
  existing: {
    stroke: '#52c41a',
    fill: 'rgba(82,196,26,0.10)',
  },
  manual: {
    stroke: '#1677ff',
    fill: 'rgba(22,119,255,0.13)',
  },
  selected: {
    stroke: '#ffb300',
    fill: 'rgba(255,179,0,0.22)',
  },
  hover: '#ffffff',
} as const;
