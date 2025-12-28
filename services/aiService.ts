
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

export const generateVisual = async (prompt: string, imageModel: ModelConfig | null, config: AppConfig): Promise<string> => {
    if (config.mockMode) return `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/1024/1024`;
    if (!imageModel) throw new Error("无图像模型");

    try {
        if (imageModel.provider === 'google') {
            // Placeholder for Google Imagen as current SDK usage is text-centric or requires specific beta endpoints
            return "https://via.placeholder.com/1024?text=Google+Imagen+Placeholder";
        }

        const endpoint = imageModel.provider === 'aliyun' ? imageModel.baseUrl : `${imageModel.baseUrl}/images/generations`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${imageModel.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: imageModel.modelId,
                prompt,
                n: 1,
                size: "1024x1024"
            })
        });
        const data = await res.json();
        return data.data?.[0]?.url || data.output?.url || "https://via.placeholder.com/1024?text=Generation+Failed";
    } catch (e) {
        return "https://via.placeholder.com/1024?text=Error";
    }
};

// ... keep other helpers like verify connection if needed, but for now focus on the critical fixes
export const fetchAvailableModels = async (
    provider: BrainProvider,
    baseUrl: string,
    apiKey: string,
    filterKeywords?: string[]
): Promise<string[]> => {
    // Simplified checker
    return ['gpt-4o', 'gemini-pro', 'claude-3-5-sonnet'];
};
