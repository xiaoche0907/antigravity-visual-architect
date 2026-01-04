import React, { useState } from 'react';
import { WorkflowMode, RoleFocus, ProductInput, MarketingStrategy, AppConfig, HistorySession } from '../types';
import { ModelConfig } from '../types/models';
import { generateMarketingStrategy, generateVisual } from '../services/aiService';

interface WorkspaceProps {
    config: AppConfig;
    onNavigateSettings: () => void;

    // Model Configs
    modelConfigs: ModelConfig[];
    selectedBrainModelId: string;
    selectedVisualModelId: string;

    // Lifted State
    loadingState: 'idle' | 'analyzing' | 'generating';
    setLoadingState: (s: 'idle' | 'analyzing' | 'generating') => void;
    activeTab: 'analysis' | 'secondary' | 'aplus';
    setActiveTab: (t: 'analysis' | 'secondary' | 'aplus') => void;
    mode: WorkflowMode;
    setMode: (m: WorkflowMode) => void;
    roleFocus: RoleFocus;
    setRoleFocus: (r: RoleFocus) => void;
    input: ProductInput;
    setInput: React.Dispatch<React.SetStateAction<ProductInput>>;
    strategy: MarketingStrategy | null;
    setStrategy: React.Dispatch<React.SetStateAction<MarketingStrategy | null>>;

    // History
    history: HistorySession[];
    onSaveToHistory: () => boolean;
    onRestoreSession: (s: HistorySession) => void;
    onDeleteSession: (id: string) => void;
}

const Workspace: React.FC<WorkspaceProps> = ({
    config,
    onNavigateSettings,
    modelConfigs,
    selectedBrainModelId,
    selectedVisualModelId,
    loadingState, setLoadingState,
    activeTab, setActiveTab,
    mode, setMode,
    roleFocus, setRoleFocus,
    input, setInput,
    strategy, setStrategy,
    history, onSaveToHistory, onRestoreSession, onDeleteSession
}) => {


    // Local UI State
    const [showHistory, setShowHistory] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [imageResolution, setImageResolution] = useState<'1K' | '2K' | '4K'>('1K');
    const [zoomedImage, setZoomedImage] = useState<string | null>(null); // Lightbox State

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleDownload = (url: string, prefix: string) => {
        if (!url || url.startsWith('http') === false) return;
        const link = document.createElement('a');
        link.href = url;
        link.download = `A9_Architect_${prefix}_${Date.now()}.png`;
        link.target = '_blank'; // For some browsers to force download or open new tab
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'productImages' | 'styleReferences') => {
        const files = Array.from(e.target.files || []) as File[];
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                setInput(prev => ({
                    ...prev,
                    [field]: [...prev[field], reader.result as string].slice(0, field === 'productImages' ? 6 : 4)
                }));
            };
            reader.readAsDataURL(file as Blob);
        });
    };

    const removeImage = (index: number, field: 'productImages' | 'styleReferences') => {
        setInput(prev => ({
            ...prev,
            [field]: prev[field].filter((_, i) => i !== index)
        }));
    };

    const handleRunWorkflow = async () => {
        // --- 1. 验证输入 ---
        if (!input.usps || !input.specs) {
            alert("请完善核心卖点和关键评参数。");
            return;
        }

        // --- 2. 锁定【大脑】(Strategy Model) ---
        const brainConfig = modelConfigs.find(m => m.id === selectedBrainModelId);
        console.log('🧠 [Workspace] 锁定首席策略官:', brainConfig ? `${brainConfig.name} (${brainConfig.provider})` : '❌ 未选择');

        if (!config.mockMode && (!brainConfig || !brainConfig.isEnabled)) {
            alert(`⚠️ 策略模型 (ID: ${selectedBrainModelId}) 不可用或已禁用，请在“AI 员工”页面检查配置。`);
            return;
        }

        // --- 3. 锁定【画师】(Visual Model) ---
        let visualConfig: ModelConfig | undefined;
        if (mode === WorkflowMode.DIRECT_GENERATION) {
            visualConfig = modelConfigs.find(m => m.id === selectedVisualModelId);
            // 严格检查：同步出图模式下，必须有可用的图像模型
            if (!config.mockMode && (!visualConfig || !visualConfig.isEnabled)) {
                alert(`⚠️ 图像模型 (ID: ${selectedVisualModelId}) 不可用或已禁用。请配置图像模型或切换为“仅生成方案”模式。`);
                return;
            }
        }

        setLoadingState('analyzing');
        setStrategy(null);
        showToast('🧠 策略大脑正在分析 A9 转化要素...');

        try {
            // === Step 1: 策略大脑工作 ===
            console.log('🧠 [Step 1] 策略模型正在拆解用户痛点与卖点...');
            const strategyData = await generateMarketingStrategy(input, roleFocus, brainConfig || null, config);

            // 🛡️ 数据完整性验证
            if (!strategyData) {
                throw new Error("策略服务返回为空");
            }
            if (strategyData.isError) {
                throw new Error(strategyData.errorMessage || "策略分析遭遇未知错误");
            }

            setStrategy(strategyData);
            console.log('✅ 策略分析完成。');

            // === Step 2: 视觉画师工作 (现在改为手动触发) ===
            if (mode === WorkflowMode.DIRECT_GENERATION) {
                console.log(`🎨 [Step 2] 策略已就绪，等待手动触发视觉生成...`);
                showToast('✅ 策略方案已生成！请点击下方卡片生成图片');
            } else {
                showToast('✅ 策略方案已生成！');
            }

        } catch (error: any) {
            console.error("❌ [Workspace] 任务中断:", error);
            const errorMsg = error?.message || "未知错误";
            showToast(`❌ 执行失败: ${errorMsg}`);
            // 只有严重错误才弹窗
            if (!errorMsg.includes("生成失败")) {
                alert(`执行失败: ${errorMsg}`);
            }
        } finally {
            setLoadingState('idle');
            console.log('🏁 任务全流程结束');
        }
    };

    // === 手动触发：单张生图 ===
    const handleGenerateSingleImage = async (type: 'secondary' | 'aplus', index: number) => {
        if (!strategy) return;

        // 验证图像模型配置
        const visualConfig = modelConfigs.find(m => m.id === selectedVisualModelId);
        const textConfig = modelConfigs.find(m => m.id === selectedBrainModelId); // For prompt summarization
        if (!config.mockMode && (!visualConfig || !visualConfig.isEnabled)) {
            alert("⚠️ 图像模型未配置或已禁用，请检查设置。");
            return;
        }

        const updated = { ...strategy };

        // 设置加载状态
        if (type === 'secondary') {
            const item = updated.secondaryImages[index];
            if (!item) return;
            item.generatedImageUrl = "PENDING:正在绘制...";
        } else {
            const item = updated.aPlusContent[index];
            if (!item) return;
            item.generatedImageUrl = "PENDING:正在绘制...";
        }
        setStrategy({ ...updated });

        try {
            console.log(`🎨 [Manual] Generating ${type} image #${index + 1} with ${imageResolution}...`);

            let prompt = '';
            let aspectRatio = '';

            // 准备 Prompt & 参数 (Split logic to avoid union type errors)
            if (type === 'secondary') {
                const item = updated.secondaryImages[index];
                prompt = item.visualPrompt;
                if (!prompt || prompt.length < 5) {
                    prompt = `Professional commercial photography of ${input.usps}, ${item.description}, 8k resolution`;
                }
                aspectRatio = '1:1';
            } else {
                const item = updated.aPlusContent[index];
                prompt = item.visualPrompt;
                if (!prompt || prompt.length < 5) {
                    prompt = item.visualGuidance || `High quality product image for Amazon A+ content, ${item.moduleType}, ${input.usps}`;
                }
                aspectRatio = '16:9';
            }

            // 调用 API - 传入产品图作为参考图 (for image editing models)
            const url = await generateVisual(prompt, visualConfig || null, config, aspectRatio as any, imageResolution, input.productImages, textConfig);

            // 更新结果
            if (type === 'secondary') {
                updated.secondaryImages[index].generatedImageUrl = url;
            } else {
                updated.aPlusContent[index].generatedImageUrl = url;
            }

            setStrategy({ ...updated });
            console.log(`✅ [Manual] Image #${index + 1} generated.`);

        } catch (error: any) {
            console.error(`❌ [Manual] Failed to generate image #${index + 1}:`, error);
            const errMsg = `ERROR:${error.message || 'Unknown Error'}`;
            if (type === 'secondary') {
                updated.secondaryImages[index].generatedImageUrl = errMsg;
            } else {
                updated.aPlusContent[index].generatedImageUrl = errMsg;
            }
            setStrategy({ ...updated });
        }
    };

    // === 手动触发：批量生图 (生成当前 Tab 下所有未完成的) ===
    const handleGenerateBatch = async (type: 'secondary' | 'aplus') => {
        if (!strategy) return;

        // 验证图像模型配置
        const visualConfig = modelConfigs.find(m => m.id === selectedVisualModelId);
        const textConfig = modelConfigs.find(m => m.id === selectedBrainModelId); // For prompt summarization
        if (!config.mockMode && (!visualConfig || !visualConfig.isEnabled)) {
            alert("⚠️ 图像模型未配置或已禁用，请检查设置。");
            return;
        }

        const updated = { ...strategy };

        // 筛选需要生成的索引
        const indicesToGenerate: number[] = [];
        const list = type === 'secondary' ? updated.secondaryImages : updated.aPlusContent;

        list.forEach((item, idx) => {
            // Common property access safe here or just checks emptiness
            if (!item.generatedImageUrl || item.generatedImageUrl.startsWith('ERROR:')) {
                indicesToGenerate.push(idx);
            }
        });

        if (indicesToGenerate.length === 0) {
            showToast("✨ 当前没有需要生成的图片");
            return;
        }

        showToast(`🚀 开始批量生成 ${indicesToGenerate.length} 张图片 (${imageResolution})...`);

        // 🚀 Concurrency Control Queue
        const CONCURRENCY_LIMIT = 2; // Max 2 parallel requests to prevent browser stall
        let activeWorkers = 0;
        let queueIndex = 0;

        const processQueue = async () => {
            // If queue finished
            if (queueIndex >= indicesToGenerate.length) return;

            // Get next task index
            const currentIndex = indicesToGenerate[queueIndex++];

            // Update UI to 'Generating...'
            if (type === 'secondary') {
                updated.secondaryImages[currentIndex].generatedImageUrl = "PENDING:正在绘制... (勿刷新)";
            } else {
                updated.aPlusContent[currentIndex].generatedImageUrl = "PENDING:正在绘制... (勿刷新)";
            }
            setStrategy({ ...updated }); // Force update UI

            try {
                let prompt = '';
                let aspectRatio = '';

                if (type === 'secondary') {
                    const item = updated.secondaryImages[currentIndex];
                    prompt = item.visualPrompt;
                    if (!prompt || prompt.length < 5) {
                        prompt = `Professional commercial photography of ${input.usps}, ${item.description}, 8k resolution`;
                    }
                    aspectRatio = '1:1';
                } else {
                    const item = updated.aPlusContent[currentIndex];
                    prompt = item.visualPrompt;
                    if (!prompt || prompt.length < 5) {
                        prompt = item.visualGuidance || `High quality product image for Amazon A+ content, ${item.moduleType}, ${input.usps}`;
                    }
                    aspectRatio = '16:9';
                }

                // Call API
                const url = await generateVisual(prompt, visualConfig || null, config, aspectRatio as any, imageResolution, input.productImages, textConfig);

                // Update Success
                if (type === 'secondary') {
                    updated.secondaryImages[currentIndex].generatedImageUrl = url;
                } else {
                    updated.aPlusContent[currentIndex].generatedImageUrl = url;
                }

            } catch (error: any) {
                console.error(`❌ Batch error at #${currentIndex}:`, error);
                const errMsg = `ERROR:${error.message}`;
                // Update Error
                if (type === 'secondary') {
                    updated.secondaryImages[currentIndex].generatedImageUrl = errMsg;
                } else {
                    updated.aPlusContent[currentIndex].generatedImageUrl = errMsg;
                }
            } finally {
                // Update State and Trigger Next
                setStrategy({ ...updated });
                await processQueue();
            }
        };

        // Start initial workers
        const workers: Promise<void>[] = [];
        for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, indicesToGenerate.length); i++) {
            workers.push(processQueue());
        }

        await Promise.allSettled(workers);
        showToast("✨ 批量生成任务结束！");
    };

    const handleSave = () => {
        const success = onSaveToHistory();
        if (success) {
            showToast("✅ 已归档到历史记录");
        } else {
            showToast("⚠️ 无法保存：没有内容");
        }
    };

    return (
        <div className="flex-1 flex overflow-hidden animate-in fade-in zoom-in duration-300 relative">
            {/* Toast */}
            {toastMessage && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-[#3c4043] text-white px-6 py-2 rounded-xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-4 border border-gray-500">
                    {toastMessage}
                </div>
            )}

            {/* Context Sidebar (Left Panel) */}
            <section className="w-[420px] flex flex-col border-r border-[#3c4043] bg-[#1e1f20] overflow-y-auto custom-scrollbar z-10">
                <div className="p-6 space-y-6">

                    {/* 📦 产品多维图集 */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <h3 className="text-[11px] font-bold text-[#A8C7FA] uppercase tracking-wider flex items-center">
                                <span className="mr-2 text-base">📦</span> 产品多维图集
                            </h3>
                            <span className="text-[10px] text-gray-500 font-mono">{input.productImages.length}/6</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {input.productImages.map((img, idx) => (
                                <div key={idx} className="aspect-square relative group rounded-lg overflow-hidden border border-[#3c4043] bg-black">
                                    <img src={img} className="w-full h-full object-cover" alt="Product" />
                                    <button onClick={() => removeImage(idx, 'productImages')} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                            {input.productImages.length < 6 && (
                                <label className="aspect-square border-2 border-dashed border-[#3c4043] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#A8C7FA] hover:bg-[#252a31] transition-all group">
                                    <svg className="w-6 h-6 text-gray-500 group-hover:text-[#A8C7FA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    <span className="text-[9px] text-gray-500 group-hover:text-[#A8C7FA] mt-1">点击或拖拽上传产品原图</span>
                                    <input type="file" multiple className="hidden" onChange={(e) => handleFileChange(e, 'productImages')} accept="image/*" />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* 🎨 风格参考板 */}
                    <div className="space-y-3 pt-2">
                        <h3 className="text-[11px] font-bold text-[#A8C7FA] uppercase tracking-wider flex items-center">
                            <span className="mr-2 text-base">🎨</span> 风格参考板
                        </h3>
                        <div className="flex space-x-2 overflow-x-auto pb-2 custom-scrollbar">
                            {input.styleReferences.map((img, idx) => (
                                <div key={idx} className="w-20 h-20 flex-shrink-0 relative group rounded-lg overflow-hidden border border-[#3c4043] bg-black">
                                    <img src={img} className="w-full h-full object-cover" alt="Ref" />
                                    <button onClick={() => removeImage(idx, 'styleReferences')} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                            {input.styleReferences.length < 4 && (
                                <label className="w-20 h-20 flex-shrink-0 border border-dashed border-[#3c4043] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#A8C7FA] hover:bg-[#252a31] transition-all group">
                                    <svg className="w-5 h-5 text-gray-600 group-hover:text-[#A8C7FA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                    <input type="file" multiple className="hidden" onChange={(e) => handleFileChange(e, 'styleReferences')} accept="image/*" />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Text Inputs */}
                    <div className="space-y-4 pt-4 border-t border-[#3c4043]">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center"><span className="mr-2">⚡</span> 核心卖点 (USPs)</label>
                            <textarea value={input.usps} onChange={(e) => setInput({ ...input, usps: e.target.value })} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-3 text-sm text-white h-24 focus:ring-1 focus:ring-[#A8C7FA] outline-none resize-none custom-scrollbar" placeholder="例如：超静音设计、50dB 深度降噪..." />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center"><span className="mr-2">🎯</span> 目标受众</label>
                            <input type="text" value={input.targetAudience} onChange={(e) => setInput({ ...input, targetAudience: e.target.value })} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-[#A8C7FA] outline-none" placeholder="例如：追求品质的商务旅行者" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center"><span className="mr-2">⚠️</span> 竞品痛点</label>
                            <textarea value={input.competitorPainPoints} onChange={(e) => setInput({ ...input, competitorPainPoints: e.target.value })} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-3 text-sm text-white h-20 focus:ring-1 focus:ring-[#A8C7FA] outline-none resize-none custom-scrollbar" placeholder="例如：佩戴过重、塑料感强..." />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center"><span className="mr-2">📏</span> 关键参数 (Specs)</label>
                            <textarea value={input.specs} onChange={(e) => setInput({ ...input, specs: e.target.value })} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-3 text-sm text-white h-20 focus:ring-1 focus:ring-[#A8C7FA] outline-none resize-none custom-scrollbar" placeholder="重量 250g、续航 40h..." />
                        </div>
                    </div>

                    {/* Workflow Controls */}
                    <div className="pt-4 space-y-4">
                        <div className="flex items-center justify-between p-3 bg-[#131314] rounded-xl border border-[#3c4043]">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 font-bold uppercase">引擎侧重</span>
                                <select value={roleFocus} onChange={(e) => setRoleFocus(e.target.value as RoleFocus)} className="bg-transparent text-xs text-[#A8C7FA] border-none focus:ring-0 outline-none cursor-pointer p-0">
                                    <option value={RoleFocus.BALANCED}>均衡策略</option>
                                    <option value={RoleFocus.TECHNICAL}>硬核参数</option>
                                    <option value={RoleFocus.LIFESTYLE}>生活场景</option>
                                    <option value={RoleFocus.VISUAL_ARCHITECT}>A9 视觉总监 (Expert)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setMode(WorkflowMode.PROMPT_ONLY)} className={`text-[10px] py-2.5 rounded-xl border transition-all font-bold ${mode === WorkflowMode.PROMPT_ONLY ? 'bg-white text-black border-white' : 'border-[#3c4043] text-gray-400 hover:bg-[#252a31]'}`}>仅生成方案</button>
                            <button onClick={() => setMode(WorkflowMode.DIRECT_GENERATION)} className={`text-[10px] py-2.5 rounded-xl border transition-all font-bold ${mode === WorkflowMode.DIRECT_GENERATION ? 'bg-white text-black border-white' : 'border-[#3c4043] text-gray-400 hover:bg-[#252a31]'}`}>同步出图</button>
                        </div>

                        <button onClick={handleRunWorkflow} disabled={loadingState !== 'idle'} className={`w-full py-4 rounded-xl font-bold bg-[#A8C7FA] text-[#0b0b0b] hover:bg-[#d2e3fc] active:scale-95 transition-all shadow-xl shadow-blue-900/10 ${loadingState !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {loadingState !== 'idle' ? (loadingState === 'analyzing' ? '正在解析视觉卖点...' : '正在绘制视觉方案...') : '🚀 启动 A9 架构引擎'}
                        </button>
                    </div>
                </div>
            </section>

            {/* Main Content Area (Right Panel) */}
            <main className="flex-1 flex flex-col bg-[#0b0b0b] overflow-hidden relative">
                {/* Header */}
                <div className="flex items-center justify-between px-8 h-12 bg-[#1e1f20] border-b border-[#3c4043]">
                    <div className="flex items-center space-x-6 h-full">
                        <button onClick={() => setActiveTab('analysis')} className={`h-full text-xs font-semibold border-b-2 transition-all px-2 ${activeTab === 'analysis' ? 'border-[#A8C7FA] text-[#A8C7FA]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>策略分析</button>
                        <button onClick={() => setActiveTab('secondary')} className={`h-full text-xs font-semibold border-b-2 transition-all px-2 ${activeTab === 'secondary' ? 'border-[#A8C7FA] text-[#A8C7FA]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>视觉生成</button>
                        <button onClick={() => setActiveTab('aplus')} className={`h-full text-xs font-semibold border-b-2 transition-all px-2 ${activeTab === 'aplus' ? 'border-[#A8C7FA] text-[#A8C7FA]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>A+ 详情页布局</button>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleSave}
                            className="flex items-center space-x-2 px-3 py-1 bg-[#A8C7FA] hover:bg-[#d2e3fc] text-[#0b0b0b] rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95"
                        >
                            <span>💾</span>
                            <span>Save Project</span>
                        </button>

                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`p-2 rounded-lg transition-all ${showHistory ? 'bg-[#3c4043] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            title="历史记录"
                        >
                            <span className="text-lg">🗂️</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar flex flex-col">
                    {!strategy && loadingState === 'idle' ? (
                        <div className="flex-1 flex items-center justify-center p-4">
                            <div className="h-full flex flex-col items-center justify-center opacity-10">
                                <span className="text-4xl mb-4">🧠 + 🎨</span>
                                <p className="text-xl font-light tracking-[0.2em] uppercase">准备就绪 / 等待输入</p>
                            </div>
                        </div>
                    ) : loadingState !== 'idle' ? (
                        <div className="flex-1 flex items-center justify-center p-4">
                            <div className="text-center">
                                <div className="text-6xl mb-6 animate-pulse">🔄</div>
                                <p className="text-xl font-light text-gray-400">
                                    {loadingState === 'analyzing' ? '正在分析产品数据...' : '正在生成视觉方案...'}
                                </p>
                            </div>
                        </div>
                    ) : strategy && (
                        <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-in fade-in slide-in-from-bottom-8">

                            {/* 🚨 ERROR CONSOLE (Render Guard) */}
                            {strategy.isError && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6 mb-8">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-2xl">⚠️</span>
                                        <h3 className="text-lg font-bold text-red-400">分析引擎遇到些许波折</h3>
                                    </div>
                                    <p className="text-sm text-gray-300 mb-4">{strategy.analysis}</p>
                                    {strategy.errorMessage && (
                                        <div className="bg-black/30 p-4 rounded-lg font-mono text-xs text-red-300 break-all">
                                            Error Detail: {strategy.errorMessage}
                                        </div>
                                    )}
                                    {strategy.rawResponse && (
                                        <details className="mt-4">
                                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">查看原始响应 (Raw Response)</summary>
                                            <pre className="mt-2 p-4 bg-black rounded-lg text-xs text-gray-500 overflow-x-auto whitespace-pre-wrap">
                                                {strategy.rawResponse}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            )}

                            {activeTab === 'analysis' && (
                                <div className="space-y-8">
                                    <div className="bg-[#1e1f20] p-10 rounded-3xl border border-[#3c4043] shadow-2xl">
                                        <h3 className="text-[#A8C7FA] font-bold text-lg mb-6 uppercase tracking-widest flex items-center">
                                            <span className="text-2xl mr-3">🧠</span> 市场洞察与视觉策略
                                        </h3>
                                        <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap mono bg-[#131314] p-8 rounded-2xl border border-[#3c4043] text-gray-300">
                                            {typeof strategy.analysis === 'string' ? strategy.analysis : JSON.stringify(strategy.analysis)}
                                        </div>
                                    </div>

                                    {/* 👇 找回丢失的副图模块：在 Analysis 底部增加预览引导，或直接渲染 */}
                                    {strategy.secondaryImages && strategy.secondaryImages.length > 0 && (
                                        <div className="bg-[#1e1f20] p-8 rounded-3xl border border-[#3c4043]">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-[#A8C7FA] font-bold text-lg uppercase tracking-widest">
                                                    📸 视觉方案概览 ({strategy.secondaryImages.length})
                                                </h3>
                                                <button onClick={() => setActiveTab('secondary')} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                                                    查看详情 <span className="text-lg">→</span>
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-5 gap-4 opacity-70 hover:opacity-100 transition-opacity">
                                                {strategy.secondaryImages.map((img, i) => {
                                                    if (!img) return null;
                                                    <div key={i} className="aspect-square bg-black rounded-lg border border-[#3c4043] flex items-center justify-center relative group" title={String(img.type || '')}>
                                                        {img.generatedImageUrl ? (
                                                            img.generatedImageUrl.startsWith('ERROR:') ? (
                                                                <div className="w-full h-full flex items-center justify-center bg-red-900/20 text-[10px] text-red-400 p-1 text-center leading-tight overflow-hidden" title={img.generatedImageUrl}>
                                                                    ⚠️ 生成失败
                                                                </div>
                                                            ) : (
                                                                <img src={img.generatedImageUrl} className="w-full h-full object-cover rounded-lg" />
                                                            )
                                                        ) : (
                                                            <span className="text-[10px] text-gray-600 text-center px-1">{String(img.type || 'Image')}</span>
                                                        )}
                                                    </div>
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'secondary' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">亚马逊副图视觉方案</h3>
                                            <p className="text-xs text-gray-500">基于 A9 算法生成的转化率优化图组</p>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            {/* Resolution Selector */}
                                            <div className="flex items-center bg-[#1e1f20] rounded-lg border border-[#3c4043] p-1">
                                                {(['1K', '2K', '4K'] as const).map((conf) => (
                                                    <button
                                                        key={conf}
                                                        onClick={() => setImageResolution(conf)}
                                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${imageResolution === conf
                                                            ? 'bg-[#A8C7FA] text-black shadow-sm'
                                                            : 'text-gray-400 hover:text-white hover:bg-[#3c3c3e]'
                                                            }`}
                                                    >
                                                        {conf}
                                                    </button>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => handleGenerateBatch('secondary')}
                                                className="flex items-center space-x-2 px-4 py-2 bg-[#2a2a2c] hover:bg-[#3c3c3e] border border-[#3c4043] rounded-xl text-xs font-bold transition-all text-[#A8C7FA] hover:text-white hover:border-[#A8C7FA]"
                                            >
                                                <span>⚡</span>
                                                <span>一键生成所有</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {strategy.secondaryImages && strategy.secondaryImages.length > 0 ? strategy.secondaryImages.map((img, i) => {
                                            if (!img) return null; // Safety check
                                            const isPending = img.generatedImageUrl?.startsWith('PENDING:');
                                            const isError = img.generatedImageUrl?.startsWith('ERROR:');
                                            const hasImage = img.generatedImageUrl && !isPending && !isError;

                                            return (
                                                <div key={i} className="bg-[#1e1f20] rounded-3xl border border-[#3c4043] overflow-hidden shadow-2xl flex flex-col">
                                                    {/* Header */}
                                                    <div className="p-4 border-b border-[#3c4043] bg-[#252a31] flex justify-between items-center">
                                                        <span className="text-[#A8C7FA] font-bold text-sm">#{i + 1} {String(img.type || '未命名')}</span>
                                                        <span className="text-[10px] text-gray-400 bg-black/30 px-2 py-1 rounded">Vision {String(img.id || i)}</span>
                                                    </div>
                                                    {/* Image Area */}
                                                    <div className="aspect-square bg-black relative flex items-center justify-center overflow-hidden group border-b border-[#3c4043]">
                                                        {hasImage ? (
                                                            <div className="relative w-full h-full group">
                                                                <img src={img.generatedImageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" onClick={() => setZoomedImage(img.generatedImageUrl)} />
                                                                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                                    {imageResolution}
                                                                </div>
                                                                {/* Controls Info */}
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                                    <button
                                                                        onClick={() => setZoomedImage(img.generatedImageUrl)}
                                                                        className="p-2 bg-white/10 hover:bg-white/30 backdrop-blur rounded-full text-white transition-all transform hover:scale-110"
                                                                        title="放大预览 (Zoom)"
                                                                    >
                                                                        <span className="text-xl">🔍</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDownload(img.generatedImageUrl as string, `Secondary_${i + 1}`);
                                                                        }}
                                                                        className="p-2 bg-white/10 hover:bg-white/30 backdrop-blur rounded-full text-white transition-all transform hover:scale-110"
                                                                        title="下载原图 (Download)"
                                                                    >
                                                                        <span className="text-xl">⬇️</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : isPending ? (
                                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                                <div className="w-8 h-8 border-2 border-[#A8C7FA] border-t-transparent rounded-full animate-spin"></div>
                                                                <p className="text-xs text-[#A8C7FA] animate-pulse">{img.generatedImageUrl?.replace('PENDING:', '')}</p>
                                                            </div>
                                                        ) : isError ? (
                                                            <div className="flex flex-col items-center justify-center h-full bg-red-900/10 p-4 w-full cursor-pointer hover:bg-red-900/20 transition-colors"
                                                                onClick={() => handleGenerateSingleImage('secondary', i)}
                                                                title="点击重试">
                                                                <span className="text-3xl mb-2">❌</span>
                                                                <span className="text-xs text-red-400 text-center break-words max-w-[80%]">{img.generatedImageUrl?.replace('ERROR:', '')}</span>
                                                                <span className="text-[10px] text-gray-500 mt-2 border border-gray-600 px-2 py-1 rounded">点击重试</span>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleGenerateSingleImage('secondary', i)}
                                                                className="flex flex-col items-center justify-center w-full h-full group/btn hover:bg-[#252a31] transition-colors cursor-pointer"
                                                            >
                                                                <div className="w-12 h-12 rounded-full bg-[#1e1f20] border border-[#3c4043] flex items-center justify-center mb-3 group-hover/btn:scale-110 group-hover/btn:border-[#A8C7FA] transition-all shadow-lg">
                                                                    <span className="text-xl">🎨</span>
                                                                </div>
                                                                <p className="text-xs text-gray-400 group-hover/btn:text-[#A8C7FA] font-bold">点击生成视觉</p>
                                                                <p className="text-[10px] text-gray-600 mt-1">1:1 Square • {imageResolution}</p>
                                                            </button>
                                                        )}
                                                    </div>
                                                    {/* Meta Info */}
                                                    <div className="p-6 flex-1 flex flex-col space-y-4">
                                                        <div>
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">画面描述</span>
                                                            <p className="text-xs text-gray-300 leading-relaxed">{String(img.description || '无描述')}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">营销文案 (Copy)</span>
                                                            <p className="text-xs text-white bg-[#131314] p-3 rounded-lg border border-[#3c4043] font-serif italic">"{String(img.copywriting || '...')}"</p>
                                                        </div>
                                                        <div className="mt-auto pt-4 border-t border-[#3c4043]">
                                                            <details className="group">
                                                                <summary className="text-[10px] text-gray-500 cursor-pointer list-none flex items-center gap-2 hover:text-gray-300">
                                                                    <span className="group-open:rotate-90 transition-transform">▶</span> Show MJ Prompt
                                                                </summary>
                                                                <p className="mt-2 text-[10px] font-mono text-gray-500 bg-black p-2 rounded selectable">{String(img.visualPrompt || 'No Prompt')}</p>
                                                            </details>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }) : (
                                            <div className="col-span-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                                                <p className="text-yellow-300">⚠️ 暂无副图数据</p>
                                                <button onClick={() => setActiveTab('analysis')} className="text-xs text-yellow-500 underline mt-2">返回分析页检查错误</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'aplus' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">A+ 详情页布局方案</h3>
                                            <p className="text-xs text-gray-500">高转化 A+ Content 视觉模块</p>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            {/* Resolution Selector */}
                                            <div className="flex items-center bg-[#1e1f20] rounded-lg border border-[#3c4043] p-1">
                                                {(['1K', '2K', '4K'] as const).map((conf) => (
                                                    <button
                                                        key={conf}
                                                        onClick={() => setImageResolution(conf)}
                                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${imageResolution === conf
                                                            ? 'bg-[#A8C7FA] text-black shadow-sm'
                                                            : 'text-gray-400 hover:text-white hover:bg-[#3c3c3e]'
                                                            }`}
                                                    >
                                                        {conf}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => handleGenerateBatch('aplus')}
                                                className="flex items-center space-x-2 px-4 py-2 bg-[#2a2a2c] hover:bg-[#3c3c3e] border border-[#3c4043] rounded-xl text-xs font-bold transition-all text-[#A8C7FA] hover:text-white hover:border-[#A8C7FA]"
                                            >
                                                <span>⚡</span>
                                                <span>一键生成所有</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-8">
                                        {strategy.aPlusContent && strategy.aPlusContent.length > 0 ? strategy.aPlusContent.map((m, i) => {
                                            if (!m) return null; // Safety check
                                            const isPending = m.generatedImageUrl?.startsWith('PENDING:');
                                            const isError = m.generatedImageUrl?.startsWith('ERROR:');
                                            const hasImage = m.generatedImageUrl && !isPending && !isError;

                                            return (
                                                <div key={i} className="bg-[#1e1f20] rounded-3xl border border-[#3c4043] overflow-hidden shadow-2xl flex flex-col">
                                                    {/* Header */}
                                                    <div className="p-4 border-b border-[#3c4043] bg-[#252a31] flex justify-between items-center">
                                                        <span className="text-[#A8C7FA] font-bold text-sm">#{i + 1} {String(m.moduleType || 'Modules')}</span>
                                                        <span className="text-[10px] text-gray-400 bg-black/30 px-2 py-1 rounded">Module {String(m.id || i)}</span>
                                                    </div>
                                                    {/* Image Area - 16:9 横图 */}
                                                    <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden group border-b border-[#3c4043]">
                                                        {hasImage ? (
                                                            <div className="relative w-full h-full group">
                                                                <img src={m.generatedImageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" onClick={() => setZoomedImage(m.generatedImageUrl)} />
                                                                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                                    {imageResolution}
                                                                </div>
                                                                {/* Controls Info */}
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                                    <button
                                                                        onClick={() => setZoomedImage(m.generatedImageUrl)}
                                                                        className="p-2 bg-white/10 hover:bg-white/30 backdrop-blur rounded-full text-white transition-all transform hover:scale-110"
                                                                        title="放大预览 (Zoom)"
                                                                    >
                                                                        <span className="text-xl">🔍</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDownload(m.generatedImageUrl as string, `APlus_${i + 1}`);
                                                                        }}
                                                                        className="p-2 bg-white/10 hover:bg-white/30 backdrop-blur rounded-full text-white transition-all transform hover:scale-110"
                                                                        title="下载原图 (Download)"
                                                                    >
                                                                        <span className="text-xl">⬇️</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : isPending ? (
                                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                                <div className="w-8 h-8 border-2 border-[#A8C7FA] border-t-transparent rounded-full animate-spin"></div>
                                                                <p className="text-xs text-[#A8C7FA] animate-pulse">{m.generatedImageUrl?.replace('PENDING:', '')}</p>
                                                            </div>
                                                        ) : isError ? (
                                                            <div className="flex flex-col items-center justify-center h-full bg-red-900/10 p-4 w-full cursor-pointer hover:bg-red-900/20 transition-colors"
                                                                onClick={() => handleGenerateSingleImage('aplus', i)}
                                                                title="点击重试">
                                                                <span className="text-3xl mb-2">❌</span>
                                                                <span className="text-xs text-red-400 text-center break-words max-w-[80%]">{m.generatedImageUrl?.replace('ERROR:', '')}</span>
                                                                <span className="text-[10px] text-gray-500 mt-2 border border-gray-600 px-2 py-1 rounded">点击重试</span>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleGenerateSingleImage('aplus', i)}
                                                                className="flex flex-col items-center justify-center w-full h-full group/btn hover:bg-[#252a31] transition-colors cursor-pointer"
                                                            >
                                                                <div className="w-12 h-12 rounded-full bg-[#1e1f20] border border-[#3c4043] flex items-center justify-center mb-3 group-hover/btn:scale-110 group-hover/btn:border-[#A8C7FA] transition-all shadow-lg">
                                                                    <span className="text-xl">🎨</span>
                                                                </div>
                                                                <p className="text-xs text-gray-400 group-hover/btn:text-[#A8C7FA] font-bold">点击生成 A+ 配图</p>
                                                                <p className="text-[10px] text-gray-600 mt-1">16:9 Wide • {imageResolution}</p>
                                                            </button>
                                                        )}
                                                    </div>
                                                    {/* Meta Info */}
                                                    <div className="p-6 flex-1 flex flex-col space-y-4">
                                                        <div>
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">模块内容</span>
                                                            <p className="text-sm text-gray-300 leading-relaxed">{String(m.content || '无内容')}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">视觉指导 (Visual Guidance)</span>
                                                            <p className="text-xs text-white bg-[#131314] p-3 rounded-lg border border-[#3c4043]">{String(m.visualGuidance || '...')}</p>
                                                        </div>
                                                        <div className="mt-auto pt-4 border-t border-[#3c4043]">
                                                            <details className="group">
                                                                <summary className="text-[10px] text-gray-500 cursor-pointer list-none flex items-center gap-2 hover:text-gray-300">
                                                                    <span className="group-open:rotate-90 transition-transform">▶</span> Show Image Prompt
                                                                </summary>
                                                                <p className="mt-2 text-[10px] font-mono text-gray-500 bg-black p-2 rounded selectable">{String(m.visualPrompt || m.visualGuidance || '无生图提示词')}</p>
                                                            </details>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }) : (
                                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                                                <p className="text-yellow-300">⚠️ 暂无 A+ 内容数据</p>
                                                <button onClick={() => setActiveTab('analysis')} className="text-xs text-yellow-500 underline mt-2">返回分析页检查错误</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* History Sidebar Panel */}
                <div className={`absolute top-0 right-0 bottom-0 w-80 bg-[#1e1f20]/95 backdrop-blur-xl border-l border-[#3c4043] shadow-2xl transform transition-transform duration-300 z-50 flex flex-col ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-4 border-b border-[#3c4043] flex justify-between items-center bg-[#131314]/50">
                        <h3 className="font-bold text-white flex items-center"><span className="mr-2">🗂️</span> Project History</h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => onDeleteSession('__FORCE_CLEAR_ALL__')}
                                className="text-[10px] bg-red-900/20 text-red-400 border border-red-900/50 px-2 py-1 rounded hover:bg-red-900/40 transition-colors"
                            >
                                🧹 强制清理
                            </button>
                            <button onClick={() => setShowHistory(false)} className="text-gray-500 hover:text-white px-2">✕</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {history.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 text-xs">暂无历史记录</div>
                        ) : (
                            history.map(session => (
                                <div key={session.id} className="group bg-[#131314] rounded-xl p-3 border border-[#3c4043] hover:border-[#A8C7FA] transition-all cursor-pointer relative overflow-hidden" onClick={() => onRestoreSession(session)}>
                                    <div className="flex space-x-3">
                                        <div className="w-12 h-12 bg-black rounded-lg flex-shrink-0 overflow-hidden border border-[#3c4043]">
                                            {session.thumbnail ? (
                                                <img src={session.thumbnail} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs">📦</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold text-gray-200 truncate">{session.title}</h4>
                                            <p className="text-[9px] text-gray-500 mt-1 font-mono">{new Date(session.timestamp).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                        className="absolute right-2 top-2 p-1.5 rounded-lg bg-red-900/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/50"
                                        title="删除"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
            {/* 👓 Lightbox Viewer */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-200"
                    onClick={() => setZoomedImage(null)}
                >
                    <button
                        className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2"
                        onClick={() => setZoomedImage(null)}
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <img
                        src={zoomedImage}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    />

                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(zoomedImage, 'HighRes');
                            }}
                            className="bg-white text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition-transform shadow-xl flex items-center gap-2"
                        >
                            <span>⬇️</span> 下载原图
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Workspace;
