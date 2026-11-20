import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { trackColor } from '../lib/colors';

const MM_H = 420;

/** 全局缩略图：显示全部框 + 当前视口，点击/拖动跳转 */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const image = useStore((s) => s.image);
  const imageEl = useStore((s) => s.imageEl);
  const boxes = useStore((s) => s.boxes);
  const selected = useStore((s) => s.selected);
  const view = useStore((s) => s.view);
  const vp = useStore((s) => s.vp);

  const W = image ? Math.max(24, Math.round((MM_H * image.width) / image.height)) : 24;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = MM_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, MM_H);

    if (imageEl) ctx.drawImage(imageEl, 0, 0, W, MM_H);
    else {
      ctx.fillStyle = '#101115';
      ctx.fillRect(0, 0, W, MM_H);
    }

    const kx = W / image.width;
    const ky = MM_H / image.height;
    for (const b of boxes) {
      ctx.fillStyle = trackColor(b.track_id);
      ctx.fillRect(
        b.bbox[0] * kx,
        b.bbox[1] * ky,
        Math.max(1.5, (b.bbox[2] - b.bbox[0]) * kx),
        Math.max(1.5, (b.bbox[3] - b.bbox[1]) * ky),
      );
    }
    // 选中的框不再单独刷成黄色：仍用轨道本身的颜色，只加一道白描边
    if (selected.length) {
      const sel = new Set(selected);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (const b of boxes) {
        if (!sel.has(b.id)) continue;
        const bw = Math.max(2, (b.bbox[2] - b.bbox[0]) * kx);
        const bh = Math.max(2, (b.bbox[3] - b.bbox[1]) * ky);
        ctx.fillStyle = trackColor(b.track_id);
        ctx.fillRect(b.bbox[0] * kx, b.bbox[1] * ky, bw, bh);
        ctx.strokeRect(b.bbox[0] * kx, b.bbox[1] * ky, bw, bh);
      }
    }

    const vx = (-view.x / view.scale) * kx;
    const vy = (-view.y / view.scale) * ky;
    const vw = (vp.width / view.scale) * kx;
    const vh = (vp.height / view.scale) * ky;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, vw, vh);
  }, [image, imageEl, boxes, selected, view, vp, W]);

  const jump = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const st = useStore.getState();
    if (!canvas || !st.image) return;
    const r = canvas.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const fy = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    const imgX = fx * st.image.width;
    const imgY = fy * st.image.height;
    st.setView({
      ...st.view,
      x: st.vp.width / 2 - imgX * st.view.scale,
      y: st.vp.height / 2 - imgY * st.view.scale,
    });
  };

  if (!image) return null;

  return (
    <div className="minimap" title="全局缩略图（点击跳转）">
      <canvas
        ref={canvasRef}
        style={{ width: W, height: MM_H }}
        onMouseDown={(e) => {
          jump(e.clientX, e.clientY);
          const move = (ev: MouseEvent) => jump(ev.clientX, ev.clientY);
          const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        }}
      />
    </div>
  );
}
