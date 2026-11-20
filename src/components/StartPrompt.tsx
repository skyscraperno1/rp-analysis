import { useStore } from '../store/useStore';
import { Modal } from './Modal';

/** 启动引导：两步，一次只亮一步。
 *  没选图时第 1 步是当前步（亮蓝 + 主按钮），第 2 步锁着；
 *  选完图第 2 步成为当前步，第 1 步退成已完成（按钮换成透明底）。
 *  任意一步都能直接关掉（遮罩点不透、Esc 可关），关掉后靠拖拽或顶栏按钮继续。
 *  走 mask={false}：背景不变暗，也不带投影。 */
export function StartPrompt() {
  const open = useStore((s) => s.setupPromptOpen);
  const setOpen = useStore((s) => s.setSetupPromptOpen);
  const hasImage = useStore((s) => s.image != null);

  if (!open) return null;

  return (
    <Modal title="开始标注" onClose={() => setOpen(false)} width={420} mask={false}>
      <div className={`start-row${hasImage ? ' is-done' : ' is-active'}`}>
        <span className="start-no">1</span>
        <span className="start-label">打开辊面图片</span>
        <button
          className={`btn${hasImage ? ' ghost' : ' primary'}`}
          onClick={() => document.getElementById('img-input')?.click()}
        >
          {hasImage ? '重新选择' : '选择图片'}
        </button>
      </div>
      <div className={`start-row${hasImage ? ' is-active' : ' is-locked'}`}>
        <span className="start-no">2</span>
        <span className="start-label">导入标注数据</span>
        <button
          className={`btn${hasImage ? ' primary' : ''}`}
          disabled={!hasImage}
          onClick={() => document.getElementById('json-input')?.click()}
        >
          选择 JSON
        </button>
      </div>
      <div className="hint">也可以把图片或 JSON 拖进窗口</div>
    </Modal>
  );
}
