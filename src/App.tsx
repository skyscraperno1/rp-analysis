import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { parsePredJson } from './lib/jsonio';
import { loadImageFromUrl } from './lib/loaders';
import { Toolbar } from './components/Toolbar';
import { AnnotationStage } from './components/AnnotationStage';
import { BoxList } from './components/BoxList';
import { PropertiesPanel } from './components/PropertiesPanel';
import { SortDialog } from './components/SortDialog';
import { AppTooltip } from './components/Tooltip';
import { useKeyboard } from './hooks/useKeyboard';

export default function App() {
  useKeyboard();
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const notice = useStore((s) => s.notice);

  /* 启动时加载默认素材：public/predictions.json + public/roller.png */
  useEffect(() => {
    let canceled = false;
    void (async () => {
      const st = useStore.getState();
      st.setLoading(true);
      try {
        const res = await fetch('predictions.json');
        if (res.ok) {
          const json = parsePredJson(await res.text());
          if (!canceled) st.loadPrediction(json);
        }
        if (!canceled) await loadImageFromUrl('roller.png', 'stitched_rectified_cropped.png');
      } catch (err) {
        if (!canceled) st.setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!canceled) st.setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  /* 提示自动消失 */
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useStore.getState().setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        <BoxList />
        <div className="canvas-area">
          <AnnotationStage />
        </div>
        <PropertiesPanel />
      </div>
      <SortDialog />
      {notice && <div className="toast">{notice}</div>}
      {error && (
        <div className="toast error" onClick={() => useStore.getState().setError(null)}>
          {error}（点击关闭）
        </div>
      )}
      {loading && <div className="topline">加载中…</div>}
      <AppTooltip />
    </div>
  );
}
