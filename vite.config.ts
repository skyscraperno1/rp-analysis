import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 避免预打包依赖（如 lucide-react）加载到第二份 React 副本，导致 Invalid hook call
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '127.0.0.1',
  port: 5173,
  // IndexedDB 按 origin（含端口）隔离，端口一漂记住的文件句柄就"丢"了，锁死
  strictPort: true,
    // 本机路径含中文，系统文件监听会漏事件，改用轮询确保 HMR 可靠
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
});
