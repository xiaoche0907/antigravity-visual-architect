
import { GoogleGenAI } from "@google/genai";
import { AppConfig, BrainProvider, MarketingStrategy, RoleFocus, ProductInput } from "../types";
import { ModelConfig } from "../types/models";
import { ROLE_FOCUS_PROMPTS } from "../constants";

// Unified response interface
interface AIResponse {
    content: string;
}

// Helper: Robust JSON Parser
const safeJSONParse = (text: string): any => {
    try {
        // 1. Try direct parse
        return JSON.parse(text);
    } catch (e) {
        // 2. Try cleanup markdown
        try {
            const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(clean);
        } catch (e2) {
            // 3. Try finding first { and last }
            try {
                const start = text.indexOf('{');
                const end = text.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    const extracted = text.substring(start, end + 1);
                    return JSON.parse(extracted);
                }
            } catch (e3) {
                console.error("JSON Parse Failed completely", text);
                return null;
            }
        }
    }
    return null;
};

// --- Business Logic Services ---

export const generateMarketingStrategy = async (
    input: ProductInput,
    roleFocus: RoleFocus,
    textModel: ModelConfig | null,
    config: AppConfig
): Promise<MarketingStrategy> => {
    console.log('📥 [aiService] generateMarketingStrategy called');

    // 🛡️ Default Error Object (Fallback)
    const errorFallback: MarketingStrategy = {
        isError: true,
        errorMessage: "未知错误",
        analysis: "### ⚠️ 分析服务暂时不可用\n\n系统无法从 AI 模型获取有效的结构化数据。请检查网络连接、API Key 或模型配置。",
        secondaryImages: [
            { id: 1, type: "API Error", description: "无法生成图像方案", visualPrompt: "error placeholder", copywriting: "Error" }
        ],
        aPlusContent: []
    };

    if (config.mockMode) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    analysis: "### (Mock) A9 深度分析\n\n系统处于演示模式。基于输入的产品 USPs，我们建议采用极简主义风格...",
                    secondaryImages: [
                        { id: 1, type: "功能爆炸图", description: "展示内部精密结构", visualPrompt: "Exploded view, tech", copywriting: "精密工艺" },
                        { id: 2, type: "生活场景", description: "Coffee shop usage", visualPrompt: "Coffee shop, lifestyle", copywriting: "随时随地" }
                    ],
                    aPlusContent: [
                        { id: 1, moduleType: "品牌故事", content: "品牌起源", visualGuidance: "Brand hero image" }
                    ]
                });
            }, 1000);
        });
    }

    if (!textModel) {
        return { ...errorFallback, errorMessage: "未选择文本模型" };
    }

    const focusPrompt = ROLE_FOCUS_PROMPTS[roleFocus];
    const systemInstruction = `${config.brain.systemInstruction || ''}\n\n当前视角: ${focusPrompt}`;

    const promptText = `
    作为亚马逊 A9 算法专家，请根据以下产品信息生成视觉营销方案。
    必须返回纯 JSON 格式。

    核心卖点: ${input.usps}
    目标受众: ${input.targetAudience}
    竞品痛点: ${input.competitorPainPoints}
    参数: ${input.specs}

    JSON 结构要求:
    {
      "analysis": "Markdown格式的市场洞察与策略分析 (300字以上)",
      "secondaryImages": [
        { "id": 1, "type": "图片类型", "description": "画面描述", "visualPrompt": "英文视觉提示词", "copywriting": "营销文案" },
        ... (共5张)
      ],
      "aPlusContent": [
        { "id": 1, "moduleType": "模块类型", "content": "文本内容", "visualGuidance": "视觉指导" },
         ... (共5-7个)
      ]
    }
    `;

    let rawResponseText = "";

    try {
        // --- API CALL ---
        if (textModel.provider === 'google') {
            const ai = new GoogleGenAI({ apiKey: textModel.apiKey });
            const parts: any[] = [{ text: promptText }];

            // Attach images (limit 2 to avoid payload issues)
            input.productImages.slice(0, 2).forEach(img => {
                parts.push({ inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] } });
            });

            const result = await ai.models.generateContent({
                model: textModel.modelId,
                contents: { parts },
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: 'application/json'
                }
            });
            rawResponseText = result.text?.trim() || "";

        } else {
            // OpenAI Compatible (包括 OpenAI, Aliyun, Volcengine, OpenAI-Compatible, Custom)

            // === 关键: URL 处理策略 ===
            // 对于 openai-compatible，严格使用用户提供的 Base URL，不做任何修改
            // 对于其他已知提供商，保持自动拼接逻辑以保证兼容性
            let endpoint: string;

            if (textModel.provider === 'openai-compatible' || textModel.provider === 'custom') {
                // 通用兼容模式：完全信任用户输入
                // 用户需要自己确保 URL 正确，系统只负责拼接 /chat/completions
                endpoint = textModel.baseUrl.endsWith('/chat/completions')
                    ? textModel.baseUrl
                    : `${textModel.baseUrl.replace(/\/$/, '')}/chat/completions`;
            } else {
                // 已知提供商：使用现有逻辑
                endpoint = textModel.baseUrl.endsWith('/chat/completions')
                    ? textModel.baseUrl
                    : `${textModel.baseUrl.replace(/\/$/, '')}/chat/completions`;
            }

            const messages: any[] = [
                { role: "system", content: systemInstruction },
                { role: "user", content: promptText } // Simplified: logic for images in OpenAI checks type
            ];

            // Image handling for OpenAI compatible
            if (input.productImages.length > 0) {
                const userContent: any[] = [{ type: "text", text: promptText }];
                input.productImages.slice(0, 2).forEach(img => {
                    userContent.push({ type: "image_url", image_url: { url: img } });
                });
                messages[1] = { role: "user", content: userContent };
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${textModel.apiKey}`
                },
                body: JSON.stringify({
                    model: textModel.modelId,
                    messages,
                    temperature: 0.7,
                    response_format: { type: "json_object" }
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                // 针对不同提供商的错误提示
                if (textModel.provider === 'volcengine') {
                    throw new Error(`火山引擎连接失败 (${res.status}): 请检查 Endpoint ID 是否正确，火山引擎需使用推理接入点 ID。详情: ${errorText}`);
                } else if (textModel.provider === 'openai-compatible') {
                    throw new Error(`OpenAI 兼容接口连接失败 (${res.status}): 请检查 Base URL 和模型 ID 是否正确。详情: ${errorText}`);
                }
                throw new Error(`HTTP ${res.status} ${res.statusText}: ${errorText}`);
            }
            const data = await res.json();
            rawResponseText = data.choices[0]?.message?.content || "";
        }

        // --- NORMALIZATION ---
        console.log("📝 API Raw Response:", rawResponseText.substring(0, 100) + "...");
        const parsed = safeJSONParse(rawResponseText);

        if (!parsed) {
            throw new Error("无法解析 JSON 响应");
        }

        // Schema Validation / Patching
        return {
            analysis: parsed.analysis || "API 未返回有效分析内容。",
            secondaryImages: Array.isArray(parsed.secondaryImages) ? parsed.secondaryImages : [],
            aPlusContent: Array.isArray(parsed.aPlusContent) ? parsed.aPlusContent : [],
            isError: false
        };

    } catch (error: any) {
        console.error("❌ generating strategy failed:", error);
        return {
            ...errorFallback,
            errorMessage: error.message,
            rawResponse: rawResponseText
        };
    }
};

// === 🔄 ModelScope 异步任务轮询辅助函数 (通过代理) ===
const pollModelScopeTask = async (taskId: string, apiKey: string): Promise<string> => {
    console.log(`🔄 [ModelScope Polling] 开始轮询任务: ${taskId}`);

    // 最多轮询 30 次 (60 秒超时)
    for (let i = 0; i < 30; i++) {
        // 等待 2 秒
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 使用代理 API 来绕过 CORS
        const res = await fetch(`/api/modelscope?action=poll&taskId=${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `查询任务状态失败: ${res.status}`);
        }

        const data = await res.json();
        console.log(`🔄 [ModelScope Polling] 第 ${i + 1} 次轮询, 状态: ${data.task_status}`);

        if (data.task_status === 'SUCCEED') {
            // 成功！返回图片 URL
            const imageUrl = data.output_images?.[0] || data.output?.url || data.result?.image_url;
            if (!imageUrl) {
                throw new Error(`ModelScope 返回成功但未找到图片 URL: ${JSON.stringify(data)}`);
            }
            console.log('✅ [ModelScope Polling] 任务成功完成');
            return imageUrl;
        } else if (data.task_status === 'FAILED') {
            throw new Error(`ModelScope 生成失败: ${JSON.stringify(data)}`);
        }
        // 如果是 RUNNING 或 PENDING，继续下一次循环
    }
    throw new Error("ModelScope 生成超时 (60s)");
};

export const generateVisual = async (prompt: string, imageModel: ModelConfig | null, config: AppConfig): Promise<string> => {
    if (config.mockMode) return `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/1024/1024`;

    // 🛡️ 防御性检查：确保传入的是图像模型
    if (!imageModel) {
        console.error('❌ [generateVisual] 未提供图像模型配置');
        throw new Error("无图像模型");
    }

    // 🛡️ 关键防御：检查模型类别，防止误用文本模型
    if (imageModel.category !== 'image') {
        console.error('❌ [generateVisual] 错误：尝试使用非图像模型生成图片', {
            modelId: imageModel.id,
            modelName: imageModel.name,
            category: imageModel.category,
            expectedCategory: 'image'
        });
        throw new Error(`模型类别错误：${imageModel.name} 是 ${imageModel.category} 模型，不能用于图像生成`);
    }

    console.log('🎨 [generateVisual] 开始生成图像', {
        model: imageModel.name,
        provider: imageModel.provider,
        promptLength: prompt.length
    });

    try {
        // === ✅ ModelScope 专用通道 (通过代理 API, 异步轮询模式) ===
        if (imageModel.baseUrl?.includes('modelscope.cn')) {
            console.log('🔵 [generateVisual] 检测到 ModelScope API，使用代理进入异步轮询模式...');

            // 1. 通过代理提交任务
            console.log(`📡 [generateVisual] 通过代理提交 ModelScope 任务`);
            const res = await fetch('/api/modelscope?action=generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${imageModel.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: imageModel.modelId || 'Tongyi-MAI/Z-Image-Turbo',
                    prompt: prompt,
                    size: '1024x576'  // 16:9 横图尺寸
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error(`❌ [generateVisual] ModelScope 提交失败:`, errorData);
                throw new Error(errorData.error || `ModelScope 提交失败 (${res.status})`);
            }

            const data = await res.json();
            const taskId = data.task_id;

            if (!taskId) {
                throw new Error(`未获取到 ModelScope Task ID: ${JSON.stringify(data)}`);
            }

            console.log(`✅ [generateVisual] ModelScope 任务已提交, Task ID: ${taskId}`);

            // 2. 开始轮询 (使用代理)
            const imageUrl = await pollModelScopeTask(taskId, imageModel.apiKey);

            console.log('✅ [generateVisual] ModelScope 图像生成成功:', imageUrl.substring(0, 80) + '...');
            return imageUrl;
        }

        // === 原有逻辑：Google / OpenAI / Aliyun 等 ===
        if (imageModel.provider === 'google') {
            // Placeholder for Google Imagen as current SDK usage is text-centric or requires specific beta endpoints
            console.warn('⚠️ [generateVisual] Google Imagen 暂不支持，返回占位图');
            return "https://via.placeholder.com/1024?text=Google+Imagen+Placeholder";
        }

        const endpoint = imageModel.provider === 'aliyun'
            ? imageModel.baseUrl
            : `${imageModel.baseUrl}/images/generations`;

        console.log(`📡 [generateVisual] 调用 ${imageModel.provider} API:`, endpoint);

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${imageModel.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: imageModel.modelId,
                prompt,
                n: 1,
                size: "1024x1024"
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`❌ [generateVisual] API 错误 (${res.status}):`, errorText);
            throw new Error(`图像生成 API 错误 (${res.status}): ${errorText}`);
        }

        const data = await res.json();
        const imageUrl = data.data?.[0]?.url || data.output?.url || "https://via.placeholder.com/1024?text=Generation+Failed";

        console.log('✅ [generateVisual] 图像生成成功:', imageUrl.substring(0, 80) + '...');
        return imageUrl;

    } catch (e: any) {
        console.error('❌ [generateVisual] 图像生成异常:', e);
        throw new Error(`图像生成失败: ${e.message}`);
    }
};

// ✅ 重写：严格连通性测试
export const verifyModelConnection = async (config: ModelConfig): Promise<{ success: boolean; msg: string }> => {
    try {
        let baseUrl = config.baseUrl?.replace(/\/$/, '') || '';
        // 智能补全
        if (baseUrl && !baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;

        console.log(`[Strict Test] Testing ${config.name} (${config.provider})...`);

        // === 场景 A: ModelScope 特殊测试 ===
        if (baseUrl.includes('modelscope.cn') || config.provider === 'modelscope') {
            // 策略：通过代理发送一个生图请求，但使用无效参数，看是否返回业务错误(JSON)而非 401(Auth)
            console.log('[Strict Test] Testing ModelScope via Proxy...');
            const res = await fetch('/api/modelscope?action=generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                // 故意构造错误 input，但保留必要字段以通过初步校验
                body: JSON.stringify({
                    model: 'check-auth-only',
                    prompt: '', // 空 prompt 可能会触发 400
                    size: '1024x1024'
                })
            });

            // 如果返回 401/403，肯定是 Key 错
            if (res.status === 401 || res.status === 403) throw new Error("认证失败：API Key 无效");

            // 如果返回 400 或 200，说明连通了（因为服务器处理了请求）
            // 只要不是 404 (地址错) 或 401 (Key错)，就算通了
            if (res.status === 404) throw new Error("地址错误：未找到 API 端点");

            // 即使是 400 Bad Request (因为我们故意发了错误参数)，也说明连通性没问题，Auth 也没问题
            return { success: true, msg: "ModelScope 连接成功" };
        }

        // === 场景 B: 文本模型 (真·对话测试) ===
        if (config.category === 'text') {
            // Google Gemini 特殊处理 (如果 SDK 未就绪，使用 REST)
            if (config.provider === 'google') {
                // 简单检查
                if (!config.apiKey) throw new Error("API Key 不能为空");
                return { success: true, msg: "Google Gemini 配置格式正确" };
            }

            let chatUrl = config.baseUrl;
            if (!chatUrl.endsWith('/chat/completions')) {
                chatUrl = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
            }

            const res = await fetch(chatUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.modelId,
                    messages: [{ role: 'user', content: 'Hi' }], // 最小 Payload
                    max_tokens: 1 // 极省 Token
                })
            });

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await res.text();
                // 处理 Nginx/Apisix 等网关返回的 HTML 错误页面
                throw new Error(res.status === 404 ? "地址错误 (404 Not Found)" : `非 JSON 响应: ${text.slice(0, 50)}...`);
            }

            const data = await res.json();
            if (!res.ok) {
                // 抛出厂商返回的具体错误信息
                throw new Error(data.error?.message || `Error ${res.status}: ${JSON.stringify(data)}`);
            }

            // 进一步验证结构
            if (!data.choices && !data.id) throw new Error("返回数据格式异常 (无 choices/id)");

            return { success: true, msg: `连接成功！延迟: ${Date.now() % 1000}ms` };
        }

        // === 场景 C: 通用图像模型 (尝试列出模型或验证连通) ===
        // 大多数 OpenAI 兼容接口支持 /models
        let listUrl = baseUrl;
        if (baseUrl.endsWith('/v1')) {
            listUrl = `${baseUrl}/models`;
        } else if (!baseUrl.endsWith('/models')) {
            listUrl = `${baseUrl.replace(/\/$/, '')}/models`;
        }

        const res = await fetch(listUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${config.apiKey}` },
            mode: 'cors'
        });

        if (res.status === 401) throw new Error("认证失败：API Key 无效");
        if (res.status === 404) {
            // 如果 /models 不存在，尝试假设成功，但给出警告
            console.warn("Target does not support /models, assuming success if not 401");
            return { success: true, msg: "连接成功 (未发现模型列表接口，但服务器可达)" };
        }

        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.data) || Array.isArray(data)) {
                return { success: true, msg: "连接成功 (模型列表可用)" };
            }
        }

        throw new Error(`连接失败 (Status ${res.status})。请检查 Base URL 是否正确。`);

    } catch (e: any) {
        console.error("[Connection Test Failed]", e);
        return { success: false, msg: e.message || "未知连接错误" };
    }
};

export const fetchAvailableModels = async (
    provider: BrainProvider,
    baseUrl: string,
    apiKey: string,
    filterKeywords?: string[]
): Promise<string[]> => {
    // 简化的默认列表，实际逻辑可以扩展
    return ['gpt-4o', 'gemini-pro', 'claude-3-5-sonnet'];
};
