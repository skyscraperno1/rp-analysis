import { useStore } from "../store/useStore";
import { chooseImage, chooseJson, restoreByClick } from "../lib/fileCache";
import { ImageUp, Upload } from "lucide-react";
import { Modal } from "./Modal";

/** 启动引导：两步，一次只亮一步。
 *  没选图时第 1 步是当前步（亮蓝 + 主按钮），第 2 步锁着；
 *  选完图第 2 步成为当前步，第 1 步退成已完成（按钮换成透明底）。
 *  任意一步都能直接关掉（遮罩点不透、Esc 可关），关掉后靠顶栏按钮继续。
 *  走 mask={false}：背景不变暗，也不带投影。
 *
 *  缓存里记着文件时，这几行替代常规引导：列出图片名和 JSON 名，
 *  能自动读的转圈等它读完，需要授权的给个「恢复」按钮。 */
export function StartPrompt() {
  const open = useStore(s => s.setupPromptOpen);
  const setOpen = useStore(s => s.setSetupPromptOpen);
  const hasImage = useStore(s => s.image != null);
  const restoreItems = useStore(s => s.restoreItems);
  const setRestoreItems = useStore(s => s.setRestoreItems);

  if (!open) return null;

  // 已经读完的条目不再占行，让位给常规引导
  const restoring = restoreItems.filter(i => i.status !== "done");

  if (restoring.length > 0) {
    return (
      <Modal
        title="开始标注"
        onClose={() => {
          setRestoreItems([]);
          setOpen(false);
        }}
        width={420}
        mask={false}
      >
        {restoring.map(f => (
          <div className="start-row is-active" key={f.kind}>
            <span className="start-no">
              {f.kind === "image" ? (
                <ImageUp size={12} strokeWidth={2} />
              ) : (
                <Upload size={12} strokeWidth={2} />
              )}
            </span>
            <span className="start-label" title={f.name}>
              {f.name}
            </span>
            {f.status === "need" ? (
              <button
                className="btn primary"
                onClick={() => void restoreByClick(f.kind)}
              >
                恢复
              </button>
            ) : (
              <span className="start-spin" />
            )}
          </div>
        ))}
      </Modal>
    );
  }

  return (
    <Modal
      title="开始标注"
      onClose={() => setOpen(false)}
      width={420}
      mask={false}
    >
      <div className={`start-row${hasImage ? " is-done" : " is-active"}`}>
        <span className="start-no">1</span>
        <span className="start-label">打开辊面图片</span>
        <button
          className={`btn${hasImage ? " ghost" : " primary"}`}
          onClick={chooseImage}
        >
          {hasImage ? "重新选择" : "选择图片"}
        </button>
      </div>
      <div className={`start-row${hasImage ? " is-active" : " is-locked"}`}>
        <span className="start-no">2</span>
        <span className="start-label">导入标注数据</span>
        <button
          className={`btn${hasImage ? " primary" : ""}`}
          disabled={!hasImage}
          onClick={chooseJson}
        >
          选择 JSON
        </button>
      </div>
    </Modal>
  );
}
