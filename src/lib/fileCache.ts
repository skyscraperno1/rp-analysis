import { useStore } from '../store/useStore';
import type { RestoreItem } from '../types';
import { kvDelete, kvGet, kvPut } from './db/idb';
import { loadImageFile, loadJsonFile } from './loaders';

/* 记住用户上次选的文件：只存 FileSystemFileHandle —— 一个几百字节的"取件凭证"，
   不存文件内容。句柄可以直接结构化克隆进 IndexedDB，之后 handle.getFile()
   拿到的永远是磁盘上的当前版本，所以文件被外部改过也不会读到旧数据。
   文件本体仍留在用户自己的硬盘上，浏览器不占存储，也不会被清理。 */

export type CacheKind = 'image' | 'json';

/** 取文件弹窗的过滤项 */
const ACCEPT: Record<CacheKind, Array<{ description: string; accept: Record<string, string[]> }>> = {
  image: [{ description: '图片', accept: { 'image/*': [] } }],
  json: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
};

/** 只有 Chromium 系有 File System Access API；别的浏览器返回 false，调用方回退到 <input> */
export function pickerSupported(): boolean {
  return typeof window.showOpenFilePicker === 'function';
}

/* ---------- 权限 ---------- */

/** 这个句柄现在能不能不弹窗直接读 */
async function canRead(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    return (await handle.queryPermission({ mode: 'read' })) === 'granted';
  } catch {
    return false;
  }
}

/** 请求读授权（必须由用户点击触发，页面自己加载时调不了） */
async function askRead(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    return (await handle.requestPermission({ mode: 'read' })) === 'granted';
  } catch {
    return false;
  }
}

/* ---------- 取文件并加载 ---------- */

async function loadFrom(kind: CacheKind, handle: FileSystemFileHandle): Promise<boolean> {
  let file: File;
  try {
    file = await handle.getFile();
  } catch {
    // 文件被移动 / 删除 / 改名：这张卡作废，清掉，别下次再试
    await kvDelete(kind).catch(() => {});
    useStore.getState().setError(`文件已不存在: ${handle.name}`);
    return false;
  }
  try {
    if (kind === 'image') await loadImageFile(file);
    else await loadJsonFile(file);
    return true;
  } catch (e) {
    // 解析失败之类：句柄还是好的，不清缓存，只报错
    useStore.getState().setError(String(e));
    return false;
  }
}

async function refreshCount(): Promise<void> {
  try {
    const [a, b] = await Promise.all([kvGet<FileSystemFileHandle>('image'), kvGet<FileSystemFileHandle>('json')]);
    useStore.getState().setCacheCount((a ? 1 : 0) + (b ? 1 : 0));
  } catch {
    // 库打不开（隐私模式等）就当没记住过
  }
}

/* ---------- 对外 ---------- */

/** 顶栏和引导弹窗共用的"选文件"入口：有 picker 就走 picker 并记住句柄，
 *  否则回退到隐藏的 <input>。同步调用，保住用户手势 */
export function chooseImage(): void {
  if (pickerSupported()) void pickAndLoad('image');
  else document.getElementById('img-input')?.click();
}

export function chooseJson(): void {
  if (pickerSupported()) void pickAndLoad('json');
  else document.getElementById('json-input')?.click();
}

/** 弹系统选择框，选中后记住句柄并加载（调用方需已确认支持 picker） */
async function pickAndLoad(kind: CacheKind): Promise<void> {
  try {
    const [handle] = await window.showOpenFilePicker!({ multiple: false, types: ACCEPT[kind] });
    await kvPut(kind, handle);
    await refreshCount();
    await loadFrom(kind, handle);
  } catch (e) {
    // 用户在选择框里取消，不算错误
    if (e instanceof DOMException && e.name === 'AbortError') return;
    useStore.getState().setError(String(e));
  }
}

/** 启动时恢复：把缓存里记着的文件列进引导弹窗，能直接读的当场加载，
 *  还需要用户点一下的留着「恢复」按钮。全部搞定且数据已就位就自动关掉弹窗 */
export async function restoreOnStart(): Promise<void> {
  if (!pickerSupported()) return;
  let img: FileSystemFileHandle | null = null;
  let js: FileSystemFileHandle | null = null;
  try {
    img = await kvGet<FileSystemFileHandle>('image');
    js = await kvGet<FileSystemFileHandle>('json');
  } catch {
    return; // 库打不开：当没记住过
  }
  if (!img && !js) return;

  const st = useStore.getState();
  const items: RestoreItem[] = [];
  if (img) items.push({ kind: 'image', name: img.name, status: 'loading' });
  if (js) items.push({ kind: 'json', name: js.name, status: 'loading' });
  st.setRestoreItems(items);
  st.setSetupPromptOpen(true);

  const patch = (kind: RestoreItem['kind'], status: RestoreItem['status']) =>
    useStore.getState().setRestoreItems(
      useStore.getState().restoreItems.map((i) => (i.kind === kind ? { ...i, status } : i)),
    );
  const remove = (kind: RestoreItem['kind']) =>
    useStore.getState().setRestoreItems(useStore.getState().restoreItems.filter((i) => i.kind !== kind));

  if (img) {
    if (await canRead(img)) {
      if (await loadFrom('image', img)) patch('image', 'done');
      else remove('image');
    } else patch('image', 'need');
  }
  if (js) {
    if (await canRead(js)) {
      if (await loadFrom('json', js)) patch('json', 'done');
      else remove('json');
    } else patch('json', 'need');
  }

  await refreshCount();
  finishRestore();
}

/** 用户在引导弹窗里点「恢复」：请求授权后加载 */
export async function restoreByClick(kind: RestoreItem['kind']): Promise<void> {
  const handle = await kvGet<FileSystemFileHandle>(kind);
  if (!handle) return;
  if (!(await askRead(handle))) return;
  if (await loadFrom(kind, handle)) {
    useStore.getState().setRestoreItems(
      useStore.getState().restoreItems.map((i) => (i.kind === kind ? { ...i, status: 'done' } : i)),
    );
  } else {
    useStore.getState().setRestoreItems(
      useStore.getState().restoreItems.filter((i) => i.kind !== kind),
    );
  }
  finishRestore();
}

/** 恢复收尾：没有待恢复的条目了就关弹窗；数据还没就位则留着引导选 JSON */
function finishRestore(): void {
  const st = useStore.getState();
  if (st.restoreItems.some((i) => i.status !== 'done')) return;
  if (st.boxes.length > 0) st.setSetupPromptOpen(false);
}

/** 清除缓存：删掉两个句柄。当前画面和标注一动不动 */
export async function clearCache(): Promise<void> {
  try {
    await Promise.all([kvDelete('image'), kvDelete('json')]);
  } catch {
    // 库打不开时库存里本来也没有
  }
  useStore.getState().setRestoreItems([]);
  useStore.getState().setCacheCount(0);
  useStore.getState().setNotice('已清除缓存');
}
