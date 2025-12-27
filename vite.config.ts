import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 🔴 关键修复：填补 process 变量缺失导致的黑屏
  define: {
    'process.env': {},
  },
  server: {
    port: 3000, // 强制使用 3000 端口
  }
})