import { useStore } from '../store/useStore';
import { parsePredJson } from './jsonio';

/** 从 URL 加载图片（本地文件用 objectURL） */
export function loadImageFromUrl(url: string, name: string): Promise<HTMLImageElement> {
  const st = useStore.getState();
  st.setLoading(true);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const done = () => useStore.getState().setLoading(false);
    img.onload = () => {
      useStore.getState().setImage({ src: url, width: img.naturalWidth, height: img.naturalHeight, name }, img);
      done();
      resolve(img);
    };
    img.onerror = () => {
      done();
      reject(new Error(`图片加载失败: ${name}`));
    };
    img.src = url;
  });
}

export async function loadImageFile(file: File): Promise<HTMLImageElement> {
  return loadImageFromUrl(URL.createObjectURL(file), file.name);
}

export async function loadJsonFile(file: File): Promise<void> {
  const text = await file.text();
  const json = parsePredJson(text);
  const st = useStore.getState();
  st.loadPrediction(json);
  const tracks = new Set(json.studs.filter((d) => d.hasTrack).map((d) => d.track_id)).size;
  st.setNotice(`已导入 ${json.studs.length} 个点位${tracks > 0 ? ` · ${tracks} 条轨道` : ''}`);
}
