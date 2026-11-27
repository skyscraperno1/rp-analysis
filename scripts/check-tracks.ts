import { readFileSync } from "node:fs";
import { parsePredJson, toBoxes } from "../src/lib/jsonio";
import { guessTrackId } from "../src/lib/tracks";

const boxes = toBoxes(
  parsePredJson(readFileSync("public/studs.json", "utf8")).studs
);

// 每条轨道的 x 跨度与点数（只用于打印，看看列与列的间隔）
const spans = new Map<number, { x0: number; x1: number; n: number }>();
for (const b of boxes) {
  const s = spans.get(b.track_id) ?? { x0: Infinity, x1: -Infinity, n: 0 };
  s.x0 = Math.min(s.x0, b.bbox[0]);
  s.x1 = Math.max(s.x1, b.bbox[2]);
  s.n++;
  spans.set(b.track_id, s);
}
console.log(`boxes: ${boxes.length}, tracks: ${spans.size}`);
console.log(
  "track spans (id, x0-x1, size):\n" +
    [...spans.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([id, s]) =>
          `  #${String(id).padStart(2)}  ${s.x0.toFixed(0).padStart(6)} ~ ${s.x1.toFixed(0).padStart(6)}  n=${s.n}`
      )
      .join("\n")
);

// 留一验证：把每个点位拿掉，用剩下的猜它的轨道，看猜对多少
let ok = 0;
const wrong: { id: string; actual: number; guessed: number }[] = [];
for (const b of boxes) {
  const rest = boxes.filter(x => x.id !== b.id);
  const guessed = guessTrackId(rest, b.bbox);
  if (guessed === b.track_id) ok++;
  else wrong.push({ id: b.id, actual: b.track_id, guessed });
}
console.log(
  `\nleave-one-out accuracy: ${ok}/${boxes.length} = ${((ok / boxes.length) * 100).toFixed(2)}%`
);
if (wrong.length) {
  console.log(
    `misses (first 20): ${wrong
      .slice(0, 20)
      .map(w => `#${w.id}: ${w.actual}->${w.guessed}`)
      .join(", ")}`
  );
}

// 边界情形
const maxId = boxes.reduce((m, b) => Math.max(m, b.track_id), 0);
console.log(`\nno boxes -> track ${guessTrackId([], [100, 100, 200, 200])}`);
console.log(
  `box at the right image edge  -> track ${guessTrackId(boxes, [1975, 100, 2040, 200])} (max existing is ${maxId})`
);
console.log(
  `box at the left image edge   -> track ${guessTrackId(boxes, [10, 100, 100, 200])} (max existing is ${maxId})`
);
console.log(
  `box in the middle of column 5 -> track ${guessTrackId(boxes, [560, 100, 650, 200])}`
);
