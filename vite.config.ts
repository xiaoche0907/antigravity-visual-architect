import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 自定义插件：处理 ModelScope API 代理
function modelScopeProxyPlugin(): Plugin {
  return {
    name: 'modelscope-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/modelscope')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost');
        const action = url.searchParams.get('action');
        const taskId = url.searchParams.get('taskId');
        const apiKey = req.headers.authorization?.replace('Bearer ', '') || '';
        const baseUrl = 'https://api-inference.modelscope.cn/v1';

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        try {
          // 提交生图任务
          if (action === 'generate' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            await new Promise(resolve => req.on('end', resolve));

            const { model, prompt, size } = JSON.parse(body);

            const response = await fetch(`${baseUrl}/images/generations`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-ModelScope-Async-Mode': 'true'
              },
              body: JSON.stringify({
                model: model || 'Tongyi-MAI/Z-Image-Turbo',
                input: { prompt },
                parameters: { n: 1, ...(size && { size }) }
              })
            });

            const data = await response.json();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = response.ok ? 200 : response.status;
            res.end(JSON.stringify(data));
            return;
          }

          // 轮询任务状态
          if (action === 'poll' && req.method === 'GET' && taskId) {
            const response = await fetch(`${baseUrl}/tasks/${taskId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'X-ModelScope-Task-Type': 'image_generation'
              }
            });

            const data = await response.json();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = response.ok ? 200 : response.status;
            res.end(JSON.stringify(data));
            return;
          }

          res.statusCode = 400;
          res.end(JSON.stringify({ error: '无效的请求参数' }));

        } catch (error: any) {
          console.error('[ModelScope Proxy] Error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), modelScopeProxyPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/api/proxy/google': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy\/google/, '')
      },
      '/api/proxy/openai': {
        target: 'https://api.openai.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy\/openai/, '')
      },
      '/api/proxy/dashscope': {
        target: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy\/dashscope/, '')
      },
      '/api/proxy/modelscope': {
        target: 'https://api-inference.modelscope.cn/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy\/modelscope/, '')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env': {},
  }
})