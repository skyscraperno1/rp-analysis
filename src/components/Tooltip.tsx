import type { ButtonHTMLAttributes } from "react";
import { Tooltip as ReactTooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import { TOOLTIP_ID } from "../lib/tooltip";

/** 全局单例 tooltip（渲染在 App 根部，floating-ui portal 到 body） */
export function AppTooltip() {
  return (
    <ReactTooltip
      id={TOOLTIP_ID}
      place="top"
      delayShow={250}
      variant="dark"
      style={{
        borderRadius: 6,
        backgroundColor: "#e9ebef",
        color: "#1b1c22",
        fontSize: 12,
        lineHeight: 1.35,
        padding: "5px 9px",
        border: "1px solid rgba(0, 0, 0, 0.28)",
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.45)",
        zIndex: 1000
      }}
      arrowColor="#e9ebef"
    />
  );
}

/** 自带 tooltip 的图标按钮 */
export function TipButton({
  tip,
  dir = "top",
  children,
  ...rest
}: {
  tip: string;
  dir?: "top" | "bottom";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      data-tooltip-id={TOOLTIP_ID}
      data-tooltip-content={tip}
      data-tooltip-place={dir}
      {...rest}
    >
      {children}
    </button>
  );
}
