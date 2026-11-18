import { useStore } from '../store/useStore';
import { parsePredJson } from './jsonio';

/** 从 URL 加载图片（本地文件用 objectURL） */
export function loadImageFromUrl(url: string, name: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      useStore.getState().setImage({ src: url, width: img.naturalWidth, height: img.naturalHeight, name }, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`图片加载失败: ${name}`));
    img.src = url;
  });
}

export async function loadImageFile(file: File): Promise<HTMLImageElement> {
  return loadImageFromUrl(URL.createObjectURL(file), file.name);
}

export async function loadJsonFile(file: File): Promise<void> {
  const json = parsePredJson(await file.text());
  const st = useStore.getState();
  st.loadPrediction(json);
  const indexed = json.detections.filter((d) => typeof d.index === 'number').length;
  const manual = json.detections.filter((d) => d.manual).length;
  const extra = [
    indexed ? `编号 ${indexed}` : null,
    manual ? `人工 ${manual}` : null,
  ].filter(Boolean);
  st.setNotice(`已导入 ${json.detections.length} 个点位${extra.length ? `（${extra.join('，')}）` : ''}`);
}
