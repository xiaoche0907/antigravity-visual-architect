// cspell:ignore modelscope Tongyi
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * ModelScope 代理 API
 * 解决前端直接调用时的 CORS 问题
 * 
 * 支持两种操作：
 * 1. POST /api/modelscope?action=generate - 提交生图任务
 * 2. GET /api/modelscope?action=poll&taskId=xxx - 轮询任务状态
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, taskId } = req.query;
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || '';
    const baseUrl = 'https://api-inference.modelscope.cn/v1';

    try {
        // === 1. 提交生图任务 ===
        if (action === 'generate' && req.method === 'POST') {
            const { model, prompt, size } = req.body;

            const response = await fetch(`${baseUrl}/images/generations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'X-ModelScope-Async-Mode': 'true'  // 关键：开启异步模式
                },
                body: JSON.stringify({
                    model: model || 'Tongyi-MAI/Z-Image-Turbo',
                    input: { prompt },
                    parameters: {
                        n: 1,
                        ...(size && { size })  // 如果指定了尺寸，则传递
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                return res.status(response.status).json({
                    error: `ModelScope 提交失败: ${errorText}`
                });
            }

            const data = await response.json();
            return res.status(200).json(data);
        }

        // === 2. 轮询任务状态 ===
        if (action === 'poll' && req.method === 'GET' && taskId) {
            const response = await fetch(`${baseUrl}/tasks/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'X-ModelScope-Task-Type': 'image_generation'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                return res.status(response.status).json({
                    error: `查询任务状态失败: ${errorText}`
                });
            }

            const data = await response.json();
            return res.status(200).json(data);
        }

        return res.status(400).json({ error: '无效的请求参数' });

    } catch (error: any) {
        console.error('[ModelScope Proxy] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
