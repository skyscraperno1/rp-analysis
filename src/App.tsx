import { useEffect } from "react";
import { useStore } from "./store/useStore";
import { Toolbar } from "./components/Toolbar";
import { AnnotationStage } from "./components/AnnotationStage";
import { BoxList } from "./components/BoxList";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { HelpCard } from "./components/HelpCard";
import { SortDialog } from "./components/SortDialog";
import { RecomputeTracksDialog } from "./components/RecomputeTracksDialog";
import { AppTooltip } from "./components/Tooltip";
import { StartPrompt } from "./components/StartPrompt";
import { useKeyboard } from "./hooks/useKeyboard";
import { restoreOnStart } from "./lib/fileCache";

export default function App() {
  useKeyboard();
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const notice = useStore(s => s.notice);

  /* 提示自动消失 */
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useStore.getState().setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  /* 启动时恢复上次记住的文件：引导弹窗列出图片名和 JSON 名，
     能自动读的转圈等它读完，需要授权的留着「恢复」按钮 */
  useEffect(() => {
    void restoreOnStart();
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        <BoxList />
        <div className="canvas-area">
          <AnnotationStage />
        </div>
        {/* 右栏：属性面板 + 右下角的使用说明入口。
           说明卡片是绝对定位，展开时会往左溢出到画布上，层级高于其他浮层 */}
        <div className="side-right">
          <PropertiesPanel />
          <HelpCard />
        </div>
      </div>
      <SortDialog />
      <RecomputeTracksDialog />
      <StartPrompt />
      {notice && <div className="toast">{notice}</div>}
      {error && (
        <div
          className="toast error"
          onClick={() => useStore.getState().setError(null)}
        >
          {error}（点击关闭）
        </div>
      )}
      {loading && <div className="topline">加载中…</div>}
      <AppTooltip />
    </div>
  );
}
