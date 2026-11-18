import { readFileSync } from 'node:fs';
import { parsePredJson, toBoxes, buildExport } from '../src/lib/jsonio';
import { computeSort } from '../src/lib/sorting';

const json = parsePredJson(readFileSync('stitched_rectified_cropped_sahi_pred.json', 'utf8'));
let boxes = toBoxes(json.detections);

// 1) 编号 + 标两个人工框
const r = computeSort(boxes, { tolerance: 70 });
boxes = boxes.map((b) => ({ ...b, index: r.order.get(b.id) ?? null }));
boxes[0].manual = true;
boxes[10].manual = true;

// 2) 导出 -> 再解析 -> 再 toBoxes，验证 index / manual / bbox 完整往返
//    注意导出会按编号重排，所以按 index 建映射对比，而不是按位置
const exported = buildExport(boxes, { image: 'x.png', image_width: 2048, image_height: 18611 }, 'x.png');
const reparsed = parsePredJson(JSON.stringify(exported));
const boxes2 = toBoxes(reparsed.detections);

const map1 = new Map(boxes.map((b) => [b.index!, b]));
let idxOk = boxes2.length === boxes.length;
let manOk = true;
let bboxOk = true;
for (const b of boxes2) {
  const orig = map1.get(b.index!);
  if (!orig) {
    idxOk = false;
    continue;
  }
  if (orig.manual !== b.manual) manOk = false;
  for (let k = 0; k < 4; k++) {
    if (Math.abs(orig.bbox[k] - b.bbox[k]) > 0.011) bboxOk = false;
  }
}

console.log(`boxes: ${boxes.length} -> ${boxes2.length}`);
console.log(`index preserved: ${idxOk ? 'OK' : 'FAILED'} (indexed ${boxes2.filter((b) => b.index != null).length})`);
console.log(`manual preserved: ${manOk ? 'OK' : 'FAILED'} (manual ${boxes2.filter((b) => b.manual).length})`);
console.log(`bbox preserved (2 decimals): ${bboxOk ? 'OK' : 'FAILED'}`);

// 3) 导入没有 index/manual 的原始 JSON 时应全部为 null/false
const raw = toBoxes(json.detections);
const noIdx = raw.every((b) => b.index === null && !b.manual);
console.log(`raw json import (no index/manual): ${noIdx ? 'OK' : 'FAILED'}`);

// 4) 导出文本里确实带 index / manual 字段（人工框带 manual）
const first = exported.detections[0] as Record<string, unknown>;
const manualEntry = exported.detections.find((d) => (d as Record<string, unknown>).manual) as Record<string, unknown>;
console.log(`export fields (normal): ${Object.keys(first).join(', ')}`);
console.log(`export fields (manual): ${manualEntry ? Object.keys(manualEntry).join(', ') : 'NOT FOUND'}`);
