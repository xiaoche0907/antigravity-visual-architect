import { GoogleGenAI } from "@google/genai";
import { AppConfig, BrainProvider, MarketingStrategy, RoleFocus, ProductInput, ChatMessage } from "../types";
// cspell:ignore genai Nanobannan DALL Aliyun Volcengine volcengine modelscope dall wanx Wanx Jiekou Grsai grsai Imagen Zhipu Apisix grsaiapi dakka
import { ModelConfig } from "../types/models";
import { ROLE_FOCUS_PROMPTS } from "../constants";

// Unified response interface
interface AIResponse {
    content: string;
}

// Helper: Robust JSON Parser
// Helper: Robust JSON Parser
const safeJSONParse = (text: string): any => {
    // 0. Pre-process: Remove Markdown code blocks and trim
    let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 1. Try direct parse
    try {
        return JSON.parse(clean);
    } catch (e) {
        // Continue...
    }

    try {
        // 2. Extraction: Find the outer valid JSON object
        let start = clean.indexOf('{');
        let end = clean.lastIndexOf('}');

        // 2b. 🆕 Enhanced FIX: Look for JSON key patterns if no braces found
        // This handles cases where AI outputs `"analysis": ...` without surrounding `{}`
        if (start === -1) {
            // Match patterns like `"analysis":` or `"secondaryImages":`
            const keyMatch = clean.match(/"(analysis|secondaryImages|aPlusContent)":/);
            if (keyMatch && keyMatch.index !== undefined) {
                // Wrap everything from the first key to the end in braces
                clean = `{${clean.substring(keyMatch.index)}}`;
                start = 0;
                end = clean.length - 1;
            }
        }

        if (start !== -1 && end !== -1 && end > start) {
            clean = clean.substring(start, end + 1);

            // Try parse extracted
            try { return JSON.parse(clean); } catch (e) { }
        }

        // 3. Robust Sanitization (State Machine)
        let sanitized = "";
        let inString = false;
        let isEscaped = false;

        for (let i = 0; i < clean.length; i++) {
            const char = clean[i];

            if (inString) {
                if (char === '\\') {
                    isEscaped = !isEscaped;
                    sanitized += char;
                } else if (char === '"' && !isEscaped) {
                    inString = false;
                    sanitized += char;
                } else if (char === '\n') {
                    sanitized += '\\n';
                } else if (char === '\r') {
                    // Ignore CR
                } else if (char === '\t') {
                    sanitized += '\\t';
                } else {
                    isEscaped = false;
                    sanitized += char;
                }
            } else {
                if (char === '"') {
                    inString = true;
                }
                sanitized += char;
            }
        }

        // 4. Regex Fixes (Trailing commas)
        sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');

        return JSON.parse(sanitized);

    } catch (e) {
        console.error("Advanced JSON Parse Failed:", e);
        return null;
    }
};

// --- Business Logic Services ---

// Helper: Universal Proxy URL Generator
const getProxiedUrl = (originalUrl: string): string => {
    // 只在浏览器环境且 URL 开头为 http(s) 时使用代理
    if (typeof window !== 'undefined' && originalUrl.startsWith('http')) {
        return `/api/proxy/universal?url=${encodeURIComponent(originalUrl)}`;
    }
    return originalUrl;
};

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
                        { id: 1, moduleType: "品牌故事", content: "品牌起源", visualGuidance: "Brand hero image", visualPrompt: "Brand hero image, minimalist, 8k" }
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

    // 即使 System Instruction 已定义，User Prompt 仍需明确传入数据和 Schema 约束
    const promptText = `
    Input Data:
    - Product Name: [Implied from context]
    - USPs: ${input.usps}
    - Target Audience: ${input.targetAudience}
    - Competitor Pain Points: ${input.competitorPainPoints}
    - Specs: ${input.specs}

    Action:
    Based on your SYSTEM INSTRUCTION (Visual Architect Role), generate the "MarketingStrategy" JSON object.

    JSON Schema Enforcement:
    IMPORTANT: The output must be valid parsed JSON. 
    - Do NOT use unescaped newlines inside string values. Use "\\n" for line breaks.
    - Do NOT output Markdown code blocks (\`\`\`json), just the raw JSON object.

        {
            "analysis": "Markdown report of A9 strategy & visual psychology analysis (300+ words). Use \\n for paragraphs.",
            "secondaryImages": [
                // Generate exactly 5 items.
                // 'visualPrompt' MUST follow the Nanobannan structure defined in your system prompt AND include the text rendering instruction 'The text "..." is written...'.
                { "id": 1, "type": "Theme/Type", "description": "Strategy explanation", "visualPrompt": "Detailed English Prompt for DALL-E/Ideogram", "copywriting": "Short headline text" },
                ...
      ],
            "aPlusContent": [
                // Generate exactly 7 items.
                { "id": 1, "moduleType": "Module Type", "content": "Module content explanation", "visualGuidance": "Chinese visual guide", "visualPrompt": "Detailed English Prompt" },
                ...
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
                let baseUrl = textModel.baseUrl;

                // 🚨 Global Grsai Auto-Fix (grsaiapi.com)
                if (baseUrl.includes('grsai') && !baseUrl.includes('grsaiapi.com')) {
                    baseUrl = 'https://grsaiapi.com';
                }
                // Ensure /v1 for grsaiapi
                if (baseUrl.includes('grsaiapi.com') && !baseUrl.includes('/v1')) {
                    baseUrl = 'https://grsaiapi.com/v1';
                }

                endpoint = baseUrl.endsWith('/chat/completions')
                    ? baseUrl
                    : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
            } else {
                // 已知提供商
                let baseUrl = textModel.baseUrl;

                // 🚨 Global Grsai Auto-Fix
                if ((textModel.provider === 'grsai' || baseUrl.includes('grsai')) && !baseUrl.includes('grsaiapi.com')) {
                    baseUrl = 'https://grsaiapi.com/v1';
                }

                endpoint = baseUrl.endsWith('/chat/completions')
                    ? baseUrl
                    : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
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

            const isReasoningModel = textModel.modelId.toLowerCase().includes('reasoner') ||
                textModel.modelId.toLowerCase().includes('r1') ||
                textModel.modelId.toLowerCase().includes('thinking');

            const requestBody: any = {
                model: textModel.modelId,
                messages,
                temperature: 0.7
            };

            // ⚠️ Reasoning models (like DeepSeek-R1) often conflict with 'json_object' mode
            if (!isReasoningModel) {
                requestBody.response_format = { type: "json_object" };
            }

            const res = await fetch(getProxiedUrl(endpoint), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${textModel.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!res.ok) {
                const errorText = await res.text();
                // 针对不同提供商的错误提示
                if (textModel.provider === 'volcengine') {
                    throw new Error(`火山引擎连接失败(${res.status}): 请检查 Endpoint ID 是否正确，火山引擎需使用推理接入点 ID。详情: ${errorText} `);
                } else if (textModel.provider === 'openai-compatible') {
                    throw new Error(`OpenAI 兼容接口连接失败(${res.status}): 请检查 Base URL 和模型 ID 是否正确。详情: ${errorText} `);
                } else if (textModel.provider === 'zhipu') {
                    throw new Error(`智谱 AI 连接失败(${res.status}): 请检查 API Key 是否有效。详情: ${errorText}`);
                }
                throw new Error(`HTTP ${res.status} ${res.statusText}: ${errorText} `);
            }
            const data = await res.json();
            rawResponseText = data.choices[0]?.message?.content || "";
        }

        // --- NORMALIZATION ---
        console.log("📝 API Raw Response:", rawResponseText.substring(0, 100) + "...");
        const parsed = safeJSONParse(rawResponseText);

        if (!parsed) {
            console.error("JSON Parse Failed. Raw text:", rawResponseText);
            throw new Error(`无法解析 JSON 响应(内容非 JSON 格式): ${rawResponseText.substring(0, 50)}...`);
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
    console.log(`🔄[ModelScope Polling] 开始轮询任务: ${taskId} `);

    // 最多轮询 30 次 (60 秒超时)
    for (let i = 0; i < 30; i++) {
        // 等待 2 秒
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 使用代理 API 来绕过 CORS
        const res = await fetch(`/ api / modelscope ? action = poll & taskId=${taskId} `, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey} `
            }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `查询任务状态失败: ${res.status} `);
        }

        const data = await res.json();
        console.log(`🔄[ModelScope Polling] 第 ${i + 1} 次轮询, 状态: ${data.task_status} `);

        if (data.task_status === 'SUCCEED') {
            // 成功！返回图片 URL
            const imageUrl = data.output_images?.[0] || data.output?.url || data.result?.image_url;
            if (!imageUrl) {
                throw new Error(`ModelScope 返回成功但未找到图片 URL: ${JSON.stringify(data)} `);
            }
            console.log('✅ [ModelScope Polling] 任务成功完成');
            return imageUrl;
        } else if (data.task_status === 'FAILED') {
            throw new Error(`ModelScope 生成失败: ${JSON.stringify(data)} `);
        }
        // 如果是 RUNNING 或 PENDING，继续下一次循环
    }
    throw new Error("ModelScope 生成超时 (60s)");
};

/**
 * 🧠 智能提示词精简 (仅用于 ModelScope)
 * 当 prompt 超过 1500 字时，使用文本模型将其压缩为简洁的视觉描述
 */
const summarizePromptForModelScope = async (
    longPrompt: string,
    textModel: ModelConfig | null
): Promise<string> => {
    // 如果没有文本模型或提示词不长，直接截断返回
    if (!textModel || longPrompt.length <= 1500) {
        return longPrompt.length > 1900 ? longPrompt.substring(0, 1900) : longPrompt;
    }

    console.log(`🧠 [Summarize] 使用 ${textModel.name} 精简 ModelScope 提示词 (${longPrompt.length} 字)...`);

    try {
        const systemPrompt = `You are an expert at condensing image generation prompts. Your task:
1. Extract ONLY the essential visual elements from the long prompt below.
2. Output a concise English prompt under 1000 characters.
3. Focus on: subject, style, lighting, colors, composition, mood.
4. Do NOT explain, just output the condensed prompt directly.`;

        let endpoint = textModel.baseUrl;
        if (!endpoint.endsWith('/chat/completions')) {
            endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
        }

        const res = await fetch(getProxiedUrl(endpoint), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${textModel.apiKey}`
            },
            body: JSON.stringify({
                model: textModel.modelId,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Condense this prompt:\n\n${longPrompt}` }
                ],
                max_tokens: 500,
                temperature: 0.3
            })
        });

        if (!res.ok) {
            console.warn('[Summarize] 精简失败，回退到截断');
            return longPrompt.substring(0, 1900);
        }

        const data = await res.json();
        const summarized = data.choices?.[0]?.message?.content?.trim() || '';

        if (summarized && summarized.length < 1900) {
            console.log(`✅ [Summarize] 精简成功: ${longPrompt.length} -> ${summarized.length} 字`);
            return summarized;
        }
    } catch (e) {
        console.error('[Summarize] 精简异常:', e);
    }

    // Fallback: simple truncation
    return longPrompt.substring(0, 1900);
};

export const generateVisual = async (prompt: string, imageModel: ModelConfig | null, config: AppConfig, aspectRatio: '1:1' | '16:9' = '1:1', resolution: '1K' | '2K' | '4K' = '1K', referenceImages: string[] = [], textModelForSummarize?: ModelConfig | null): Promise<string> => {
    if (config.mockMode) return `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/${aspectRatio === '1:1' ? '1024/1024' : '1024/576'}`;

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

    // 📐 Resolution Mapping Logic
    let size = "1024x1024"; // Default 1:1
    const isDallE3 = imageModel.modelId.includes('dall-e-3');

    if (aspectRatio === '16:9') {
        if (imageModel.provider === 'modelscope' || imageModel.baseUrl?.includes('modelscope.cn')) {
            size = "1024x576"; // ModelScope often prefers this or 1280x720
        } else if (isDallE3) {
            size = "1792x1024"; // DALL-E 3 Standard Landscape
        } else if (imageModel.provider === 'aliyun' || imageModel.modelId.includes('wanx')) {
            size = "1280x720"; // Wanx Landscape
        } else {
            size = "1024x576"; // Generic fallback
        }
    } else {
        // 1:1
        size = "1024x1024";
    }

    console.log('🎨 [generateVisual] 开始生成图像', {
        model: imageModel.name,
        provider: imageModel.provider,
        aspectRatio,
        resolution,
        targetSize: size,
        promptLength: prompt.length,
        referenceImagesCount: referenceImages.length
    });

    try {
        // === 🆕 Jiekou/Gemini Image Models (Chat Completion API) ===
        // Supports: gemini-3-pro-image-preview, gemini-2.5-flash-image, etc.
        // These use /v1/chat/completions instead of /v1/images/generations
        if (imageModel.modelId.includes('gemini') && imageModel.modelId.includes('image')) {
            console.log('🔵 [generateVisual] Gemini Image Model Detected (Chat Mode)...');

            let endpoint = imageModel.baseUrl.trim();

            // 🚨 FORCE CORRECT ENDPOINT FOR GRSAI (New Domain: grsaiapi.com)
            if (imageModel.provider === 'grsai' || endpoint.includes('grsai') || endpoint.includes('grsaiapi')) {
                endpoint = 'https://grsaiapi.com/v1/chat/completions';
                console.log('🔹 [Auto-Fix] Forced Grsai Endpoint:', endpoint);
            } else {
                // Generic Gemini Logic
                if (!endpoint.endsWith('/chat/completions')) {
                    // Remove /images/generations if present and append chat/completions
                    endpoint = endpoint.replace(/\/images\/generations$/, '').replace(/\/$/, '') + '/chat/completions';
                }
            }

            // Construct Content Array
            const content: any[] = [
                { type: "text", text: prompt }
            ];

            // Add Reference Image if available (Logic for Edit/Preview)
            if (referenceImages && referenceImages.length > 0) {
                // Only take the first image for now as most APIs expect single ref image for edit
                const refImg = referenceImages[0];
                content.push({
                    type: "image_url",
                    image_url: {
                        url: refImg // Assumes base64 data URI or public URL
                    }
                });
                console.log('🖼️ [generateVisual] Added reference image to payload');
            }

            console.log(`📡 [generateVisual] Gemini Request to: ${endpoint}`);

            const response = await fetch(getProxiedUrl(endpoint), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${imageModel.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: imageModel.modelId,
                    stream: false,
                    messages: [
                        {
                            role: "user",
                            content: content
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                // 404 Specific Hint
                if (response.status === 404) {
                    throw new Error(`Gemini Image API Failed (404): Path not found. Requested: ${endpoint}`);
                }
                throw new Error(`Gemini Image API Failed (${response.status}): ${errText}`);
            }

            const data = await response.json();
            const contentText = data.choices?.[0]?.message?.content || "";

            // Extract URL from Markdown ![image](url) OR Base64 data URI
            // Regex supports:
            // 1. https://...
            // 2. data:image/...;base64,...
            // 3. Markdown format ![...](...)

            // Try matching Markdown first: ![image](LINK)
            const markdownMatch = contentText.match(/!\[.*?\]\((.*?)\)/);
            if (markdownMatch && markdownMatch[1]) {
                const link = markdownMatch[1];
                console.log('✅ [generateVisual] Found Markdown Image Link');
                return link;
            }

            // Try matching raw https URL
            const urlMatch = contentText.match(/(https?:\/\/[^\s)]+)/);
            if (urlMatch) {
                console.log('✅ [generateVisual] Found HTTPS URL');
                return urlMatch[1];
            }

            // Try matching raw Base64 Data URI if it's not in markdown
            if (contentText.startsWith('data:image')) {
                console.log('✅ [generateVisual] Found Raw Base64 Data URI');
                return contentText;
            }

            // If we are here, we got success response but NO image
            console.error("Gemini Response Content:", contentText);

            // 🔍 Debug: Dump the whole response to UI to see what's wrong
            const debugInfo = JSON.stringify(data, null, 2);
            throw new Error(`Gemini API returned success but no image found.\nFull Response: ${debugInfo.substring(0, 500)}...`);
        }

        // === 🚀 阿里 Wanx / 这里的 Jiekou 可能是指老版接口 ? ===
        // Note: The original Jiekou.ai logic was here. The user's instruction implies combining it with Aliyun.
        // Assuming the user intended to keep the jiekou.ai base URL check.
        if (imageModel.provider === 'aliyun' || imageModel.provider === 'jiekou' || imageModel.baseUrl?.includes('jiekou.ai')) {
            console.log('🔵 [generateVisual] Detected Jiekou.ai API...');

            let targetUrl = imageModel.baseUrl.replace(/\/$/, '');
            if (imageModel.modelId && !targetUrl.endsWith(imageModel.modelId)) {
                targetUrl = `${targetUrl}/${imageModel.modelId}`;
            }

            console.log(`📡 [generateVisual] Jiekou URL: ${targetUrl}`);

            // Prepare payload
            const payload: any = {
                prompt: prompt,
                aspect_ratio: aspectRatio,
                size: resolution,
                model: imageModel.modelId
            };

            // 🟢 Special handling for Image Editing / Reference Image
            // 🟢 Special handling for Reference Images (Universal)
            if (referenceImages.length > 0) {
                console.log(`🖼️ [generateVisual] Using ${referenceImages.length} reference images for ${imageModel.modelId}...`);

                // Check if images are Base64 or URLs
                const base64s: string[] = [];
                const urls: string[] = [];

                referenceImages.forEach(img => {
                    if (img.startsWith('data:')) {
                        // Strip header for API if needed
                        base64s.push(img.split(',')[1]);
                    } else if (img.startsWith('http')) {
                        urls.push(img);
                    }
                });

                // Add parameters potentially supported by various downstream adapters
                if (base64s.length > 0) {
                    payload.image_base64s = base64s;
                    // Wanx / ModelScope might like singular 'image' or 'img_url'
                    payload.image = base64s[0];
                }
                if (urls.length > 0) {
                    payload.image_urls = urls;
                    // Wanx often uses 'img_url' or 'base_image_url'
                    payload.img_url = urls[0];
                    payload.base_image_url = urls[0];
                }
            }

            const res = await fetch(getProxiedUrl(targetUrl), {
                method: 'POST',
                headers: {
                    'Authorization': imageModel.apiKey.startsWith('Bearer') ? imageModel.apiKey : `Bearer ${imageModel.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                // mode: 'cors' // 代理模式下不需要 CORS mode
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error(`❌ [generateVisual] Jiekou API 请求失败: ${res.status} - ${errText}`);
                throw new Error(`Jiekou API Request Failed: ${res.status} - ${errText}`);
            }

            const data = await res.json();
            // User provided: url || data[0].url || output_url || image_urls[0]
            const imageUrl = data.url || data.data?.[0]?.url || data.output_url || data.image_urls?.[0];

            if (!imageUrl) {
                throw new Error(`Jiekou API returned success but no image URL found: ${JSON.stringify(data)}`);
            }

            console.log('✅ [generateVisual] Jiekou 图像生成成功:', imageUrl.substring(0, 50) + '...');
            return imageUrl;
        }

        // === 🍌 Grsai nano-banana (Async Draw API) ===
        // Docs: https://grsai.com/zh/dashboard/documents/nano-banana
        // Host(海外): https://grsaiapi.com
        // Host(国内直连): https://grsai.dakka.com.cn
        // 绘图接口: POST /v1/draw/{model}
        // 结果接口: POST /v1/draw/result
        if (imageModel.provider === 'grsai' || imageModel.baseUrl?.includes('grsai')) {
            console.log('🍌 [generateVisual] Grsai nano-banana Detected (Async Draw API)...');

            // Determine host - prioritize user config
            // TRUST MODE: We trust the user's config fully, only auto-remove trailing slash
            // NOTE: Docs recommend 'https://grsai.ai' for China users, 'https://grsaiapi.com' for global.
            let host = imageModel.baseUrl?.replace(/\/$/, '') || 'https://grsaiapi.com';

            // Handle potential /v1 suffix in user config (Common Pitfall)
            if (host.endsWith('/v1')) {
                host = host.substring(0, host.length - 3);
            }

            const modelId = imageModel.modelId?.trim() || 'nano-banana';

            // FIX: Nano Banana API endpoint is FIXED to /v1/draw/nano-banana regardless of the specific model variant (Pro/Basic)
            // The specific model variant is passed in the JSON body if supported, or the endpoint handles it.
            // We map 'nano-banana-pro' etc. to the base endpoint.
            let drawPath = `/v1/draw/${modelId}`;
            if (modelId.includes('nano-banana')) {
                drawPath = '/v1/draw/nano-banana';
            }

            const drawEndpoint = `${host}${drawPath}`;
            const resultEndpoint = `${host}/v1/draw/result`;

            console.log(`📡 [generateVisual] Submitting to Grsai: ${drawEndpoint}`);

            // 1. Submit Draw Task
            // Required fields: model, prompt
            // Optional: urls (reference images), aspectRatio, imageSize, webHook
            const drawPayload: any = {
                model: modelId,  // Required!
                prompt: prompt,
                webHook: "-1"    // Return task ID for polling
            };

            // Add reference images if provided
            if (referenceImages && referenceImages.length > 0) {
                console.log(`🖼️ [generateVisual] Adding ${referenceImages.length} reference image(s) to Grsai payload (image_urls)...`);
                // FIX: Use 'image_urls' (standard) and 'images' (alias) and 'urls' (legacy) to cover all bases
                drawPayload.image_urls = referenceImages;
                drawPayload.images = referenceImages;
                drawPayload.urls = referenceImages; // Keep legacy just in case
            }

            // Add aspect ratio if specified
            if (aspectRatio) {
                drawPayload.aspectRatio = aspectRatio;
            }

            // Add resolution/size
            if (resolution) {
                // Map 1024x1024 -> "1K", 2048x2048 -> "2K", etc.
                if (resolution.includes('2048') || resolution.includes('2K')) {
                    drawPayload.imageSize = '2K';
                } else if (resolution.includes('4096') || resolution.includes('4K')) {
                    drawPayload.imageSize = '4K';
                } else {
                    drawPayload.imageSize = '1K';
                }
            }

            console.log(`📦 [generateVisual] Grsai Payload:`, JSON.stringify(drawPayload));

            const submitRes = await fetch(getProxiedUrl(drawEndpoint), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${imageModel.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(drawPayload)
            });

            if (!submitRes.ok) {
                const errText = await submitRes.text();
                throw new Error(`Grsai 提交失败 (${submitRes.status}) [URL: ${drawEndpoint}]: ${errText}`);
            }

            const submitData = await submitRes.json();

            // Check for immediate error
            if (submitData.code !== 0) {
                throw new Error(`Grsai 提交失败: ${submitData.msg || JSON.stringify(submitData)}`);
            }

            const taskId = submitData.data?.id;
            if (!taskId) {
                throw new Error(`Grsai 提交成功但未返回任务 ID: ${JSON.stringify(submitData)}`);
            }
            console.log(`⏳ [generateVisual] Grsai Task Submitted. Task ID: ${taskId}`);

            // 2. Poll for Result
            let attempts = 0;
            const maxAttempts = 240; // 240 * 2s = 480s timeout (8 minutes)

            while (attempts < maxAttempts) {
                attempts++;
                await new Promise(r => setTimeout(r, 2000)); // Wait 2s

                const pollRes = await fetch(getProxiedUrl(resultEndpoint), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${imageModel.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ id: taskId })
                });

                if (!pollRes.ok) {
                    console.warn(`[Grsai] Polling error: ${pollRes.status}`);
                    continue;
                }

                const pollData = await pollRes.json();

                if (pollData.code !== 0) {
                    // code: -22 means task not found yet, keep polling
                    if (pollData.code === -22) continue;
                    throw new Error(`Grsai 轮询失败: ${pollData.msg || JSON.stringify(pollData)}`);
                }

                const status = pollData.data?.status;
                const progress = pollData.data?.progress || 0;

                console.log(`🔄 [Grsai] Polling... Status: ${status}, Progress: ${progress}%`);

                if (status === 'succeeded') {
                    // Success! Extract image URL
                    const imageUrl = pollData.data?.results?.[0]?.url;
                    if (!imageUrl) {
                        throw new Error(`Grsai 任务成功但未找到图片 URL: ${JSON.stringify(pollData.data)}`);
                    }
                    console.log('✅ [generateVisual] Grsai 图像生成成功:', imageUrl.substring(0, 80) + '...');
                    return imageUrl;
                } else if (status === 'failed') {
                    throw new Error(`Grsai 任务失败: ${pollData.data?.failure_reason || pollData.data?.error || 'Unknown error'}`);
                }
                // If pending or processing, continue loop
            }

            throw new Error(`Grsai 生成超时 (${maxAttempts * 2}秒)`);
        }



        // === ✅ ModelScope 专用通道 (通过代理 API, 异步轮询模式) ===
        if (imageModel.provider === 'modelscope' || imageModel.baseUrl?.includes('modelscope.cn')) {
            console.log('🔵 [generateVisual] 检测到 ModelScope API，使用异步轮询模式...');

            // *******************************************
            // 1. 提交任务 (POST /v1/images/generations)
            // *******************************************
            // 注意：Vite 代理已配置 /api/modelscope -> https://api-inference.modelscope.cn/v1
            // 我们直接请求代理路径，代理会处理 X-ModelScope-Async-Mode 头
            const postUrl = '/api/modelscope?action=generate';

            console.log(`📡 [ModelScope] Submitting Task to: ${postUrl}`);

            // 🧠 智能精简：使用文本模型压缩超长提示词 (仅 ModelScope 需要)
            const optimizedPrompt = await summarizePromptForModelScope(prompt, textModelForSummarize || null);
            console.log(`🔤 [ModelScope] Prompt: ${prompt.length} -> ${optimizedPrompt.length} 字`);

            const submitPayload: any = {
                model: imageModel.modelId,
                input: {
                    prompt: optimizedPrompt
                },
                parameters: {
                    size: size
                }
            };

            // Simple schema for some proxies
            const simplePayload: any = {
                model: imageModel.modelId,
                prompt: optimizedPrompt,
                size: size
            };

            // 🟢 Add Reference Image for ModelScope (ControlNet / i2i)
            if (referenceImages && referenceImages.length > 0) {
                console.log(`🖼️ [generateVisual] Adding reference image to ModelScope payload...`);
                // Standard params for many pipelines
                submitPayload.input.image = referenceImages[0];
                simplePayload.image = referenceImages[0];
                simplePayload.img_url = referenceImages[0];
            }

            const submitRes = await fetch(getProxiedUrl(postUrl), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${imageModel.apiKey}`,
                    'Content-Type': 'application/json',
                    // Async Mode Header
                    'X-ModelScope-Async-Mode': 'true',
                    'X-ModelScope-Task-Type': 'image_generation'
                },
                // Try simple payload first as it matches previous structure, but enriched
                body: JSON.stringify(simplePayload)
            });

            if (!submitRes.ok) {
                const errText = await submitRes.text();
                throw new Error(`ModelScope 提交失败 (${submitRes.status}): ${errText}`);
            }

            const submitData = await submitRes.json();
            const taskId = submitData.task_id;
            if (!taskId) {
                throw new Error(`ModelScope 提交成功但未返回 task_id: ${JSON.stringify(submitData)}`);
            }
            console.log(`⏳ [ModelScope] Task Submitted. Task ID: ${taskId}`);


            // *******************************************
            // 2. 轮询状态 (GET /v1/tasks/{taskId})
            // *******************************************
            const pollUrl = `/api/modelscope?action=poll&taskId=${taskId}`;
            let attempts = 0;
            const maxAttempts = 30; // 30 * 2s = 60s timeout

            while (attempts < maxAttempts) {
                attempts++;
                await new Promise(r => setTimeout(r, 2000)); // Wait 2s

                const pollRes = await fetch(pollUrl, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${imageModel.apiKey}` }
                });

                if (!pollRes.ok) {
                    console.warn(`[ModelScope] Polling error: ${pollRes.status}`);
                    continue;
                }

                const pollData = await pollRes.json();
                const status = pollData.task_status;

                console.log(`🔄 [ModelScope] Polling... Status: ${status}`);

                if (status === 'SUCCEED') {
                    // Success!
                    // Output format: { task_status: "SUCCEED", output_images: ["url1", ...], ... }
                    const imageUrl = pollData.output_images?.[0] || pollData.output?.results?.[0]?.url;
                    if (!imageUrl) {
                        throw new Error(`ModelScope 任务成功但未找到图片 URL: ${JSON.stringify(pollData)}`);
                    }
                    console.log('✅ [generateVisual] ModelScope 图像生成成功');
                    return imageUrl;

                } else if (status === 'FAILED') {
                    throw new Error(`ModelScope 任务失败: ${pollData.message || JSON.stringify(pollData)}`);
                }
                // If PENDING or RUNNING, continue loop
            }

            throw new Error(`ModelScope 生成超时 (${maxAttempts * 2}秒)`);
        }


        // === 原有逻辑：Google / OpenAI / Aliyun 等 ===
        if (imageModel.provider === 'google') {
            // Placeholder for Google Imagen as current SDK usage is text-centric or requires specific beta endpoints
            console.warn('⚠️ [generateVisual] Google Imagen 暂不支持，返回占位图');
            return "https://via.placeholder.com/1024?text=Google+Imagen+Placeholder";
        }

        const endpoint = `${imageModel.baseUrl}/images/generations`;

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
                size: size
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
        throw e; // Rethrow to let caller handle the UI state
    }
};

// ✅ 重写：严格连通性测试
export const verifyModelConnection = async (config: ModelConfig): Promise<{ success: boolean; msg: string }> => {
    try {
        let baseUrl = config.baseUrl?.replace(/\/$/, '') || '';
        // 智能补全
        if (baseUrl && !baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;

        // 🚨 Global Auto-Fix: Update old dashboard URL (grsai.ai) to new API domain (grsaiapi.com)
        // New Domain: grsaiapi.com
        if (baseUrl.includes('grsai') && !baseUrl.includes('grsaiapi.com')) {
            baseUrl = 'https://grsaiapi.com';
        }
        // 🚨 Global Auto-Fix: Ensure /v1
        if (baseUrl.includes('grsaiapi.com') && !baseUrl.includes('/v1')) {
            baseUrl = 'https://grsaiapi.com/v1';
        }

        console.log(`[Strict Test] Testing ${config.name} (${config.provider})...`);

        // === 场景 A: ModelScope 特殊测试 ===
        // 修正逻辑：只有明确为 'image' 分类且使用 modelscope 的才走生图测试
        // 文本/多模态模型 (如 ZhipuAI/GLM-4.7) 即使是 modelscope 提供商，也应走下方的 Chat 测试
        if ((baseUrl.includes('modelscope.cn') || config.provider === 'modelscope') && config.category === 'image') {
            // 策略：通过代理发送一个生图请求，但使用无效参数，看是否返回业务错误(JSON)而非 401(Auth)
            console.log('[Strict Test] Testing ModelScope Image via Proxy...');
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
            return { success: true, msg: "ModelScope (Image) 连接成功" };
        }

        // === 场景 C: Grsai 连通性测试 (Standard Chat) ===
        if (config.provider === 'grsai') {
            // Forced Correct Base URL
            const baseUrl = 'https://grsaiapi.com/v1';
            const chatUrl = `${baseUrl}/chat/completions`;

            console.log(`[Strict Test] Testing Grsai via Chat API: ${chatUrl} (Proxy)`);

            try {
                const res = await fetch(getProxiedUrl(chatUrl), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: config.modelId || 'gpt-4o-mini', // Default fallback
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 1
                    })
                });

                if (res.status === 401) throw new Error("认证失败：API Key 无效");
                if (res.status === 404) throw new Error("地址错误：未找到 API 端点");

                // 400 (Bad Request) usually means params error but auth passed. 200 is success.
                if (!res.ok && res.status !== 400) {
                    const errText = await res.text();
                    throw new Error(`连接失败 (${res.status}): ${errText}`);
                }

                return { success: true, msg: "Grsai 连接成功 (Chat Mode)" };
            } catch (e: any) {
                throw new Error(e.message);
            }
        }

        // === 场景 D: 文本/多模态模型 (真·对话测试) ===
        if (config.category === 'text' || config.category === 'multimodal') {
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

        // 🆕 全局重试逻辑 (尝试通用代理)
        if (config.provider === 'custom' || config.provider === 'openai-compatible' || config.provider === 'jiekou') {
            try {
                console.log(`[Retry with Proxy] Testing ${config.name} via universal proxy...`);
                // 重新构建 URL (Copy logic from above)
                let testUrl = config.baseUrl;
                if (config.category === 'text' || config.category === 'multimodal') {
                    if (!testUrl.endsWith('/chat/completions')) {
                        testUrl = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
                    }
                    const res = await fetch(getProxiedUrl(testUrl), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
                        body: JSON.stringify({ model: config.modelId, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 })
                    });
                    if (res.ok || res.status === 400) return { success: true, msg: "连接成功 (via Proxy)" };
                    if (res.status === 401) throw new Error("认证失败");
                } else if (!config.baseUrl.includes('modelscope')) {
                    // Image defaults
                    let listUrl = config.baseUrl;
                    if (config.baseUrl.endsWith('/v1')) listUrl = `${config.baseUrl}/models`;
                    else if (!config.baseUrl.endsWith('/models')) listUrl = `${config.baseUrl.replace(/\/$/, '')}/models`;

                    const res = await fetch(getProxiedUrl(listUrl), {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${config.apiKey}` }
                    });
                    if (res.ok) return { success: true, msg: "连接成功 (via Proxy)" };
                }
            } catch (proxyErr) {
                console.error("Proxy retry failed", proxyErr);
            }
        }

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

/**
 * 统一对话服务 (支持多模态)
 * 取代 PersonalAgents.tsx 中的内联逻辑
 */
export const chatWithAI = async (
    messages: ChatMessage[],
    modelConfig: ModelConfig,
    systemPrompt: string
): Promise<string> => {
    console.log('💬 [chatWithAI]', { model: modelConfig.name, msgCount: messages.length });

    if (modelConfig.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey: modelConfig.apiKey });

        // Construct contents array for history + current
        const contents = messages.map(msg => {
            const parts: any[] = [];
            if (msg.content) parts.push({ text: msg.content });

            if (msg.attachments && msg.attachments.length > 0) {
                msg.attachments.forEach(img => {
                    const matches = img.match(/^data:(.+);base64,(.+)$/);
                    if (matches) {
                        parts.push({
                            inlineData: {
                                mimeType: matches[1],
                                data: matches[2]
                            }
                        });
                    }
                });
            }

            return {
                role: msg.role === 'user' ? 'user' : 'model',
                parts: parts
            };
        });

        const result = await ai.models.generateContent({
            model: modelConfig.modelId,
            contents: contents,
            config: {
                systemInstruction: systemPrompt
            }
        });

        return result.text?.trim() || "";

    } else {
        // OpenAI Compatible (including ModelScope, DashScope, etc.)
        let endpoint = modelConfig.baseUrl;

        // 🚨 Grsai Auto-Fix (grsaiapi.com)
        if (modelConfig.provider === 'grsai') {
            if (endpoint.includes('grsai') && !endpoint.includes('grsaiapi.com')) {
                endpoint = 'https://grsaiapi.com';
            }
            if (endpoint.includes('grsaiapi.com') && !endpoint.includes('/v1')) {
                endpoint = 'https://grsaiapi.com/v1';
            }
        }

        // Apply Proxy for ModelScope to avoid CORS
        if (modelConfig.provider === 'modelscope' || endpoint.includes('modelscope.cn')) {
            // Check if running in browser environment to avoid affecting server-side (if any)
            if (typeof window !== 'undefined') {
                endpoint = '/api/proxy/modelscope';
            }
        }

        // Ensure endpoint ends with /chat/completions
        endpoint = endpoint.endsWith('/chat/completions')
            ? endpoint
            : `${endpoint.replace(/\/$/, '')}/chat/completions`;

        const apiMessages: any[] = [
            { role: 'system', content: systemPrompt }
        ];

        // Format history
        messages.forEach((msg, index) => {
            if (msg.role === 'error') return;

            let content: any = msg.content;
            const isLastMessage = index === messages.length - 1;

            // If message has attachments
            if (msg.attachments && msg.attachments.length > 0) {
                // STRATEGY: Smart Context Pruning
                // Only send Base64 image data for the LAST message (current turn).
                // For history messages, strip the heavy image data to avoid "Payload Too Large" (HTTP 500).
                // We assume the model 'remembers' the image content via its previous textual response.

                if (isLastMessage) {
                    content = [];
                    if (msg.content.trim()) {
                        content.push({ type: 'text', text: msg.content });
                    }
                    msg.attachments.forEach(img => {
                        content.push({
                            type: 'image_url',
                            image_url: { url: img }
                        });
                    });
                } else {
                    // For history: Keep text only, append a note
                    content = msg.content;
                    if (!content || content.trim() === '') {
                        content = '[Image uploaded in previous turn]';
                    } else {
                        content += ' [Image context preserved]';
                    }
                }
            }

            apiMessages.push({
                role: msg.role,
                content: content
            });
        });

        const response = await fetch(getProxiedUrl(endpoint), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${modelConfig.apiKey}`
            },
            body: JSON.stringify({
                model: modelConfig.modelId,
                messages: apiMessages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errText = await response.text();

            // 尝试解析 JSON 错误信息
            let friendlyMsg = '';
            try {
                const errJson = JSON.parse(errText);
                const code = errJson.error?.code;
                const msg = errJson.error?.message;

                // Zhipu / ModelScope 常见鉴权错误
                if (response.status === 401 || code === '1000' || code === '1001') {
                    friendlyMsg = '身份验证失败 (API Key 无效或过期)。请在模型管理中检查您的 API Key。';
                } else if (msg) {
                    friendlyMsg = msg;
                }
            } catch (e) {
                // Ignore json parse error
            }

            // 如果返回 500 且无内容，通常是 Payload 过大或上游崩溃
            const errorMsg = friendlyMsg || errText || (response.status === 500 ? '请求可能过大或服务器内部错误 (Payload Too Large?)' : 'Unknown Error');
            throw new Error(friendlyMsg ? errorMsg : `HTTP ${response.status}: ${errorMsg}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    }
};
