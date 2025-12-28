/**
 * 模型资产管理系统 - 类型定义
 * 支持文本/图像模型的分离管理
 */

// 模型分类：严格区分文本和图像
export type ModelCategory = 'text' | 'image';

// 提供商类型
export type ProviderType = 'google' | 'aliyun' | 'openai' | 'volcengine' | 'openai-compatible' | 'custom';

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
    'openai-compatible': {
        name: 'OpenAI 兼容协议 (通用)',
        baseUrl: ''
    },
    custom: {
        name: '自定义',
        baseUrl: ''
    }
};

/**
 * 推荐的文本模型列表（按提供商）
 */
export const RECOMMENDED_TEXT_MODELS: Record<ProviderType, string[]> = {
    google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
    aliyun: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini'],
    volcengine: ['doubao-pro-32k', 'doubao-lite-4k', 'ep-20241228-xxxxx'],
    'openai-compatible': ['deepseek-chat', 'moonshot-v1-8k', 'yi-large', 'llama2'],
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
    'openai-compatible': [],
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
        : RECOMMENDED_IMAGE_MODELS[provider];

    return {
        id: generateModelId(),
        name: `${defaults.name} - ${category === 'text' ? '文本' : '图像'}`,
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
