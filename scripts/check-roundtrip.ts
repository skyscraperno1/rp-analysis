import { readFileSync } from 'node:fs';
import { parsePredJson, toBoxes, buildExport } from '../src/lib/jsonio';
import { computeSort } from '../src/lib/sorting';

/* ---------- 1) 新格式 studs.json：有 id / track_id / index ---------- */
const json = parsePredJson(readFileSync('public/studs.json', 'utf8'));
let boxes = toBoxes(json.studs);

// 编号 + 改两个点位的轨道号
const r = computeSort(boxes, { tolerance: 70 });
boxes = boxes.map((b) => ({ ...b, index: r.order.get(b.id) ?? null }));
boxes[0].track_id = 99;
boxes[10].track_id = 99;

// 导出 -> 再解析 -> 再 toBoxes，验证 index / track_id / studId / bbox 完整往返
// 注意导出会按编号重排，所以按 index 建映射对比，而不是按位置
const exported = buildExport(boxes, { image: 'x.png', image_width: 2048, image_height: 18611 }, 'x.png');
const reparsed = parsePredJson(JSON.stringify(exported));
const boxes2 = toBoxes(reparsed.studs);

const map1 = new Map(boxes.map((b) => [b.index!, b]));
let idxOk = boxes2.length === boxes.length;
let trackOk = true;
let bboxOk = true;
for (const b of boxes2) {
  const orig = map1.get(b.index!);
  if (!orig) {
    idxOk = false;
    continue;
  }
  if (orig.track_id !== b.track_id) trackOk = false;
  if (orig.studId !== b.studId) trackOk = false;
  for (let k = 0; k < 4; k++) {
    if (Math.abs(orig.bbox[k] - b.bbox[k]) > 0.011) bboxOk = false;
  }
}

console.log(`boxes: ${boxes.length} -> ${boxes2.length}`);
console.log(`index preserved: ${idxOk ? 'OK' : 'FAILED'} (indexed ${boxes2.filter((b) => b.index != null).length})`);
console.log(`track_id / studId preserved: ${trackOk ? 'OK' : 'FAILED'}`);
console.log(`bbox preserved (2 decimals): ${bboxOk ? 'OK' : 'FAILED'}`);

// 导入原始 JSON 时编号应为 null、studId 与原 id 一致
const raw = toBoxes(json.studs);
const noIdx = raw.every((b) => b.index === null);
const idsOk = raw.every((b, i) => b.studId === json.studs[i].id);
console.log(`raw json import (no index): ${noIdx ? 'OK' : 'FAILED'}`);
console.log(`studId round trip: ${idsOk ? 'OK' : 'FAILED'}`);
console.log(`export fields: ${Object.keys(exported.studs[0] as Record<string, unknown>).join(', ')}`);

/* ---------- 2) 旧格式 predictions.json：没有 id / index / track_id ---------- */
const legacy = parsePredJson(readFileSync('public/predictions.json', 'utf8'));
const lbox = toBoxes(legacy.studs);
const noIds = lbox.every((b) => b.studId === null);
const noIdxLegacy = lbox.every((b) => b.index === null);
const noTracks = lbox.every((b) => !b.hasTrack);
console.log(`\nlegacy predictions.json: ${lbox.length} boxes`);
console.log(`no fabricated studId: ${noIds ? 'OK' : 'FAILED'}`);
console.log(`no index: ${noIdxLegacy ? 'OK' : 'FAILED'}`);
console.log(`no fabricated track: ${noTracks ? 'OK' : 'FAILED'}`);

// 导出时不能凭空多出 id / track_id 字段
const lexport = buildExport(lbox, {}, 'x.png');
const legacyHasId = (lexport.studs[0] as Record<string, unknown>).id !== undefined;
const legacyHasTrack = (lexport.studs[0] as Record<string, unknown>).track_id !== undefined;
console.log(`export has no invented id: ${legacyHasId ? 'FAILED' : 'OK'}`);
console.log(`export has no invented track_id: ${legacyHasTrack ? 'FAILED' : 'OK'}`);
console.log(`legacy export fields: ${Object.keys(lexport.studs[0] as Record<string, unknown>).join(', ')}`);
