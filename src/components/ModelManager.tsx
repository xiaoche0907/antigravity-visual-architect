import React, { useState } from 'react';
import { ModelConfig, ModelCategory } from '@/types/models';
import ModelEditForm from '@/components/ModelEditForm';
import { fetchAvailableModels } from '@/services/aiService';

interface ModelManagerProps {
    models: ModelConfig[];
    onModelsChange: (models: ModelConfig[]) => void;
}

const ModelManager: React.FC<ModelManagerProps> = ({ models, onModelsChange }) => {
    const [activeTab, setActiveTab] = useState<ModelCategory>('text');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
    const [testingModelId, setTestingModelId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // 根据当前Tab过滤模型
    const filteredModels = models.filter(m => m.category === activeTab);

    const handleAddModel = () => {
        setEditingModel(null);
        setIsFormOpen(true);
    };

    const handleEditModel = (model: ModelConfig) => {
        setEditingModel(model);
        setIsFormOpen(true);
    };

    const handleSaveModel = (newM: ModelConfig) => {
        const existingIndex = models.findIndex(m => m.id === newM.id);
        let updatedModels: ModelConfig[];

        if (existingIndex >= 0) {
            // 编辑现有模型
            updatedModels = [...models];
            updatedModels[existingIndex] = newM;
            showToast('✅ 模型配置已更新');
        } else {
            // 添加新模型
            updatedModels = [...models, newM];
            showToast('✅ 模型已添加成功');
        }

        onModelsChange(updatedModels);
    };

    const handleDeleteModel = (modelId: string) => {
        if (confirm('确定要删除这个模型配置吗？此操作不可恢复。')) {
            const updatedModels = models.filter(m => m.id !== modelId);
            onModelsChange(updatedModels);
            showToast('🗑️ 模型已删除');
        }
    };

    const handleToggleEnabled = (modelId: string) => {
        const updatedModels = models.map(m =>
            m.id === modelId ? { ...m, isEnabled: !m.isEnabled } : m
        );
        onModelsChange(updatedModels);
        const model = models.find(m => m.id === modelId);
        showToast(model?.isEnabled ? '⏸️ 模型已禁用' : '✅ 模型已启用');
    };

    const handleTestConnection = async (model: ModelConfig) => {
        setTestingModelId(model.id);

        try {
            // 使用 aiService 进行真实连接测试
            // 注意：这里只验证模型列表是否可拉取，作为连通性测试
            await fetchAvailableModels(
                model.provider as any,
                model.baseUrl,
                model.apiKey
            );

            showToast(`✅ ${model.name} 连接成功 (Service OK)`);
        } catch (error: any) {
            console.error("Connection Test Failed:", error);
            // 简单的 Mock 回退机制，如果 API 不支持 list models 或者是 mock 模式
            if (model.id.includes('mock')) {
                await new Promise(resolve => setTimeout(resolve, 500));
                showToast(`✅ ${model.name} (Mock) 连接正常`);
            } else {
                showToast(`❌ 连接失败: ${error.message}`);
            }
        } finally {
            setTestingModelId(null);
        }
    };

    return (
        <div className="flex-1 bg-[#0b0b0b] p-10 animate-in fade-in overflow-y-auto custom-scrollbar">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-20 right-10 bg-[#3c4043] text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-4 border border-gray-600 flex items-center">
                    {toastMessage}
                </div>
            )}

            <div className="w-full max-w-7xl mx-auto">
                {/* Header */}
                <div className="pb-6 border-b border-[#3c4043] flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-3">模型资产管理</h2>
                        <p className="text-gray-400">统一管理所有文本和图像模型配置</p>
                    </div>
                    <button
                        onClick={handleAddModel}
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/50 transition-all font-semibold flex items-center space-x-2"
                    >
                        <span className="text-xl">➕</span>
                        <span>添加模型</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex space-x-2 mb-8">
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`flex-1 px-6 py-4 rounded-xl border transition-all flex items-center justify-center space-x-3 ${activeTab === 'text'
                            ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                            : 'bg-[#1e1f20] border-[#3c4043] text-gray-400 hover:border-gray-500'
                            }`}
                    >
                        <span className="text-2xl">📝</span>
                        <div className="text-left">
                            <div className="font-bold">文本模型</div>
                            <div className="text-xs opacity-70">
                                {models.filter(m => m.category === 'text').length} 个配置
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveTab('image')}
                        className={`flex-1 px-6 py-4 rounded-xl border transition-all flex items-center justify-center space-x-3 ${activeTab === 'image'
                            ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                            : 'bg-[#1e1f20] border-[#3c4043] text-gray-400 hover:border-gray-500'
                            }`}
                    >
                        <span className="text-2xl">🎨</span>
                        <div className="text-left">
                            <div className="font-bold">图像模型</div>
                            <div className="text-xs opacity-70">
                                {models.filter(m => m.category === 'image').length} 个配置
                            </div>
                        </div>
                    </button>
                </div>

                {/* Model List */}
                <div className="space-y-4">
                    {filteredModels.length === 0 ? (
                        <div className="bg-[#1e1f20] rounded-2xl border border-dashed border-[#3c4043] p-12 text-center">
                            <div className="text-6xl mb-4">
                                {activeTab === 'text' ? '📝' : '🎨'}
                            </div>
                            <h3 className="text-xl font-semibold text-gray-400 mb-2">
                                暂无{activeTab === 'text' ? '文本' : '图像'}模型配置
                            </h3>
                            <p className="text-sm text-gray-500 mb-6">
                                点击上方"添加模型"按钮创建第一个配置
                            </p>
                            <button
                                onClick={handleAddModel}
                                className="px-6 py-3 bg-[#2a2a2c] text-white rounded-xl border border-[#3c4043] hover:bg-[#3c3c3e] transition-colors inline-flex items-center space-x-2"
                            >
                                <span>➕</span>
                                <span>立即添加</span>
                            </button>
                        </div>
                    ) : (
                        filteredModels.map(model => (
                            <div
                                key={model.id}
                                className={`bg-[#1e1f20] rounded-2xl border p-6 transition-all ${model.isEnabled
                                    ? 'border-[#3c4043] hover:border-gray-600'
                                    : 'border-[#3c4043]/50 opacity-60'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    {/* Left: Model Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-3">
                                            <h3 className="text-xl font-bold text-white">{model.name}</h3>
                                            {model.isDefault && (
                                                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30">
                                                    默认
                                                </span>
                                            )}
                                            {!model.isEnabled && (
                                                <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full border border-gray-500/30">
                                                    已禁用
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-3">
                                            <span className="px-3 py-1 bg-[#131314] text-gray-300 text-xs rounded-full border border-[#3c4043] flex items-center space-x-1">
                                                <span className="opacity-60">提供商:</span>
                                                <span className="font-semibold">{model.provider}</span>
                                            </span>
                                            <span className="px-3 py-1 bg-[#131314] text-gray-300 text-xs rounded-full border border-[#3c4043] font-mono">
                                                {model.modelId}
                                            </span>
                                        </div>

                                        <div className="text-xs text-gray-500 font-mono">
                                            {model.baseUrl}
                                        </div>
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex items-center space-x-2 ml-6">
                                        {/* Test Connection */}
                                        <button
                                            onClick={() => handleTestConnection(model)}
                                            disabled={testingModelId === model.id}
                                            className="px-4 py-2 bg-[#2a2a2c] text-white rounded-xl border border-[#3c4043] hover:bg-[#3c3c3e] transition-colors text-sm flex items-center space-x-2 disabled:opacity-50"
                                            title="测试连接"
                                        >
                                            {testingModelId === model.id ? (
                                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <span>🔗</span>
                                            )}
                                            <span>{testingModelId === model.id ? '测试中' : '测试'}</span>
                                        </button>

                                        {/* Edit */}
                                        <button
                                            onClick={() => handleEditModel(model)}
                                            className="px-4 py-2 bg-[#2a2a2c] text-white rounded-xl border border-[#3c4043] hover:bg-[#3c3c3e] transition-colors text-sm"
                                            title="编辑"
                                        >
                                            ✏️
                                        </button>

                                        {/* Toggle Enable */}
                                        <button
                                            onClick={() => handleToggleEnabled(model.id)}
                                            className={`px-4 py-2 rounded-xl border transition-colors text-sm ${model.isEnabled
                                                ? 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30'
                                                : 'bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30'
                                                }`}
                                            title={model.isEnabled ? '禁用' : '启用'}
                                        >
                                            {model.isEnabled ? '🟢' : '🔴'}
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={() => handleDeleteModel(model.id)}
                                            className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 hover:bg-red-500/20 transition-colors text-sm"
                                            title="删除"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Edit Form Modal */}
            <ModelEditForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleSaveModel}
                editingModel={editingModel}
                currentCategory={activeTab}
            />
        </div>
    );
};

export default ModelManager;
