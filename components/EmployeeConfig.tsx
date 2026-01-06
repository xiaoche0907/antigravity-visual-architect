import React, { useState, useEffect, useRef } from 'react';
import { AppConfig, PromptPreset } from '../types';
import { ModelConfig } from '../types/models';
import { DEFAULT_SYSTEM_INSTRUCTION, PROMPT_ENGINEER_SYSTEM_INSTRUCTION } from '../constants';

interface EmployeeConfigProps {
    config: AppConfig;
    setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
    modelConfigs: ModelConfig[];
    selectedBrainModelId: string;
    selectedPromptEngineerModelId: string;
    selectedVisualModelId: string;
    onBrainModelChange: (modelId: string) => void;
    onPromptEngineerModelChange: (modelId: string) => void;
    onVisualModelChange: (modelId: string) => void;
    onNavigateToModels: () => void;
}

const LOCALSTORAGE_KEY = 'custom_amazon_expert_prompt';
const LOCALSTORAGE_PROMPT_ENGINEER_KEY = 'custom_prompt_engineer_instruction';
// 新增预设存储键
const LOCALSTORAGE_BRAIN_PRESETS_KEY = 'brain_prompt_presets';
const LOCALSTORAGE_PE_PRESETS_KEY = 'prompt_engineer_presets';
const LOCALSTORAGE_SELECTED_BRAIN_PRESET_KEY = 'selected_brain_preset_id';
const LOCALSTORAGE_SELECTED_PE_PRESET_KEY = 'selected_pe_preset_id';

const EmployeeConfig: React.FC<EmployeeConfigProps> = ({
    config,
    setConfig,
    modelConfigs,
    selectedBrainModelId,
    selectedPromptEngineerModelId,
    selectedVisualModelId,
    onBrainModelChange,
    onPromptEngineerModelChange,
    onVisualModelChange,
    onNavigateToModels
}) => {
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [promptEngineerSaveStatus, setPromptEngineerSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const promptEngineerSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isInitialLoadRef = useRef(true);

    // 视觉技术总监的系统指令 (Local State)
    const [promptEngineerInstruction, setPromptEngineerInstruction] = useState<string>('');

    // ========== 预设管理状态 ==========
    const [brainPresets, setBrainPresets] = useState<PromptPreset[]>([]);
    const [pePresets, setPePresets] = useState<PromptPreset[]>([]);
    const [selectedBrainPresetId, setSelectedBrainPresetId] = useState<string>('');
    const [selectedPePresetId, setSelectedPePresetId] = useState<string>('');
    const [showBrainPresetInput, setShowBrainPresetInput] = useState(false);
    const [showPePresetInput, setShowPePresetInput] = useState(false);
    const [newBrainPresetName, setNewBrainPresetName] = useState('');
    const [newPePresetName, setNewPePresetName] = useState('');

    // 生成默认预设
    const createDefaultBrainPreset = (): PromptPreset => ({
        id: 'default-brain',
        name: '📋 默认模板 (Skysper)',
        content: DEFAULT_SYSTEM_INSTRUCTION,
        isDefault: true,
        createdAt: Date.now()
    });

    const createDefaultPePreset = (): PromptPreset => ({
        id: 'default-pe',
        name: '📋 默认模板 (Nanobanana)',
        content: PROMPT_ENGINEER_SYSTEM_INSTRUCTION,
        isDefault: true,
        createdAt: Date.now()
    });

    // 过滤可用的模型配置
    const enabledTextModels = modelConfigs.filter(m => m.category === 'text' && m.isEnabled);
    const enabledImageModels = modelConfigs.filter(m => m.category === 'image' && m.isEnabled);

    // 组件加载时：优先从 localStorage 读取，若为空则使用默认模板
    useEffect(() => {
        // ===== 加载预设列表 =====
        const savedBrainPresets = localStorage.getItem(LOCALSTORAGE_BRAIN_PRESETS_KEY);
        const savedPePresets = localStorage.getItem(LOCALSTORAGE_PE_PRESETS_KEY);
        
        // 初始化大脑预设列表
        if (savedBrainPresets) {
            const parsed = JSON.parse(savedBrainPresets) as PromptPreset[];
            // 确保默认预设存在
            if (!parsed.find(p => p.id === 'default-brain')) {
                parsed.unshift(createDefaultBrainPreset());
            }
            setBrainPresets(parsed);
        } else {
            setBrainPresets([createDefaultBrainPreset()]);
        }

        // 初始化PE预设列表
        if (savedPePresets) {
            const parsed = JSON.parse(savedPePresets) as PromptPreset[];
            if (!parsed.find(p => p.id === 'default-pe')) {
                parsed.unshift(createDefaultPePreset());
            }
            setPePresets(parsed);
        } else {
            setPePresets([createDefaultPePreset()]);
        }

        // 加载选中的预设ID
        const savedBrainPresetId = localStorage.getItem(LOCALSTORAGE_SELECTED_BRAIN_PRESET_KEY);
        const savedPePresetId = localStorage.getItem(LOCALSTORAGE_SELECTED_PE_PRESET_KEY);
        if (savedBrainPresetId) setSelectedBrainPresetId(savedBrainPresetId);
        if (savedPePresetId) setSelectedPePresetId(savedPePresetId);

        // ===== 原有逻辑：加载当前指令 =====
        const savedPrompt = localStorage.getItem(LOCALSTORAGE_KEY);
        if (savedPrompt) {
            setConfig(prev => ({
                ...prev,
                brain: { ...prev.brain, systemInstruction: savedPrompt }
            }));
            console.log('✅ [EmployeeConfig] 已从本地存储加载自定义人设');
        } else {
            // 第一次使用，没有保存过的话，使用默认模板并立即保存
            localStorage.setItem(LOCALSTORAGE_KEY, DEFAULT_SYSTEM_INSTRUCTION);
            console.log('📦 [EmployeeConfig] 首次加载，已保存默认模板');
        }

        // 加载 Prompt Engineer 指令
        const savedPEPrompt = localStorage.getItem(LOCALSTORAGE_PROMPT_ENGINEER_KEY);
        if (savedPEPrompt) {
            setPromptEngineerInstruction(savedPEPrompt);
            console.log('✅ [EmployeeConfig] 已加载视觉技术总监指令');
        } else {
            setPromptEngineerInstruction(PROMPT_ENGINEER_SYSTEM_INSTRUCTION);
            localStorage.setItem(LOCALSTORAGE_PROMPT_ENGINEER_KEY, PROMPT_ENGINEER_SYSTEM_INSTRUCTION);
            console.log('📦 [EmployeeConfig] 首次加载，已保存视觉技术总监默认模板');
        }

        isInitialLoadRef.current = false;
    }, []); // 只在组件挂载时执行一次

    // 监听 systemInstruction 变化，自动保存到 localStorage
    useEffect(() => {
        // 跳过初始加载时的保存（避免循环）
        if (isInitialLoadRef.current) return;

        const instruction = config.brain.systemInstruction;
        if (!instruction) return;

        // 防抖保存逻辑
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        setSaveStatus('saving');

        saveTimerRef.current = setTimeout(() => {
            localStorage.setItem(LOCALSTORAGE_KEY, instruction);
            setSaveStatus('saved');
            console.log('💾 [EmployeeConfig] 人设已自动保存到本地存储');

            // 2秒后隐藏"已保存"提示
            setTimeout(() => setSaveStatus('idle'), 2000);
        }, 800); // 800ms 防抖

        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, [config.brain.systemInstruction]);

    // 监听 promptEngineerInstruction 变化，自动保存
    useEffect(() => {
        if (isInitialLoadRef.current) return;
        if (!promptEngineerInstruction) return;

        if (promptEngineerSaveTimerRef.current) {
            clearTimeout(promptEngineerSaveTimerRef.current);
        }

        setPromptEngineerSaveStatus('saving');

        promptEngineerSaveTimerRef.current = setTimeout(() => {
            localStorage.setItem(LOCALSTORAGE_PROMPT_ENGINEER_KEY, promptEngineerInstruction);
            setPromptEngineerSaveStatus('saved');
            console.log('💾 [EmployeeConfig] 视觉技术总监指令已保存');
            setTimeout(() => setPromptEngineerSaveStatus('idle'), 2000);
        }, 800);

        return () => {
            if (promptEngineerSaveTimerRef.current) {
                clearTimeout(promptEngineerSaveTimerRef.current);
            }
        };
    }, [promptEngineerInstruction]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleBrainChange = (field: keyof AppConfig['brain'], value: string) => {
        setConfig(prev => ({
            ...prev,
            brain: { ...prev.brain, [field]: value }
        }));
    };

    const resetToDefaultPersona = () => {
        if (!confirm('⚠️ 确定要恢复为默认亚马逊专家人设吗？当前自定义内容将被覆盖。')) {
            return;
        }
        handleBrainChange('systemInstruction', DEFAULT_SYSTEM_INSTRUCTION);
        localStorage.setItem(LOCALSTORAGE_KEY, DEFAULT_SYSTEM_INSTRUCTION);
        showToast('🔄 已恢复默认人设');
    };

    const resetPromptEngineerToDefault = () => {
        if (!confirm('⚠️ 确定要恢复视觉技术总监的默认指令吗？')) {
            return;
        }
        setPromptEngineerInstruction(PROMPT_ENGINEER_SYSTEM_INSTRUCTION);
        localStorage.setItem(LOCALSTORAGE_PROMPT_ENGINEER_KEY, PROMPT_ENGINEER_SYSTEM_INSTRUCTION);
        showToast('🔄 已恢复视觉技术总监默认指令');
    };

    // ========== 预设管理函数 ==========
    
    // 保存预设列表到 localStorage
    const saveBrainPresetsToStorage = (presets: PromptPreset[]) => {
        localStorage.setItem(LOCALSTORAGE_BRAIN_PRESETS_KEY, JSON.stringify(presets));
    };

    const savePePresetsToStorage = (presets: PromptPreset[]) => {
        localStorage.setItem(LOCALSTORAGE_PE_PRESETS_KEY, JSON.stringify(presets));
    };

    // 保存当前指令为新预设 (大脑)
    const saveBrainAsPreset = () => {
        if (!newBrainPresetName.trim()) {
            showToast('⚠️ 请输入预设名称');
            return;
        }
        const newPreset: PromptPreset = {
            id: `brain-${Date.now()}`,
            name: newBrainPresetName.trim(),
            content: config.brain.systemInstruction,
            isDefault: false,
            createdAt: Date.now()
        };
        const updatedPresets = [...brainPresets, newPreset];
        setBrainPresets(updatedPresets);
        saveBrainPresetsToStorage(updatedPresets);
        setSelectedBrainPresetId(newPreset.id);
        localStorage.setItem(LOCALSTORAGE_SELECTED_BRAIN_PRESET_KEY, newPreset.id);
        setNewBrainPresetName('');
        setShowBrainPresetInput(false);
        showToast(`✅ 已保存预设: ${newPreset.name}`);
    };

    // 保存当前指令为新预设 (PE)
    const savePeAsPreset = () => {
        if (!newPePresetName.trim()) {
            showToast('⚠️ 请输入预设名称');
            return;
        }
        const newPreset: PromptPreset = {
            id: `pe-${Date.now()}`,
            name: newPePresetName.trim(),
            content: promptEngineerInstruction,
            isDefault: false,
            createdAt: Date.now()
        };
        const updatedPresets = [...pePresets, newPreset];
        setPePresets(updatedPresets);
        savePePresetsToStorage(updatedPresets);
        setSelectedPePresetId(newPreset.id);
        localStorage.setItem(LOCALSTORAGE_SELECTED_PE_PRESET_KEY, newPreset.id);
        setNewPePresetName('');
        setShowPePresetInput(false);
        showToast(`✅ 已保存预设: ${newPreset.name}`);
    };

    // 切换预设 (大脑)
    const selectBrainPreset = (presetId: string) => {
        if (!presetId) {
            // 选择了空选项，不做任何操作
            return;
        }
        const preset = brainPresets.find(p => p.id === presetId);
        if (preset) {
            handleBrainChange('systemInstruction', preset.content);
            localStorage.setItem(LOCALSTORAGE_KEY, preset.content);
            setSelectedBrainPresetId(presetId);
            localStorage.setItem(LOCALSTORAGE_SELECTED_BRAIN_PRESET_KEY, presetId);
            showToast(`📋 已切换到: ${preset.name}`);
        }
    };

    // 切换预设 (PE)
    const selectPePreset = (presetId: string) => {
        if (!presetId) {
            // 选择了空选项，不做任何操作
            return;
        }
        const preset = pePresets.find(p => p.id === presetId);
        if (preset) {
            setPromptEngineerInstruction(preset.content);
            localStorage.setItem(LOCALSTORAGE_PROMPT_ENGINEER_KEY, preset.content);
            setSelectedPePresetId(presetId);
            localStorage.setItem(LOCALSTORAGE_SELECTED_PE_PRESET_KEY, presetId);
            showToast(`📋 已切换到: ${preset.name}`);
        }
    };

    // 删除预设 (大脑) - 直接删除，不弹确认框
    const deleteBrainPreset = (presetId: string) => {
        const preset = brainPresets.find(p => p.id === presetId);
        if (!preset) {
            showToast('⚠️ 预设不存在');
            return;
        }
        if (preset.isDefault) {
            showToast('⚠️ 无法删除默认预设');
            return;
        }
        const updatedPresets = brainPresets.filter(p => p.id !== presetId);
        setBrainPresets(updatedPresets);
        saveBrainPresetsToStorage(updatedPresets);
        setSelectedBrainPresetId('');
        localStorage.removeItem(LOCALSTORAGE_SELECTED_BRAIN_PRESET_KEY);
        showToast(`🗑️ 已删除预设: ${preset.name}`);
    };

    // 删除预设 (PE) - 直接删除，不弹确认框
    const deletePePreset = (presetId: string) => {
        const preset = pePresets.find(p => p.id === presetId);
        if (!preset) {
            showToast('⚠️ 预设不存在');
            return;
        }
        if (preset.isDefault) {
            showToast('⚠️ 无法删除默认预设');
            return;
        }
        const updatedPresets = pePresets.filter(p => p.id !== presetId);
        setPePresets(updatedPresets);
        savePePresetsToStorage(updatedPresets);
        setSelectedPePresetId('');
        localStorage.removeItem(LOCALSTORAGE_SELECTED_PE_PRESET_KEY);
        showToast(`🗑️ 已删除预设: ${preset.name}`);
    };

    return (
        <div className="flex-1 bg-[#0b0b0b] p-10 animate-in fade-in slide-in-from-bottom-8 overflow-y-auto custom-scrollbar flex justify-center relative">
            {/* Simple Toast Notification */}
            {toastMessage && (
                <div className="fixed top-20 right-10 bg-[#3c4043] text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-4 border border-gray-600 flex items-center">
                    {toastMessage}
                </div>
            )}

            <div className="w-full max-w-6xl space-y-10">
                <div className="pb-6 border-b border-[#3c4043] flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-3">标准员工管理 (Amazon A9)</h2>
                        <p className="text-gray-400">配置您的数字员工团队：从模型资产库中选择策略大脑与视觉执行者。</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* 🧠 首席策略官 (Brain Agent) */}
                    <section className="bg-[#1e1f20] rounded-3xl border border-[#3c4043] overflow-hidden flex flex-col h-full shadow-2xl">
                        <div className="p-8 border-b border-[#3c4043] bg-gradient-to-b from-[#2a2a2c] to-[#1e1f20]">
                            <div className="flex items-center space-x-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-purple-900/40">
                                    🧠
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">首席策略官 (大脑)</h3>
                                    <p className="text-xs text-purple-300 font-mono mt-1">ROLE: STRATEGY_DIRECTOR</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">负责理解产品核心卖点，拆解用户痛点，并制定符合 Amazon A9 算法的视觉营销战略。</p>
                        </div>

                        <div className="p-8 space-y-6 flex-1 bg-[#1e1f20]">
                            {/* 模型选择区域 */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    选择文本模型
                                </label>
                                {enabledTextModels.length === 0 ? (
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                                        <p className="text-sm text-yellow-300 mb-3">⚠️ 暂无可用的文本模型配置</p>
                                        <button
                                            onClick={onNavigateToModels}
                                            className="px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors text-xs font-semibold"
                                        >
                                            → 前往模型管理添加配置
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <select
                                            value={selectedBrainModelId}
                                            onChange={(e) => onBrainModelChange(e.target.value)}
                                            className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                        >
                                            <option value="">-- 选择文本模型配置 --</option>
                                            {enabledTextModels.map(model => (
                                                <option key={model.id} value={model.id}>
                                                    {model.name} ({model.provider} - {model.modelId})
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={onNavigateToModels}
                                            className="text-xs text-gray-400 hover:text-purple-400 transition-colors flex items-center space-x-1"
                                        >
                                            <span>⚙️</span>
                                            <span>管理模型配置</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 flex-1 flex flex-col">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">岗位指令 (System Prompt)</label>
                                    <div className="flex items-center gap-3">
                                        {/* 自动保存状态提示 */}
                                        {saveStatus === 'saving' && (
                                            <span className="text-[10px] text-yellow-400 flex items-center gap-1 animate-pulse">
                                                <span>💾</span> 保存中...
                                            </span>
                                        )}
                                        {saveStatus === 'saved' && (
                                            <span className="text-[10px] text-green-400 flex items-center gap-1">
                                                <span>✅</span> 已录入为当前专家人设
                                            </span>
                                        )}
                                        {/* 恢复默认按钮 */}
                                        <button
                                            onClick={resetToDefaultPersona}
                                            className="text-[10px] font-bold bg-gray-500/10 text-gray-400 px-3 py-1.5 rounded-lg border border-gray-500/20 hover:bg-gray-500/20 hover:text-gray-300 transition-all flex items-center"
                                        >
                                            <span className="mr-1">🔄</span> 恢复默认模板
                                        </button>
                                    </div>
                                </div>

                                {/* ========== 预设选择器 ========== */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <select
                                        value={selectedBrainPresetId}
                                        onChange={(e) => selectBrainPreset(e.target.value)}
                                        className="flex-1 min-w-[200px] bg-[#131314] border border-[#3c4043] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="">-- 选择预设 --</option>
                                        {brainPresets.map(preset => (
                                            <option key={preset.id} value={preset.id}>
                                                {preset.name} {preset.isDefault ? '' : '(自定义)'}
                                            </option>
                                        ))}
                                    </select>
                                    
                                    {/* 删除预设按钮 */}
                                    {selectedBrainPresetId && !brainPresets.find(p => p.id === selectedBrainPresetId)?.isDefault && (
                                        <button
                                            onClick={() => deleteBrainPreset(selectedBrainPresetId)}
                                            className="px-2 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-colors text-xs"
                                            title="删除当前预设"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                    
                                    {/* 保存为新预设按钮 */}
                                    {!showBrainPresetInput ? (
                                        <button
                                            onClick={() => setShowBrainPresetInput(true)}
                                            className="px-3 py-2 bg-purple-500/10 text-purple-300 rounded-lg border border-purple-500/20 hover:bg-purple-500/20 transition-colors text-xs font-semibold whitespace-nowrap"
                                        >
                                            💾 保存为预设
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newBrainPresetName}
                                                onChange={(e) => setNewBrainPresetName(e.target.value)}
                                                placeholder="输入预设名称..."
                                                className="w-48 bg-[#131314] border-2 border-purple-500/50 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none placeholder:text-gray-500"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveBrainAsPreset();
                                                    if (e.key === 'Escape') {
                                                        setShowBrainPresetInput(false);
                                                        setNewBrainPresetName('');
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={saveBrainAsPreset}
                                                className="px-2 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-xs"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowBrainPresetInput(false);
                                                    setNewBrainPresetName('');
                                                }}
                                                className="px-2 py-2 bg-gray-500/20 text-gray-400 rounded-lg hover:bg-gray-500/30 transition-colors text-xs"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <textarea
                                    id="system-prompt-area"
                                    value={config.brain.systemInstruction}
                                    onChange={(e) => handleBrainChange('systemInstruction', e.target.value)}
                                    className="w-full flex-1 min-h-[300px] bg-[#131314] border border-[#3c4043] rounded-xl p-4 text-xs text-gray-300 font-mono leading-relaxed focus:ring-1 focus:ring-[#A8C7FA] outline-none custom-scrollbar resize-none"
                                    placeholder="请输入智能体的核心指令（例如：你是一名资深亚马逊运营...）"
                                />
                            </div>
                        </div>
                    </section>

                    {/* 🔗 视觉技术总监 (Prompt Engineer) */}
                    <section className="bg-[#1e1f20] rounded-3xl border border-[#3c4043] overflow-hidden flex flex-col h-full shadow-2xl">
                        <div className="p-8 border-b border-[#3c4043] bg-gradient-to-b from-[#2a2a2c] to-[#1e1f20]">
                            <div className="flex items-center space-x-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-cyan-900/40">
                                    🔗
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">视觉技术总监 (提示词工程)</h3>
                                    <p className="text-xs text-cyan-300 font-mono mt-1">ROLE: PROMPT_ENGINEER</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">负责将策略官的抽象简报翻译为 Nanobanana Pro 专用的物理级提示词。不懂营销，只懂参数。</p>
                        </div>

                        <div className="p-8 space-y-6 flex-1 bg-[#1e1f20]">
                            {/* 模型选择区域 */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    选择文本模型
                                </label>
                                {enabledTextModels.length === 0 ? (
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                                        <p className="text-sm text-yellow-300 mb-3">⚠️ 暂无可用的文本模型配置</p>
                                        <button
                                            onClick={onNavigateToModels}
                                            className="px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors text-xs font-semibold"
                                        >
                                            → 前往模型管理添加配置
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <select
                                            value={selectedPromptEngineerModelId}
                                            onChange={(e) => onPromptEngineerModelChange(e.target.value)}
                                            className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                        >
                                            <option value="">-- 选择文本模型配置 --</option>
                                            {enabledTextModels.map(model => (
                                                <option key={model.id} value={model.id}>
                                                    {model.name} ({model.provider} - {model.modelId})
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={onNavigateToModels}
                                            className="text-xs text-gray-400 hover:text-cyan-400 transition-colors flex items-center space-x-1"
                                        >
                                            <span>⚙️</span>
                                            <span>管理模型配置</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 flex-1 flex flex-col">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">岗位指令 (System Prompt)</label>
                                    <div className="flex items-center gap-3">
                                        {promptEngineerSaveStatus === 'saving' && (
                                            <span className="text-[10px] text-yellow-400 flex items-center gap-1 animate-pulse">
                                                <span>💾</span> 保存中...
                                            </span>
                                        )}
                                        {promptEngineerSaveStatus === 'saved' && (
                                            <span className="text-[10px] text-green-400 flex items-center gap-1">
                                                <span>✅</span> 已保存
                                            </span>
                                        )}
                                        <button
                                            onClick={resetPromptEngineerToDefault}
                                            className="text-[10px] font-bold bg-gray-500/10 text-gray-400 px-3 py-1.5 rounded-lg border border-gray-500/20 hover:bg-gray-500/20 hover:text-gray-300 transition-all flex items-center"
                                        >
                                            <span className="mr-1">🔄</span> 恢复默认模板
                                        </button>
                                    </div>
                                </div>

                                {/* ========== PE 预设选择器 ========== */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <select
                                        value={selectedPePresetId}
                                        onChange={(e) => selectPePreset(e.target.value)}
                                        className="flex-1 min-w-[200px] bg-[#131314] border border-[#3c4043] rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                                    >
                                        <option value="">-- 选择预设 --</option>
                                        {pePresets.map(preset => (
                                            <option key={preset.id} value={preset.id}>
                                                {preset.name} {preset.isDefault ? '' : '(自定义)'}
                                            </option>
                                        ))}
                                    </select>
                                    
                                    {/* 删除预设按钮 */}
                                    {selectedPePresetId && !pePresets.find(p => p.id === selectedPePresetId)?.isDefault && (
                                        <button
                                            onClick={() => deletePePreset(selectedPePresetId)}
                                            className="px-2 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-colors text-xs"
                                            title="删除当前预设"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                    
                                    {/* 保存为新预设按钮 */}
                                    {!showPePresetInput ? (
                                        <button
                                            onClick={() => setShowPePresetInput(true)}
                                            className="px-3 py-2 bg-cyan-500/10 text-cyan-300 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors text-xs font-semibold whitespace-nowrap"
                                        >
                                            💾 保存为预设
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newPePresetName}
                                                onChange={(e) => setNewPePresetName(e.target.value)}
                                                placeholder="输入预设名称..."
                                                className="w-48 bg-[#131314] border-2 border-cyan-500/50 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none placeholder:text-gray-500"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') savePeAsPreset();
                                                    if (e.key === 'Escape') {
                                                        setShowPePresetInput(false);
                                                        setNewPePresetName('');
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={savePeAsPreset}
                                                className="px-2 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-xs"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowPePresetInput(false);
                                                    setNewPePresetName('');
                                                }}
                                                className="px-2 py-2 bg-gray-500/20 text-gray-400 rounded-lg hover:bg-gray-500/30 transition-colors text-xs"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <textarea
                                    value={promptEngineerInstruction}
                                    onChange={(e) => setPromptEngineerInstruction(e.target.value)}
                                    className="w-full flex-1 min-h-[200px] bg-[#131314] border border-[#3c4043] rounded-xl p-4 text-xs text-gray-300 font-mono leading-relaxed focus:ring-1 focus:ring-cyan-500 outline-none custom-scrollbar resize-none"
                                    placeholder="请输入视觉技术总监的核心指令..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* 🎨 视觉执行官 (Visual Agent) */}
                    <section className="bg-[#1e1f20] rounded-3xl border border-[#3c4043] overflow-hidden flex flex-col h-full shadow-2xl">
                        <div className="p-8 border-b border-[#3c4043] bg-gradient-to-b from-[#2a2a2c] to-[#1e1f20]">
                            <div className="flex items-center space-x-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-pink-900/40">
                                    🎨
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">视觉执行官 (画师)</h3>
                                    <p className="text-xs text-pink-300 font-mono mt-1">ROLE: ART_DIRECTOR</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">严格执行策略官的视觉指令。不掺杂个人风格，只追求对 Prompt 的精准还原。</p>
                        </div>

                        <div className="p-8 space-y-8 flex-1 bg-[#1e1f20]">
                            {/* 模型选择区域 */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    选择图像模型
                                </label>
                                {enabledImageModels.length === 0 ? (
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                                        <p className="text-sm text-yellow-300 mb-3">⚠️ 暂无可用的图像模型配置</p>
                                        <button
                                            onClick={onNavigateToModels}
                                            className="px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors text-xs font-semibold"
                                        >
                                            → 前往模型管理添加配置
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <select
                                            value={selectedVisualModelId}
                                            onChange={(e) => onVisualModelChange(e.target.value)}
                                            className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-pink-500 outline-none"
                                        >
                                            <option value="">-- 选择图像模型配置 --</option>
                                            {enabledImageModels.map(model => (
                                                <option key={model.id} value={model.id}>
                                                    {model.name} ({model.provider} - {model.modelId})
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={onNavigateToModels}
                                            className="text-xs text-gray-400 hover:text-pink-400 transition-colors flex items-center space-x-1"
                                        >
                                            <span>⚙️</span>
                                            <span>管理模型配置</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 p-6 bg-[#131314] rounded-xl border border-dashed border-[#3c4043]/50">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-gray-400">风格干预配置</h4>
                                    <span className="px-2 py-1 rounded bg-[#3c4043] text-[10px] text-gray-400 font-mono">LOCKED</span>
                                </div>
                                <p className="text-xs text-gray-500 italic">
                                    "在此架构中，所有风格参数（光照、构图、色调）均由策略大脑在 Prompt 中直接指定。视觉执行官不需要额外的风格预设。"
                                </p>
                            </div>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};

export default EmployeeConfig;
