import { useEffect } from 'react';
import { useStore } from '../store/useStore';

/** 全局快捷键 */
export function useKeyboard() {
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const st = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        const k = e.key.toLowerCase();
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) st.redo();
          else st.undo();
          return;
        }
        if (k === 'y') {
          e.preventDefault();
          st.redo();
          return;
        }
        if (k === 'a') {
          e.preventDefault();
          st.selectAll();
          return;
        }
        return;
      }

      switch (e.key) {
        case 'v':
        case 'V':
          st.setMode('select');
          break;
        case 'd':
        case 'D':
          st.setMode('draw');
          break;
        case 'h':
        case 'H':
          st.setMode('pan');
          break;
        case 'f':
        case 'F':
          st.fitWidth();
          break;
        case '1':
          st.zoomTo100();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          st.deleteSelected();
          break;
        case 'Escape':
          st.select([]);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          st.moveSelected(e.shiftKey ? -10 : -1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          st.moveSelected(e.shiftKey ? 10 : 1, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          st.moveSelected(0, e.shiftKey ? -10 : -1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          st.moveSelected(0, e.shiftKey ? 10 : 1);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, []);
}
