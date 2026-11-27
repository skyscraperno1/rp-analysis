import type { HTMLAttributes } from "react";

export const TOOLTIP_ID = "app-tooltip";

/** 给任意元素挂 tooltip 的属性（配合全局 AppTooltip 使用） */
export function tipAttrs(
  tip: string,
  dir: "top" | "bottom" | "left" | "right" = "top"
): HTMLAttributes<HTMLElement> {
  return {
    "data-tooltip-id": TOOLTIP_ID,
    "data-tooltip-content": tip,
    "data-tooltip-place": dir
  } as HTMLAttributes<HTMLElement>;
}
