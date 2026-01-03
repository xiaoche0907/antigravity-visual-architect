/**
 * 模型资产管理系统 - 类型定义
 * 支持文本/图像模型的分离管理
 */

// 模型分类：严格区分文本、图像和多模态
// 模型分类：严格区分文本、图像和多模态
export type ModelCategory = 'text' | 'image' | 'multimodal';

// 提供商类型
// cspell:ignore aliyun volcengine modelscope jiekou grsai qwen wanx doubao deepseek imagen dall Tongyi stabilityai Zhipu
export type ProviderType = 'google' | 'openai' | 'aliyun' | 'volcengine' | 'modelscope' | 'custom' | 'openai-compatible' | 'jiekou' | 'grsai';

/**
 * 模型配置接口 - 每个配置都是一个独立的资产
 */
export interface ModelConfig {
    id: string;              // UUID，唯一标识
    name: string;            // 用户自定义名称 (如 "我的阿里百炼")
    category: ModelCategory; // 核心分类：文本 or 图像
    provider: ProviderType;  // 提供商类型
    apiKey: string;          // API 密钥
    baseUrl: string;         // API 地址
    modelId: string;         // 具体模型ID (如 qwen-max, wanx-v1)
    isEnabled: boolean;      // 启用状态
    isDefault?: boolean;     // 是否为该分类的默认模型
    createdAt?: number;      // 创建时间戳
    updatedAt?: number;      // 更新时间戳
}

/**
 * 各提供商的默认配置
 */
export const PROVIDER_DEFAULTS: Record<ProviderType, { baseUrl: string; name: string }> = {
    google: {
        name: 'Google Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com'
    },
    aliyun: {
        name: '阿里百炼',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1'
    },
    volcengine: {
        name: '火山引擎 (Volcengine)',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
    },
    modelscope: {
        name: 'ModelScope (阿里魔搭)',
        baseUrl: 'https://api-inference.modelscope.cn/v1'
    },
    'openai-compatible': {
        name: 'OpenAI 兼容协议 (通用)',
        baseUrl: ''
    },
    jiekou: {
        name: '接口AI (Jiekou)',
        baseUrl: 'https://api.jiekou.ai/v3'
    },
    custom: {
        name: '自定义',
        baseUrl: ''
    },
    grsai: {
        name: 'Grsai',
        baseUrl: 'https://grsaiapi.com'
    }
};

// 暂时空置，稍后在 UI 中处理
export const RECOMMENDED_MULTIMODAL_MODELS: Record<ProviderType, string[]> = {
    google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    aliyun: ['qwen-vl-max', 'qwen-vl-plus'],
    openai: ['gpt-4o', 'gpt-4-turbo'],
    volcengine: [],
    modelscope: [
        'Qwen/Qwen3-VL-235B-A22B-Instruct',
        'Qwen/Qwen2-VL-72B-Instruct',
        'Qwen/Qwen2-VL-7B-Instruct'
    ],
    'openai-compatible': [],
    jiekou: [],
    grsai: [],
    custom: []
};

/**
 * 推荐的文本模型列表（按提供商）
 */
export const RECOMMENDED_TEXT_MODELS: Record<ProviderType, string[]> = {
    google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
    aliyun: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini'],
    volcengine: ['doubao-pro-32k', 'doubao-lite-4k', 'ep-20241228-xxxxx'],
    modelscope: ['ZhipuAI/GLM-4.7', 'Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-Coder-32B-Instruct'],
    'openai-compatible': ['deepseek-chat', 'moonshot-v1-8k', 'yi-large', 'llama2'],
    jiekou: [],
    grsai: ['gemini-3-pro', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    custom: []
};

/**
 * 推荐的图像模型列表（按提供商）
 */
export const RECOMMENDED_IMAGE_MODELS: Record<ProviderType, string[]> = {
    google: ['imagen-3.0-generate-001', 'gemini-1.5-pro-vision'],
    aliyun: ['wanx-v1', 'wanx-sketch-to-image-v1', 'wanx-style-repaint-v1'],
    openai: ['dall-e-3', 'dall-e-2'],
    volcengine: [],
    modelscope: ['Tongyi-MAI/Z-Image-Turbo', 'Tongyi-MAI/Z-Image', 'stabilityai/stable-diffusion-xl', 'stabilityai/stable-diffusion-3-medium'],
    'openai-compatible': ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview'],
    jiekou: ['gemini-3-pro-image-text-to-image', 'gemini-3-pro-image-edit'],
    grsai: [
        'nano-banana-fast',      // 快速版
        'nano-banana',           // 标准版
        'nano-banana-pro',       // 专业版
        'nano-banana-pro-vt',    // 专业版 VT
        'nano-banana-pro-cl',    // 专业版 CL
        'nano-banana-pro-vip',   // VIP 版
        'nano-banana-pro-4k-vip' // 4K VIP 版
    ],
    custom: []
};

/**
 * 生成UUID（简化版本）
 */
export function generateModelId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建默认模型配置
 */
export function createDefaultModelConfig(
    category: ModelCategory,
    provider: ProviderType
): Omit<ModelConfig, 'apiKey'> {
    const defaults = PROVIDER_DEFAULTS[provider];
    const recommendedModels = category === 'text'
        ? RECOMMENDED_TEXT_MODELS[provider]
        : category === 'image'
            ? RECOMMENDED_IMAGE_MODELS[provider]
            : RECOMMENDED_MULTIMODAL_MODELS[provider];

    return {
        id: generateModelId(),
        name: `${defaults.name} - ${category === 'text' ? '文本' : category === 'image' ? '图像' : '多模态'}`,
        category,
        provider,
        baseUrl: defaults.baseUrl,
        modelId: recommendedModels[0] || '',
        isEnabled: false,
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

/**
 * 验证模型配置
 */
export function validateModelConfig(config: Partial<ModelConfig>): string[] {
    const errors: string[] = [];

    if (!config.name?.trim()) {
        errors.push('显示名称不能为空');
    }

    if (!config.category) {
        errors.push('必须选择模型分类');
    }

    if (!config.provider) {
        errors.push('必须选择提供商');
    }

    if (!config.apiKey?.trim()) {
        errors.push('API 密钥不能为空');
    }

    if (!config.baseUrl?.trim()) {
        errors.push('API 地址不能为空');
    }

    if (!config.modelId?.trim()) {
        errors.push('模型ID不能为空');
    }

    return errors;
}
