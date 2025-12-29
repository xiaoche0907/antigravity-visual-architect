import React, { useState, useEffect } from 'react';
import {
    ModelConfig,
    ModelCategory,
    ProviderType,
    PROVIDER_DEFAULTS,
    RECOMMENDED_TEXT_MODELS,
    RECOMMENDED_IMAGE_MODELS,
    generateModelId,
    validateModelConfig
} from '../types/models';

interface ModelEditFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: ModelConfig) => void;
    editingModel?: ModelConfig | null;
    currentCategory: ModelCategory;
}

const ModelEditForm: React.FC<ModelEditFormProps> = ({
    isOpen,
    onClose,
    onSave,
    editingModel,
    currentCategory
}) => {
    const [formData, setFormData] = useState<Partial<ModelConfig>>({
        category: currentCategory,
        provider: 'aliyun',
        isEnabled: true
    });

    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [filteredModels, setFilteredModels] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [showPassword, setShowPassword] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // 初始化表单数据
    useEffect(() => {
        if (editingModel) {
            setFormData(editingModel);
        } else {
            setFormData({
                category: currentCategory,
                provider: 'aliyun',
                baseUrl: PROVIDER_DEFAULTS.aliyun.baseUrl,
                isEnabled: true
            });
        }
    }, [editingModel, currentCategory, isOpen]);

    // 当提供商变更时，自动填充默认 BaseUrl (除非是需要完全自定义的提供商)
    useEffect(() => {
        if (formData.provider && !editingModel) {
            const defaults = PROVIDER_DEFAULTS[formData.provider];
            // 对于 openai-compatible 和 custom，不自动填充，让用户完全控制
            if (formData.provider !== 'openai-compatible' && formData.provider !== 'custom') {
                setFormData(prev => ({
                    ...prev,
                    baseUrl: defaults.baseUrl
                }));
            } else {
                // 清空 baseUrl，由用户手动输入
                setFormData(prev => ({
                    ...prev,
                    baseUrl: ''
                }));
            }
        }
    }, [formData.provider, editingModel]);

    // 过滤模型列表
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredModels(availableModels);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredModels(
                availableModels.filter(model =>
                    model.toLowerCase().includes(query)
                )
            );
        }
    }, [searchQuery, availableModels]);

    const handleInputChange = (field: keyof ModelConfig, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setErrors([]);
    };

    const handleProviderChange = (provider: ProviderType) => {
        const defaults = PROVIDER_DEFAULTS[provider];
        setFormData(prev => ({
            ...prev,
            provider,
            baseUrl: defaults.baseUrl,
            modelId: '' // 清空模型ID，让用户重新选择
        }));
        setAvailableModels([]); // 清空模型列表
    };

    const handleRefreshModels = async () => {
        if (!formData.apiKey || !formData.baseUrl) {
            setErrors(['请先填写 API 密钥和地址']);
            return;
        }

        setIsLoadingModels(true);
        setErrors([]);

        try {
            let models: string[] = [];

            // === Google Gemini 解锁逻辑 ===
            if (formData.provider === 'google') {
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${formData.apiKey}`;

                const response = await fetch(endpoint);
                if (!response.ok) {
                    throw new Error(`Google API 错误: ${response.statusText}`);
                }

                const data = await response.json();

                // 唯一过滤：supportedGenerationMethods 包含 generateContent
                models = (data.models || [])
                    .filter((m: any) =>
                        m.supportedGenerationMethods?.includes('generateContent')
                    )
                    .map((m: any) => m.name.replace('models/', ''));
            }

            // === OpenAI 解锁逻辑 ===
            else if (formData.provider === 'openai') {
                let endpoint = formData.baseUrl;
                if (!endpoint.endsWith('/models')) {
                    endpoint = `${endpoint.replace(/\/$/, '')}/models`;
                }

                const response = await fetch(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${formData.apiKey}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`OpenAI API 错误: ${response.statusText}`);
                }

                const data = await response.json();
                const allModels = (data.data || []).map((m: any) => m.id);

                // 根据分类智能过滤
                if (formData.category === 'text') {
                    // 文本模型：包含 gpt, chat, o1, davinci, text 等
                    models = allModels.filter((id: string) => {
                        const lower = id.toLowerCase();
                        return lower.includes('gpt') ||
                            lower.includes('chat') ||
                            lower.includes('o1') ||
                            lower.includes('davinci') ||
                            lower.includes('text') ||
                            lower.includes('turbo');
                    });
                } else {
                    // 图像模型：包含 dall-e, image
                    models = allModels.filter((id: string) => {
                        const lower = id.toLowerCase();
                        return lower.includes('dall-e') || lower.includes('image');
                    });
                }
            }

            // === Aliyun (DashScope) 解锁逻辑 ===
            else if (formData.provider === 'aliyun') {
                try {
                    let endpoint = formData.baseUrl;
                    // 尝试 OpenAI-compatible 模式的 /models 端点
                    if (endpoint.includes('compatible-mode')) {
                        endpoint = `${endpoint.replace(/\/$/, '')}/models`;
                    } else {
                        // 如果是原生 DashScope 地址，可能不支持列表，直接fallback
                        throw new Error('DashScope native endpoint');
                    }

                    const response = await fetch(endpoint, {
                        headers: {
                            'Authorization': `Bearer ${formData.apiKey}`
                        }
                    });

                    if (!response.ok) {
                        throw new Error('DashScope API 不支持模型列表');
                    }

                    const data = await response.json();
                    const allModels = (data.data || []).map((m: any) => m.id);

                    // 显示所有 qwen, bailian, wanx 开头的模型
                    models = allModels.filter((id: string) => {
                        const lower = id.toLowerCase();
                        return lower.startsWith('qwen') ||
                            lower.startsWith('bailian') ||
                            lower.startsWith('wanx');
                    });

                    if (models.length === 0) {
                        throw new Error('未找到可用模型');
                    }

                } catch (error) {
                    // Fallback: 使用推荐列表
                    console.warn('DashScope 模型列表获取失败，使用推荐列表:', error);
                    models = formData.category === 'text'
                        ? RECOMMENDED_TEXT_MODELS.aliyun
                        : RECOMMENDED_IMAGE_MODELS.aliyun;
                }
            }

            // === Custom (自定义) - 不过滤！===
            else if (formData.provider === 'custom') {
                let endpoint = formData.baseUrl;
                if (!endpoint.endsWith('/models')) {
                    endpoint = `${endpoint.replace(/\/$/, '')}/models`;
                }

                const response = await fetch(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${formData.apiKey}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`自定义 API 错误: ${response.statusText}`);
                }

                const data = await response.json();

                // 完全不过滤，显示所有模型
                models = (data.data || data.models || []).map((m: any) => m.id || m.name);
            }

            // === Volcengine (火山引擎) - 回退到推荐列表 ===
            else if (formData.provider === 'volcengine') {
                try {
                    let endpoint = formData.baseUrl;
                    if (!endpoint.endsWith('/models')) {
                        endpoint = `${endpoint.replace(/\/$/, '')}/models`;
                    }

                    const response = await fetch(endpoint, {
                        headers: {
                            'Authorization': `Bearer ${formData.apiKey}`
                        }
                    });

                    if (!response.ok) {
                        throw new Error('火山引擎 API 不支持模型列表');
                    }

                    const data = await response.json();
                    models = (data.data || data.models || []).map((m: any) => m.id || m.name);

                    if (models.length === 0) {
                        throw new Error('未找到可用模型');
                    }

                } catch (error) {
                    // Fallback: 使用推荐列表
                    console.warn('火山引擎模型列表获取失败，使用推荐列表:', error);
                    models = formData.category === 'text'
                        ? RECOMMENDED_TEXT_MODELS.volcengine
                        : RECOMMENDED_IMAGE_MODELS.volcengine;

                    // 特别提示：火山引擎通常使用 Endpoint ID
                    setErrors(['💡 火山引擎通常使用推理接入点 ID (Endpoint ID) 作为模型 ID，请手动输入或从下方推荐列表选择']);
                }
            }

            // === ModelScope (阿里魔搭) - 使用推荐列表 ===
            else if (formData.provider === 'modelscope') {
                // ModelScope 异步接口不支持标准的 /models 端点，直接使用推荐列表
                console.log('ModelScope 使用推荐模型列表');
                models = formData.category === 'text'
                    ? RECOMMENDED_TEXT_MODELS.modelscope
                    : RECOMMENDED_IMAGE_MODELS.modelscope;

                if (models.length === 0) {
                    setErrors(['💡 ModelScope 主要用于图像生成，请切换到图像模型分类']);
                } else {
                    setErrors(['💡 ModelScope 使用异步轮询模式生成图像，推荐使用 Z-Image-Turbo']);
                }
            }

            // === OpenAI Compatible (通用兼容) - 优先推荐列表 ===
            else if (formData.provider === 'openai-compatible') {
                try {
                    let endpoint = formData.baseUrl;
                    if (!endpoint.endsWith('/models')) {
                        endpoint = `${endpoint.replace(/\/$/, '')}/models`;
                    }

                    const response = await fetch(endpoint, {
                        headers: {
                            'Authorization': `Bearer ${formData.apiKey}`
                        }
                    });

                    if (!response.ok) {
                        throw new Error('API 不支持模型列表');
                    }

                    const data = await response.json();
                    models = (data.data || data.models || []).map((m: any) => m.id || m.name);

                    if (models.length === 0) {
                        throw new Error('未找到可用模型');
                    }

                } catch (error) {
                    // Fallback: 使用推荐列表
                    console.warn('通用兼容接口模型列表获取失败，使用推荐示例:', error);
                    models = formData.category === 'text'
                        ? RECOMMENDED_TEXT_MODELS['openai-compatible']
                        : RECOMMENDED_IMAGE_MODELS['openai-compatible'];

                    // 提示用户可以手动输入
                    setErrors(['💡 API 不支持模型列表，已显示常见模型示例。您也可以直接手动输入模型 ID']);
                }
            }

            if (models.length === 0) {
                throw new Error('未获取到任何模型，请检查 API 配置或手动输入模型 ID');
            }

            // 排序模型列表
            models.sort();
            setAvailableModels(models);
            setShowDropdown(true);

        } catch (error: any) {
            console.error('获取模型列表失败:', error);
            setErrors([`获取模型列表失败: ${error.message}`]);

            // 即使失败，也显示推荐列表作为fallback
            const fallbackModels = formData.category === 'text'
                ? RECOMMENDED_TEXT_MODELS[formData.provider || 'aliyun']
                : RECOMMENDED_IMAGE_MODELS[formData.provider || 'aliyun'];

            if (fallbackModels && fallbackModels.length > 0) {
                setAvailableModels(fallbackModels);
                setShowDropdown(true);
            }
        } finally {
            setIsLoadingModels(false);
        }
    };

    const handleSubmit = () => {
        const validationErrors = validateModelConfig(formData);

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        const config: ModelConfig = {
            id: editingModel?.id || generateModelId(),
            name: formData.name!,
            category: formData.category!,
            provider: formData.provider!,
            apiKey: formData.apiKey!,
            baseUrl: formData.baseUrl!,
            modelId: formData.modelId!,
            isEnabled: formData.isEnabled ?? true,
            isDefault: formData.isDefault ?? false,
            createdAt: editingModel?.createdAt || Date.now(),
            updatedAt: Date.now()
        };

        onSave(config);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in">
            <div className="bg-[#1e1f20] rounded-3xl border border-[#3c4043] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-in slide-in-from-bottom-8">
                {/* Header */}
                <div className="p-8 border-b border-[#3c4043] bg-gradient-to-b from-[#2a2a2c] to-[#1e1f20] sticky top-0 z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">
                                {editingModel ? '编辑模型配置' : '添加新模型'}
                            </h2>
                            <p className="text-sm text-gray-400">
                                配置 {formData.category === 'text' ? '文本' : '图像'} 模型资产
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors p-2"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Form Content */}
                <div className="p-8 space-y-6">
                    {/* Error Display */}
                    {errors.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                            <div className="flex items-start">
                                <span className="text-red-400 text-xl mr-3">⚠️</span>
                                <div className="flex-1">
                                    <h4 className="text-red-400 font-semibold mb-2">请修正以下错误：</h4>
                                    <ul className="text-sm text-red-300 space-y-1">
                                        {errors.map((err, idx) => (
                                            <li key={idx}>• {err}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 显示名称 */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            显示名称 *
                        </label>
                        <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            placeholder="如: 我的阿里百炼"
                            className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>

                    {/* 提供商选择 */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            提供商 *
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {(Object.keys(PROVIDER_DEFAULTS) as ProviderType[]).map((provider) => (
                                <button
                                    key={provider}
                                    onClick={() => handleProviderChange(provider)}
                                    className={`px-4 py-3 rounded-xl border transition-all text-sm font-medium ${formData.provider === provider
                                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                        : 'bg-[#131314] border-[#3c4043] text-gray-400 hover:border-gray-500'
                                        }`}
                                >
                                    {PROVIDER_DEFAULTS[provider].name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API 密钥 */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            API 密钥 *
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={formData.apiKey || ''}
                                onChange={(e) => handleInputChange('apiKey', e.target.value)}
                                placeholder="输入 API Key"
                                className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 pr-12 text-sm text-white font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {/* API 地址 */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            API 地址 *
                        </label>
                        <input
                            type="text"
                            value={formData.baseUrl || ''}
                            onChange={(e) => handleInputChange('baseUrl', e.target.value)}
                            placeholder={
                                formData.provider === 'openai-compatible' || formData.provider === 'custom'
                                    ? '请输入完整 Base URL，如 https://api.deepseek.com 或 https://ark.cn-beijing.volces.com/api/v3'
                                    : '如: https://dashscope.aliyuncs.com/compatible-mode/v1'
                            }
                            className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                        <p className="text-xs text-gray-500 italic">
                            {formData.provider === 'openai-compatible' || formData.provider === 'custom'
                                ? '💡 请输入完整的 API Base URL (不要包含 /chat/completions)，支持 DeepSeek、Moonshot、Ollama 等任意 OpenAI 兼容接口'
                                : '已根据提供商自动填充推荐地址，可手动修改'
                            }
                        </p>
                    </div>

                    {/* 模型选择 - 升级为 Searchable Combobox */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex justify-between items-center">
                            <span>模型 ID *</span>
                            {isLoadingModels && <span className="text-purple-400 animate-pulse text-[10px]">加载中...</span>}
                        </label>

                        <div className="relative">
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value={formData.modelId || ''}
                                    onChange={(e) => {
                                        handleInputChange('modelId', e.target.value);
                                        setSearchQuery(e.target.value);
                                    }}
                                    onFocus={() => availableModels.length > 0 && setShowDropdown(true)}
                                    placeholder="如: qwen-max 或从列表中选择"
                                    className="flex-1 bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                                <button
                                    onClick={handleRefreshModels}
                                    disabled={isLoadingModels}
                                    className="bg-[#2a2a2c] hover:bg-[#3c3c3e] text-white px-4 py-3 rounded-xl border border-[#3c4043] transition-colors disabled:opacity-50"
                                    title="刷新模型列表"
                                >
                                    {isLoadingModels ? (
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        '🔄'
                                    )}
                                </button>
                            </div>

                            {/* 下拉列表 */}
                            {showDropdown && filteredModels.length > 0 && (
                                <div className="absolute z-20 w-full mt-2 bg-[#1e1f20] border border-[#3c4043] rounded-xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar">
                                    <div className="p-2">
                                        <div className="text-xs text-gray-500 px-3 py-2 flex justify-between items-center">
                                            <span>可用模型 ({filteredModels.length})</span>
                                            <button
                                                onClick={() => setShowDropdown(false)}
                                                className="text-gray-400 hover:text-white"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        {filteredModels.map(modelId => (
                                            <button
                                                key={modelId}
                                                onClick={() => {
                                                    handleInputChange('modelId', modelId);
                                                    setShowDropdown(false);
                                                    setSearchQuery('');
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all ${formData.modelId === modelId
                                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                                    : 'text-gray-300 hover:bg-[#2a2a2c]'
                                                    }`}
                                            >
                                                {modelId}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-gray-500 italic">
                            💡 点击刷新获取完整模型列表，或直接手动输入模型 ID
                        </p>
                    </div>

                    {/* 启用状态 */}
                    <div className="flex items-center justify-between p-4 bg-[#131314] rounded-xl border border-[#3c4043]">
                        <div>
                            <h4 className="text-sm font-semibold text-white">启用此配置</h4>
                            <p className="text-xs text-gray-500 mt-1">
                                只有启用的配置才会在员工页显示
                            </p>
                        </div>
                        <button
                            onClick={() => handleInputChange('isEnabled', !formData.isEnabled)}
                            className={`relative w-14 h-7 rounded-full transition-colors ${formData.isEnabled ? 'bg-green-500' : 'bg-gray-600'
                                }`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${formData.isEnabled ? 'translate-x-7' : 'translate-x-0'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-[#3c4043] bg-[#1e1f20] flex justify-end space-x-4 sticky bottom-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-[#2a2a2c] text-white rounded-xl border border-[#3c4043] hover:bg-[#3c3c3e] transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/50 transition-all font-semibold"
                    >
                        {editingModel ? '保存修改' : '添加模型'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModelEditForm;
