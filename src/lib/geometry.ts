export type BBox = [number, number, number, number];

export function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): BBox {
  return [
    Math.min(x0, x1),
    Math.min(y0, y1),
    Math.max(x0, x1),
    Math.max(y0, y1)
  ];
}

export function intersects(
  a: BBox,
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return !(a[2] < b.x || a[0] > b.x + b.w || a[3] < b.y || a[1] > b.y + b.h);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
