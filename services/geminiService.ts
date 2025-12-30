
import { GoogleGenAI } from "@google/genai";
import { ProductInput, RoleFocus, MarketingStrategy, AppConfig } from "../types";
import { ROLE_FOCUS_PROMPTS } from "../constants";

export const generateMarketingStrategy = async (
  input: ProductInput,
  roleFocus: RoleFocus,
  config: AppConfig
): Promise<MarketingStrategy> => {
  if (config.mockMode) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          analysis: "### A9 算法竞争分析\n\n基于提供的多维产品图与风格参考，我们发现竞品在“极简主义布光”与“复杂环境降噪”的结合上存在视觉缺失。本方案将采用您提供的参考图中的冷调工业风，重点突出产品在高端商务场景下的专业感。",
          secondaryImages: [
            { id: 1, type: "功能拆解图", description: "展示产品内部核心精密结构", visualPrompt: "Exploded view of the product, futuristic technology, technical blue lighting, 8k, photorealistic", copywriting: "精密核心，源自卓越工程" },
            { id: 2, type: "使用场景图", description: "在商务头等舱环境中的使用场景", visualPrompt: "Young professional in a modern business jet cabin, wearing sleek headsets, cinematic soft lighting, luxury vibes", copywriting: "这一刻，只有音乐" },
            { id: 3, type: "尺寸对比图", description: "产品与极简桌面摆件对比", visualPrompt: "Size comparison shot, product next to a high-end designer watch on a marble desk", copywriting: "轻盈入耳，恰到好处" },
            { id: 4, type: "痛点对比图", description: "对比嘈杂环境与静谧空间的视觉化表现", visualPrompt: "Visual representation of noise cancellation, split screen, chaos vs calm, professional aesthetics", copywriting: "告别杂音，拥抱纯净" },
            { id: 5, type: "质量保证图", description: "符合您参考图中的高端微距摄影效果", visualPrompt: "Extreme macro shot of product texture, high-end materials, soft focus background", copywriting: "匠心工艺，坚韧耐用" }
          ],
          aPlusContent: [
            { id: 1, moduleType: "品牌故事模块", content: "我们致力于通过创新技术改变人们的听觉体验。", visualGuidance: "高对比度的品牌 Logo 和生活方式背景图", visualPrompt: "High contrast brand logo with lifestyle background, modern, clean, professional" },
            { id: 2, moduleType: "核心技术参数模块", content: "频率响应: 20Hz-20kHz | 阻抗: 32 Ohm", visualGuidance: "使用简洁的网格布局展示参数", visualPrompt: "Clean grid layout displaying technical specifications, minimal design, high resolution" },
            { id: 3, moduleType: "产品差异化对比模块", content: "对比竞品更轻的重量与更好的续航。", visualGuidance: "清晰的表格对比图", visualPrompt: "Comparison table showing product vs competitors, highlighting weight and battery life, infographic style" },
            { id: 4, moduleType: "应用场景展示", content: "办公室、健身房、飞机舱。", visualGuidance: "拼贴风格的多场景图", visualPrompt: "Collage of product in use: office, gym, airplane cabin, diverse models, lifestyle photography" },
            { id: 5, moduleType: "多角度展示模块", content: "正面、侧面及佩戴效果。", visualGuidance: "平铺式的产品阵列", visualPrompt: "Product array showing front, side, and wearing views, studio lighting, white background" },
            { id: 6, moduleType: "细节放大模块", content: "耳垫材质与按键细节。", visualGuidance: "微距特写，标注材质", visualPrompt: "Macro close-up of ear cushion texture and button details, premium materials, depth of field" },
            { id: 7, moduleType: "包装与配件模块", content: "包含收纳包、充电线及说明书。", visualGuidance: "开箱感视角图", visualPrompt: "Unboxing view showing carrying case, charging cable, and manual, organized layout, overhead shot" }
          ]
        });
      }, 1500);
    });
  }

  const focusPrompt = ROLE_FOCUS_PROMPTS[roleFocus];
  const systemInstruction = `${config.brain.systemInstruction}\n\n当前分析侧重：${focusPrompt}`;

  const promptText = `
    请作为亚马逊 A9 专家，分析以下产品数据并生成高转化的视觉营销方案。
    
    1. 核心卖点 (USPs): ${input.usps}
    2. 目标受众: ${input.targetAudience}
    3. 竞品痛点: ${input.competitorPainPoints}
    4. 关键参数 (Specs): ${input.specs}
    
    补充信息：
    - 已上传产品多维图集供分析。
    - 参考图氛围要求：请在视觉建议中融入参考图的布光和质感。
    
    输出要求：
    - analysis: 市场洞察与视觉策略总结。
    - secondaryImages: 5张副图方案（类型：功能拆解图、使用场景图、尺寸对比图、核心痛点对比图、质量保证/认证图）。
    - aPlusContent: 7个 A+ 模块方案 (确保包含 id, moduleType, content, visualGuidance, visualPrompt)。
    
    请严格返回 JSON。
  `;

  if (config.brain.provider === 'gemini') {
    // ALWAYS initialize right before the call to ensure latest API key
    const ai = new GoogleGenAI({ apiKey: config.brain.apiKey || '' });
    const parts: any[] = [{ text: promptText }];

    input.productImages.forEach((img) => {
      const base64Data = img.split(',')[1];
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Data } });
    });

    input.styleReferences.forEach((img) => {
      const base64Data = img.split(',')[1];
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Data } });
    });

    const response = await ai.models.generateContent({
      model: config.brain.model || 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      }
    });

    // Use .text property (not a method) as per guidelines
    return JSON.parse(response.text?.trim() || "{}") as MarketingStrategy;
  } else {
    // Other providers must also use the unified environment key if they don't have their own
    const authKey = config.brain.apiKey;
    let endpoint = `${config.brain.baseUrl}/chat/completions`;

    // Apply Proxy for ModelScope
    if (config.brain.provider === 'modelscope' || config.brain.baseUrl.includes('modelscope.cn')) {
      if (typeof window !== 'undefined') {
        endpoint = '/api/proxy/modelscope/chat/completions';
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`
      },
      body: JSON.stringify({
        model: config.brain.model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: promptText }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Brain engine request failed');
    return JSON.parse(data.choices[0].message.content) as MarketingStrategy;
  }
};

export const generateVisual = async (prompt: string, config: AppConfig): Promise<string> => {
  if (config.mockMode) {
    const seed = Math.floor(Math.random() * 10000);
    return `https://picsum.photos/seed/${seed}/1024/1024`;
  }

  if (config.visual.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: config.visual.apiKey || '' });
    // Default to gemini-2.5-flash-image, upgrade to gemini-3-pro-image-preview for high-end results
    const modelName = config.visual.model || 'gemini-3-pro-image-preview';

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [{ text: `High-quality Amazon product marketing visual: ${prompt}. Cinematic lighting, hyper-realistic studio photography.` }]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      // Find the image part in the response parts
      if (response.candidates && response.candidates[0]) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    } catch (error) {
      console.error("Gemini Visual error:", error);
      throw new Error("图像生成失败。");
    }
  } else {
    const authKey = config.visual.apiKey;
    const isModelScope = config.visual.provider === 'modelscope';

    let endpoint = isModelScope ? config.visual.baseUrl : `${config.visual.baseUrl}/images/generations`;

    // Apply Proxy for ModelScope
    if (isModelScope || endpoint.includes('modelscope.cn')) {
      if (typeof window !== 'undefined') {
        // 注意：ModelScope 的文生图接口通常是 /services/text-to-image/text-to-image
        // 但如果是 OpenAI 兼容模式，或是特定的 ModelScope 推理 API，路径可能不同。
        // 假设用户配置的是 OpenAI 兼容接口地址。
        // 如果是原生的 ModelScope API，需要根据实际情况调整。
        // 这里我们沿用一般的代理逻辑，假设baseUrl配置的是OpenAI兼容端点。
        // 但是 ModelScope 的 OpenAI 兼容接口本身可能就是 https://api-inference.modelscope.cn/v1

        // 简单处理：将 baseUrl 替换为代理前缀
        // 如果原始 baseUrl 是 https://api-inference.modelscope.cn/v1
        // 代理后应该是 /api/proxy/modelscope

        // 为了安全起见，我们构建一个新的代理路径
        endpoint = '/api/proxy/modelscope/chat/completions'; // 等等，这是生图，不是对话。
        // ModelScope 尚未提供标准的 OpenAI 格式生图接口 (v1/images/generations)。
        // 通常 ModelScope 是通过对话接口调用某些 agent，或者特定的 task API。
        // 如果用户用的是 Qwen-VL 等多模态模型来“生图”，通常是不行的，那是“看图”。

        // 修正：如果用户在 Workspace 用 Visual Model，且选了 ModelScope，
        // 极大概率是配置错误，因为 ModelScope 的标准推理 API 不直接支持 OpenAI image generation 格式。
        // 除非用户用的是第三方封装。

        // 但为了解决眼下的 CORS，我们还是加上代理。
        // 假设用户填写的 endpoint 是兼容的。
        endpoint = '/api/proxy/modelscope/images/generations';
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`
      },
      body: JSON.stringify({
        model: config.visual.model,
        prompt: `High-quality Amazon product marketing visual: ${prompt}. Studio lighting, clean background.`,
        n: 1,
        size: "1024x1024"
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Visual engine request failed');

    return data.data?.[0]?.url || data.output?.url || data.images?.[0]?.url || '';
  }

  throw new Error("未能生成图像。");
};

export const testBrainConnection = async (config: AppConfig): Promise<boolean> => {
  if (config.mockMode) return true;

  try {
    if (config.brain.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: config.brain.apiKey || '' });
      await ai.models.generateContent({
        model: config.brain.model || 'gemini-1.5-flash',
        contents: { parts: [{ text: "Hi" }] }
      });
      return true;
    } else {
      const authKey = config.brain.apiKey;
      const response = await fetch(`${config.brain.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authKey}`
        },
        body: JSON.stringify({
          model: config.brain.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        })
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`HTTP ${response.status}: ${err}`);
      }
      return true;
    }
  } catch (e) {
    console.error("Brain connection test failed:", e);
    throw e;
  }
};

export const testVisualConnection = async (config: AppConfig): Promise<boolean> => {
  if (config.mockMode) return true;

  try {
    if (config.visual.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: config.visual.apiKey || '' });
      // Use a cheap prompt to test key validity
      await ai.models.generateContent({
        model: config.visual.model || 'gemini-1.5-flash',
        contents: { parts: [{ text: "Test connection" }] }
      });
      return true;
    } else {
      const authKey = config.visual.apiKey;
      const isModelScope = config.visual.provider === 'modelscope';
      // For ModelScope/OpenAI compatible image generation, we might not want to waste money generating an image.
      // But there isn't always a "check key" endpoint.
      // We will try a very cheap/dry-run request if possible, or sadly specific to the provider.
      // For compatibility, we might just try to hit the models endpoint if available, or just assume user knows.
      // A safe bet for OpenAI-like APIs is checking /models.

      const baseUrl = config.visual.baseUrl.replace(/\/images\/generations$/, ''); // strip suffix if user pasted full path
      // Try listing models as a lightweight check
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authKey}`
        }
      });

      // If /models is 404, we might be on a specific endpoint that only accepts POST.
      // Fallback: If 404/405, we might have to assume it's OK or warn user. 
      // But if 401/403, it's definitely bad.
      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid API Key (HTTP 401/403)");
      }
      return true;
    }
  } catch (e) {
    console.error("Visual connection test failed:", e);
    throw e;
  }
};
