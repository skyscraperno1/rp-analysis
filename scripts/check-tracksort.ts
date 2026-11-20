import { readFileSync } from 'node:fs';
import { parsePredJson, toBoxes } from '../src/lib/jsonio';
import { recomputeTracks, DEFAULT_TRACK_TOLERANCE } from '../src/lib/tracksort';

const boxes = toBoxes(parsePredJson(readFileSync('public/studs.json', 'utf8')).studs);

let fails = 0;
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) fails++;
  console.log(`${name}: ${ok ? 'OK' : 'FAILED'}${extra ? ` (${extra})` : ''}`);
};

// 1) 干净数据上必须恒等：重算结果与算法给的 track_id 完全一致
const clean = recomputeTracks(boxes);
check(
  'clean data is identity',
  clean.changed === 0 && clean.trackCount === 18 && boxes.every((b, i) => b.track_id === clean.boxes[i].track_id),
  `${clean.trackCount} tracks / ${clean.changed} changed`,
);
console.log(`  per-track sizes: ${clean.sizes.join(',')}`);

// 2) 打乱所有 track_id 后必须完全恢复
const shuffled = boxes.map((b) => ({ ...b, track_id: (b.studId * 7919) % 97 }));
const r1 = recomputeTracks(shuffled);
check('shuffled ids recover', r1.trackCount === 18 && r1.boxes.every((b, i) => b.track_id === clean.boxes[i].track_id), `${r1.changed} changed`);

// 3) 全部并成一条轨道（算法彻底给错）后必须重新分开
const one = boxes.map((b) => ({ ...b, track_id: 0 }));
const r2 = recomputeTracks(one);
check('all-in-one-track recovers', r2.trackCount === 18 && r2.boxes.every((b, i) => b.track_id === clean.boxes[i].track_id));

// 4) 移动一个点到另一列的 x 上，它应该改旗易帜，且其后列号顺延
const moved = boxes.map((b, i) =>
  i === 5
    ? { ...b, bbox: [b.bbox[0] + 400, b.bbox[1], b.bbox[2] + 400, b.bbox[3]] as [number, number, number, number] }
    : b,
);
const r3 = recomputeTracks(moved);
check('moved point changes track', r3.boxes[5].track_id !== moved[5].track_id, `#${moved[5].studId} ${moved[5].track_id}->${r3.boxes[5].track_id}`);
console.log(`  moves: ${r3.moves.map((m) => `${m.studId}:${m.from}->${m.to}`).join(' ')}`);

// 5) 删掉一整列，列数减少
const r4 = recomputeTracks(boxes.filter((b) => b.track_id !== 3));
check('deleted track reduces count', r4.trackCount === 17, `${r4.trackCount} tracks`);

// 6) 新增一个远离所有列的点，自成一列
const extra = [...boxes, { ...boxes[0], id: 'new', studId: 9999, track_id: 0, bbox: [1900, 10, 1990, 100] as [number, number, number, number] }];
const r5 = recomputeTracks(extra);
check('new far point gets own track', r5.trackCount === 19 && r5.boxes[extra.length - 1].track_id === 18);

// 7) 入参不被修改
const before = boxes.map((b) => b.track_id).join(',');
recomputeTracks(shuffled);
check('input not mutated', boxes.map((b) => b.track_id).join(',') === before);

// 8) 幂等：连按两次结果一样
const twice = recomputeTracks(recomputeTracks(shuffled).boxes);
check('idempotent', twice.changed === 0);

// 9) 容差敏感性：本数据有效窗口约 (15.2, 31.9)
console.log(`\ntolerance sweep (default ${DEFAULT_TRACK_TOLERANCE}px):`);
for (const tol of [10, 22, 40, 60]) {
  console.log(`  tol=${tol}px -> ${recomputeTracks(boxes, { tolerance: tol }).trackCount} tracks`);
}

// 10) 显式偏移量：自动聚类 → 取其偏移量再显式分配，结果应一致
const autoCols = clean.cols.map((c) => c.offset);
const explicitRes = recomputeTracks(boxes, { offsets: autoCols });
check(
  'explicit-offsets reassignment identical',
  explicitRes.trackCount === clean.trackCount && explicitRes.boxes.every((b, i) => b.track_id === clean.boxes[i].track_id),
  `${explicitRes.trackCount} tracks / ${explicitRes.changed} changed`,
);

// 11) 把某一列的偏移量推到左侧空白处，该列点全部散出（手工修正偏移量的效果）
const pushed = autoCols.slice();
pushed[5] = pushed[5] - 500;
const pushRes = recomputeTracks(boxes, { offsets: pushed });
check('pushed offset empties column', pushRes.cols[5].size === 0, `col5 size ${clean.cols[5].size} => ${pushRes.cols[5].size}`);

// 12) 空列占一个轨道号：偏移量列表和轨道号保持 1:1，其余列号不动
const withHole = recomputeTracks(boxes, { offsets: [...autoCols, autoCols[autoCols.length - 1] + 500] });
const hole = withHole.cols[withHole.cols.length - 1];
check(
  'empty column keeps its slot',
  withHole.trackCount === clean.trackCount + 1 &&
    withHole.cols.length === autoCols.length + 1 &&
    hole.size === 0 &&
    hole.trackId === clean.trackCount &&
    withHole.boxes.every((b, i) => b.track_id === clean.boxes[i].track_id),
  `${withHole.trackCount} tracks / last col #${hole.trackId} size ${hole.size}`,
);

console.log(`\n${fails === 0 ? 'ALL OK' : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
