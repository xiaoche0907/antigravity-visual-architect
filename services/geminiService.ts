
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
            { id: 1, moduleType: "品牌故事模块", content: "我们致力于通过创新技术改变人们的听觉体验。", visualGuidance: "高对比度的品牌 Logo 和生活方式背景图" },
            { id: 2, moduleType: "核心技术参数模块", content: "频率响应: 20Hz-20kHz | 阻抗: 32 Ohm", visualGuidance: "使用简洁的网格布局展示参数" },
            { id: 3, moduleType: "产品差异化对比模块", content: "对比竞品更轻的重量与更好的续航。", visualGuidance: "清晰的表格对比图" },
            { id: 4, moduleType: "应用场景展示", content: "办公室、健身房、飞机舱。", visualGuidance: "拼贴风格的多场景图" },
            { id: 5, moduleType: "多角度展示模块", content: "正面、侧面及佩戴效果。", visualGuidance: "平铺式的产品阵列" },
            { id: 6, moduleType: "细节放大模块", content: "耳垫材质与按键细节。", visualGuidance: "微距特写，标注材质" },
            { id: 7, moduleType: "包装与配件模块", content: "包含收纳包、充电线及说明书。", visualGuidance: "开箱感视角图" }
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
    - aPlusContent: 7个 A+ 模块方案。
    
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
    const response = await fetch(`${config.brain.baseUrl}/chat/completions`, {
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
    const endpoint = isModelScope ? config.visual.baseUrl : `${config.visual.baseUrl}/images/generations`;

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
