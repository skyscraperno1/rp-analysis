import { useEffect, useMemo, useRef, useState } from 'react';
import { List } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { OverlayScrollbars } from 'overlayscrollbars';
import 'overlayscrollbars/overlayscrollbars.css';
import { useStore } from '../store/useStore';
import { TipButton, tipAttrs } from './Tooltip';

type Filter = 'all' | 'existing' | 'manual';

const FILTERS: { key: Filter; label: string; tip: string; dot?: 'existing' | 'manual' }[] = [
  { key: 'all', label: '全部', tip: '显示全部点位' },
  { key: 'existing', label: '原有', tip: '只显示 JSON 原有的点位（绿色框）', dot: 'existing' },
  { key: 'manual', label: '新增', tip: '只显示人工新增的点位（蓝色框）', dot: 'manual' },
];

export function BoxList() {
  const boxes = useStore((s) => s.boxes);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const focusBox = useStore((s) => s.focusBox);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const selectAll = useStore((s) => s.selectAll);
  const lastIdx = useRef<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  /* OverlayScrollbars：细悬浮滚动条（自动隐藏，不占布局宽度）
     注意：必须像官方 React 包装包那样，用一个 React 自己的内层 div 充当 OS 的
     viewport/content，否则 OS 会搬动 React 的子节点导致 removeChild 崩溃 */
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    const viewport = viewportRef.current;
    if (!host || !viewport) return;
    const os = OverlayScrollbars(
      { target: host, elements: { viewport, content: viewport } },
      {
        scrollbars: { autoHide: 'leave', autoHideDelay: 300 },
        overflow: { x: 'hidden', y: 'scroll' },
      },
    );
    return () => os.destroy();
  }, []);

  const counts = useMemo(
    () => ({
      all: boxes.length,
      existing: boxes.filter((b) => !b.manual).length,
      manual: boxes.filter((b) => !!b.manual).length,
    }),
    [boxes],
  );

  const rows = useMemo(() => {
    const hasIdx = boxes.some((b) => b.index != null);
    let arr = boxes.map((b, i) => ({ b, i }));
    if (filter === 'existing') arr = arr.filter((r) => !r.b.manual);
    else if (filter === 'manual') arr = arr.filter((r) => !!r.b.manual);
    if (hasIdx) arr.sort((a, b) => (a.b.index ?? 1e9) - (b.b.index ?? 1e9) || a.i - b.i);
    else arr.sort((a, b) => a.b.bbox[1] - b.b.bbox[1] || a.b.bbox[0] - b.b.bbox[0]);
    return arr;
  }, [boxes, filter]);

  const visibleSelected = useMemo(() => {
    const ids = new Set(rows.map((r) => r.b.id));
    return selected.filter((id) => ids.has(id)).length;
  }, [rows, selected]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 30,
    overscan: 24,
  });

  const onClickRow = (e: React.MouseEvent, pos: number) => {
    const id = rows[pos].b.id;
    if (e.shiftKey && lastIdx.current != null) {
      const a = Math.min(lastIdx.current, pos);
      const b = Math.max(lastIdx.current, pos);
      select(rows.slice(a, b + 1).map((r) => r.b.id));
    } else if (e.ctrlKey || e.metaKey) {
      toggleSelect(id);
      lastIdx.current = pos;
    } else {
      select([id]);
      focusBox(id);
      lastIdx.current = pos;
    }
  };

  const allVisibleSelected = rows.length > 0 && visibleSelected === rows.length;

  return (
    <div className="panel boxlist">
      <div className="panel-head">
        <span className="panel-head-icon" {...tipAttrs('点位列表', 'bottom')}>
          <List size={15} strokeWidth={1.8} />
        </span>
        <span className="count" {...tipAttrs('当前列表显示的点位数', 'bottom')}>
          {rows.length}
        </span>
      </div>
      <div className="panel-actions">
        <button
          className="btn"
          onClick={() => (allVisibleSelected ? select([]) : selectAll())}
          disabled={!rows.length}
        >
          {allVisibleSelected ? '全不选' : '全选'}
        </button>
        <button className="btn danger" onClick={deleteSelected} disabled={!visibleSelected}>
          删除{visibleSelected ? ` (${visibleSelected})` : ''}
        </button>
      </div>

      <div className="list-filter">
        {FILTERS.map((f) => (
          <TipButton
            key={f.key}
            tip={f.tip}
            className={`filter-tab${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.dot && <i className={`dot ${f.dot}`} />}
            {f.label}
            <em>{counts[f.key]}</em>
          </TipButton>
        ))}
      </div>

      <div className="boxlist-scroll" ref={hostRef}>
        <div className="boxlist-viewport" ref={viewportRef}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const b = rows[vi.index].b;
              const isSel = selected.includes(b.id);
              return (
                <div
                  key={b.id}
                  className={`boxrow${isSel ? ' sel' : ''}${b.manual ? ' manual' : ''}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: vi.size,
                    transform: `translateY(${vi.start}px)`,
                  }}
                  onClick={(e) => onClickRow(e, vi.index)}
                  {...tipAttrs(
                    [
                      b.index != null ? `#${b.index} · ` : '',
                      `起始点 (${b.bbox[0].toFixed(0)}, ${b.bbox[1].toFixed(0)}) · 宽 ${(b.bbox[2] - b.bbox[0]).toFixed(0)} × 高 ${(b.bbox[3] - b.bbox[1]).toFixed(0)} px`,
                    ].join(''),
                    'right',
                  )}
                >
                  <span className="idx">{b.index ?? '–'}</span>
                  <span className="coord">
                    {b.bbox[0].toFixed(0)}, {b.bbox[1].toFixed(0)}
                  </span>
                  <span className="dim">
                    {(b.bbox[2] - b.bbox[0]).toFixed(0)}×{(b.bbox[3] - b.bbox[1]).toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
          {rows.length === 0 && (
            <div className="list-empty">没有{FILTERS.find((f) => f.key === filter)?.label}点位</div>
          )}
        </div>
      </div>
    </div>
  );
}
