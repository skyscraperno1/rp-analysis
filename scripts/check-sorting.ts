import { readFileSync } from 'node:fs';
import { parsePredJson, toBoxes } from '../src/lib/jsonio';
import { computeSort } from '../src/lib/sorting';

const json = parsePredJson(readFileSync('public/studs.json', 'utf8'));
const boxes = toBoxes(json.studs);
console.log(`boxes: ${boxes.length}`);
console.log(`tracks: ${new Set(boxes.map((b) => b.track_id)).size}`);

for (const tol of [40, 70, 100]) {
  const r = computeSort(boxes, { tolerance: tol });
  const sizes = [...r.rowSizes].sort((a, b) => a - b);
  console.log(
    `tol=${tol}px: rows=${r.rowCount} per-row min=${sizes[0]} med=${sizes[sizes.length >> 1]} max=${sizes[sizes.length - 1]}`,
  );
}

// 自动聚类 → 取其偏移量再显式分配，结果应一致
const auto = computeSort(boxes, { tolerance: 70 });
const offsets = auto.rows.map((r) => r.offset);
const explicit = computeSort(boxes, { tolerance: 70 }, offsets);
let same = auto.order.size === explicit.order.size;
if (same) {
  for (const [id, idx] of auto.order) {
    if (explicit.order.get(id) !== idx) {
      same = false;
      break;
    }
  }
}
console.log(`explicit-offsets reassignment identical: ${same ? 'OK' : 'FAILED'}`);

// 打乱一个偏移量（模拟行中心不齐时的手工修正），确认分配会跟着变
const tweaked = offsets.slice();
tweaked[5] = tweaked[5] + 250;
const tweakRes = computeSort(boxes, { tolerance: 70 }, tweaked);
console.log(`tweaked offset -> row5 size ${auto.rows[5].size} => ${tweakRes.rows[5].size}`);

const r = computeSort(boxes, { tolerance: 70 });
const byIndex = [...boxes]
  .map((b) => ({ b, idx: r.order.get(b.id)! }))
  .sort((a, b) => a.idx - b.idx);
console.log('\nfirst 16 in numbering order (index, cx, cy):');
for (const { b, idx } of byIndex.slice(0, 16)) {
  console.log(
    `  #${idx}  cx=${((b.bbox[0] + b.bbox[2]) / 2).toFixed(0)}  cy=${((b.bbox[1] + b.bbox[3]) / 2).toFixed(0)}`,
  );
}

const idxs = [...r.order.values()].sort((a, b) => a - b);
const ok = idxs.length === boxes.length && idxs.every((v, i) => v === i + 1);
console.log(`\nnumbering continuous 1..${boxes.length}: ${ok ? 'OK' : 'FAILED'}`);
