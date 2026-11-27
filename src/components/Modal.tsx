import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** 全局弹窗：半透明遮罩 + 居中面板。
 *  Esc 关闭、点遮罩关闭；面板内部点击不透传到遮罩。
 *  所有弹窗（导入提示、排序编号…）都走这一个组件，避免各处重复造遮罩。 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  width,
  closeOnMask = true,
  mask = true
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 底部按钮区，不传则没有 */
  footer?: ReactNode;
  /** 面板宽度，默认 460px */
  width?: number;
  /** 点遮罩是否关闭，默认 true */
  closeOnMask?: boolean;
  /** 是否显示半透明遮罩；关掉后背景不变暗，适合想同时看画布的场景，默认 true */
  mask?: boolean;
}) {
  /* Esc 关闭 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className={`modal-mask${mask ? "" : " no-mask"}`}
      onMouseDown={e => {
        // 只有点在遮罩本身上、且允许点遮罩关闭时才关
        if (closeOnMask && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        style={width ? { width } : undefined}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="关闭"
            title="关闭 (Esc)"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
