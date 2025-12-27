
import React, { useState, useEffect } from 'react';
import { WorkflowMode, RoleFocus, ProductInput, MarketingStrategy, AppConfig, BrainProvider } from './types';
import { generateMarketingStrategy, generateVisual } from './services/geminiService';
import { DEFAULT_SYSTEM_INSTRUCTION } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'projects' | 'settings'>('dashboard');
  const [showGuide, setShowGuide] = useState(() => {
    const dismissed = localStorage.getItem('amz_guide_dismissed');
    return dismissed !== 'true';
  });
  
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('amz_config_v3');
    if (saved) return JSON.parse(saved);
    return {
      mockMode: true,
      brain: { 
        provider: 'modelscope', 
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-max', 
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION 
      },
      visual: { 
        provider: 'modelscope',
        model: 'wanx-v1', 
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', 
        useSameKeyAsBrain: true
      }
    };
  });

  useEffect(() => {
    localStorage.setItem('amz_config_v3', JSON.stringify(config));
  }, [config]);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'secondary' | 'aplus'>('analysis');
  const [mode, setMode] = useState<WorkflowMode>(WorkflowMode.PROMPT_ONLY);
  const [roleFocus, setRoleFocus] = useState<RoleFocus>(RoleFocus.BALANCED);
  const [input, setInput] = useState<ProductInput>({ 
    productImages: [], 
    styleReferences: [], 
    usps: '', 
    targetAudience: '', 
    competitorPainPoints: '', 
    specs: '' 
  });
  const [strategy, setStrategy] = useState<MarketingStrategy | null>(null);

  const resetBrainInstruction = () => {
    setConfig(prev => ({
      ...prev,
      brain: { ...prev.brain, systemInstruction: DEFAULT_SYSTEM_INSTRUCTION }
    }));
  };

  const handleRunWorkflow = async () => {
    if (!input.usps || !input.specs) {
      alert("核心卖点和规格是必需的。");
      return;
    }

    setShowGuide(false);

    if (config.brain.provider === 'gemini' || config.visual.provider === 'gemini') {
      try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
        }
      } catch (e) {
        console.error("API Key selection error", e);
      }
    }

    setLoading(true);
    setStrategy(null);
    try {
      const result = await generateMarketingStrategy(input, roleFocus, config);
      setStrategy(result);
      if (mode === WorkflowMode.DIRECT_GENERATION) {
        handleGenerateAllImages(result);
      }
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("Requested entity was not found.")) {
         alert("API Key 选择无效或过期，请重新选择。");
         await (window as any).aistudio.openSelectKey();
      } else {
        alert(`工作流启动失败: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAllImages = async (currentStrategy: MarketingStrategy) => {
    const updated = { ...currentStrategy };
    try {
      for (let i = 0; i < updated.secondaryImages.length; i++) {
        const url = await generateVisual(updated.secondaryImages[i].visualPrompt, config);
        updated.secondaryImages[i].generatedImageUrl = url;
        setStrategy({ ...updated });
      }
      for (let i = 0; i < updated.aPlusContent.length; i++) {
        const url = await generateVisual(updated.aPlusContent[i].visualGuidance, config);
        updated.aPlusContent[i].generatedImageUrl = url;
        setStrategy({ ...updated });
      }
    } catch (error: any) {
      console.error("Image generation failed:", error);
    }
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

  const dismissGuide = () => {
    setShowGuide(false);
    localStorage.setItem('amz_guide_dismissed', 'true');
  };

  const renderMainContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div className="flex-1 flex overflow-hidden">
            {/* Context Sidebar */}
            <section className="w-[420px] flex flex-col border-r border-[#3c4043] bg-[#1e1f20] overflow-y-auto custom-scrollbar">
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
                        <span className="text-[9px] text-gray-500 group-hover:text-[#A8C7FA] mt-1">上传原图</span>
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

                {/* Text Context */}
                <div className="space-y-4 pt-4 border-t border-[#3c4043]">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center"><span className="mr-2">⚡</span> 核心卖点 (USPs)</label>
                    <textarea value={input.usps} onChange={(e) => setInput({...input, usps: e.target.value})} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-3 text-sm text-white h-24 focus:ring-1 focus:ring-[#A8C7FA] outline-none resize-none custom-scrollbar" placeholder="例如：超静音设计、50dB 深度降噪..." />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center"><span className="mr-2">🎯</span> 目标受众</label>
                    <input type="text" value={input.targetAudience} onChange={(e) => setInput({...input, targetAudience: e.target.value})} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-[#A8C7FA] outline-none" placeholder="例如：追求品质的商务旅行者" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center"><span className="mr-2">⚠️</span> 竞品痛点</label>
                    <textarea value={input.competitorPainPoints} onChange={(e) => setInput({...input, competitorPainPoints: e.target.value})} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-3 text-sm text-white h-20 focus:ring-1 focus:ring-[#A8C7FA] outline-none resize-none custom-scrollbar" placeholder="例如：佩戴过重、塑料感强..." />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center"><span className="mr-2">📏</span> 关键参数 (Specs)</label>
                    <textarea value={input.specs} onChange={(e) => setInput({...input, specs: e.target.value})} className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-3 text-sm text-white h-20 focus:ring-1 focus:ring-[#A8C7FA] outline-none resize-none custom-scrollbar" placeholder="重量 250g、续航 40h..." />
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
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setMode(WorkflowMode.PROMPT_ONLY)} className={`text-[10px] py-2.5 rounded-xl border transition-all font-bold ${mode === WorkflowMode.PROMPT_ONLY ? 'bg-white text-black border-white' : 'border-[#3c4043] text-gray-400 hover:bg-[#252a31]'}`}>生成方案</button>
                    <button onClick={() => setMode(WorkflowMode.DIRECT_GENERATION)} className={`text-[10px] py-2.5 rounded-xl border transition-all font-bold ${mode === WorkflowMode.DIRECT_GENERATION ? 'bg-white text-black border-white' : 'border-[#3c4043] text-gray-400 hover:bg-[#252a31]'}`}>同步生图</button>
                  </div>

                  <button onClick={handleRunWorkflow} disabled={loading} className={`w-full py-4 rounded-xl font-bold bg-[#A8C7FA] text-[#0b0b0b] hover:bg-[#d2e3fc] active:scale-95 transition-all shadow-xl shadow-blue-900/10 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {loading ? '正在构建 A9 视觉战略...' : '启动 A9 架构引擎'}
                  </button>
                </div>
              </div>
            </section>

            <main className="flex-1 flex flex-col bg-[#0b0b0b] overflow-hidden">
              <div className="flex items-center space-x-6 px-8 h-12 bg-[#1e1f20] border-b border-[#3c4043]">
                <button onClick={() => setActiveTab('analysis')} className={`h-full text-xs font-semibold border-b-2 transition-all px-2 ${activeTab === 'analysis' ? 'border-[#A8C7FA] text-[#A8C7FA]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>战略洞察</button>
                <button onClick={() => setActiveTab('secondary')} className={`h-full text-xs font-semibold border-b-2 transition-all px-2 ${activeTab === 'secondary' ? 'border-[#A8C7FA] text-[#A8C7FA]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>副图设计方案</button>
                <button onClick={() => setActiveTab('aplus')} className={`h-full text-xs font-semibold border-b-2 transition-all px-2 ${activeTab === 'aplus' ? 'border-[#A8C7FA] text-[#A8C7FA]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>A+ 详情页布局</button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar flex flex-col">
                {!strategy && !loading ? (
                  <div className="flex-1 flex items-center justify-center p-4">
                    {showGuide ? (
                      <div className="max-w-2xl w-full bg-[#1e1f20] border border-[#3c4043] rounded-3xl p-10 shadow-2xl animate-in zoom-in duration-500">
                        <h2 className="text-2xl font-bold mb-8 text-white flex items-center">
                          <span className="mr-3">🚀</span> 4步开启您的 A9 视觉战略
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                          {/* Step 1 */}
                          <div className="flex space-x-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#A8C7FA]">
                              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Step 1: 配置双引擎</p>
                              <p className="text-sm text-gray-300">前往设置页，填入 ModelScope (大脑) 和生图引擎的 API Key。</p>
                            </div>
                          </div>
                          {/* Step 2 */}
                          <div className="flex space-x-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#A8C7FA]">
                              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Step 2: 投喂多模态素材</p>
                              <p className="text-sm text-gray-300">上传产品图、参考图，并填写卖点和受众信息。</p>
                            </div>
                          </div>
                          {/* Step 3 */}
                          <div className="flex space-x-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#A8C7FA]">
                              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.21 1.21 0 0 0 1.72 0L21.64 5.36a1.21 1.21 0 0 0 0-1.72Z"/><path d="m14 7 3 3M5 6v4M19 14v4M10 2v2"/></svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Step 3: AI 智能生成</p>
                              <p className="text-sm text-gray-300">点击生成按钮，大脑分析策略，视觉引擎绘制图像。</p>
                            </div>
                          </div>
                          {/* Step 4 */}
                          <div className="flex space-x-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#A8C7FA]">
                              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3zM3 9h18M9 21V9"/></svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Step 4: 审阅与交付</p>
                              <p className="text-sm text-gray-300">在右侧 Tab 切换审阅 5 张副图和 7 个 A+ 架构方案。</p>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={dismissGuide}
                          className="w-full py-4 rounded-2xl bg-[#A8C7FA] text-black font-bold hover:bg-white transition-all shadow-lg"
                        >
                          明白了，开始工作 (Got it, let's start)
                        </button>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-10">
                        <svg className="w-40 h-40 mb-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
                        <p className="text-2xl font-light tracking-[0.2em] uppercase">Ready for Construction</p>
                      </div>
                    )}
                  </div>
                ) : strategy && (
                  <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-in fade-in slide-in-from-bottom-8">
                    {activeTab === 'analysis' && (
                      <div className="bg-[#1e1f20] p-10 rounded-3xl border border-[#3c4043] shadow-2xl">
                        <div className="flex items-center mb-8">
                          <span className="w-1.5 h-8 bg-[#A8C7FA] rounded-full mr-4"></span>
                          <h2 className="text-xl font-bold tracking-tight">A9 竞争策略洞察</h2>
                        </div>
                        <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap mono bg-[#131314] p-8 rounded-2xl border border-[#3c4043] text-gray-300">
                          {strategy.analysis}
                        </div>
                      </div>
                    )}
                    
                    {activeTab === 'secondary' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {strategy.secondaryImages.map((img, i) => (
                          <div key={i} className="bg-[#1e1f20] rounded-3xl border border-[#3c4043] overflow-hidden shadow-2xl hover:border-[#A8C7FA]/50 transition-all duration-500">
                            <div className="aspect-square bg-black relative flex items-center justify-center overflow-hidden">
                              {img.generatedImageUrl ? (
                                <img src={img.generatedImageUrl} className="w-full h-full object-cover" alt={img.type} />
                              ) : (
                                <div className="text-center opacity-20 p-12">
                                  <svg className="w-20 h-20 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"/></svg>
                                  <p className="text-xs uppercase font-bold tracking-widest">{img.type}</p>
                                </div>
                              )}
                              <div className="absolute top-6 left-6 bg-[#A8C7FA] text-[#0b0b0b] text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-xl">IMAGE {i + 1}</div>
                            </div>
                            <div className="p-8">
                              <h4 className="text-base font-bold text-white mb-2">{img.copywriting}</h4>
                              <p className="text-sm text-gray-400 mb-6 h-12 line-clamp-3">{img.description}</p>
                              <details className="mt-4 border-t border-[#3c4043] pt-6 cursor-pointer group">
                                <summary className="text-[10px] text-[#A8C7FA] uppercase font-bold flex justify-between items-center tracking-widest">
                                  视觉执行提示词
                                  <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
                                </summary>
                                <div className="mt-4 p-5 bg-black/40 rounded-2xl text-[11px] text-gray-500 mono leading-relaxed break-all border border-[#3c4043]">
                                  {img.visualPrompt}
                                </div>
                              </details>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'aplus' && (
                      <div className="space-y-8">
                        {strategy.aPlusContent.map((module, i) => (
                          <div key={i} className="bg-[#1e1f20] rounded-3xl border border-[#3c4043] overflow-hidden flex flex-col md:flex-row shadow-2xl">
                             <div className="md:w-1/3 aspect-[4/3] bg-black border-r border-[#3c4043] flex items-center justify-center overflow-hidden">
                                {module.generatedImageUrl ? (
                                  <img src={module.generatedImageUrl} className="w-full h-full object-cover" alt={module.moduleType} />
                                ) : (
                                  <div className="text-center opacity-10 font-bold uppercase tracking-widest text-[10px]">视觉预览</div>
                                )}
                             </div>
                             <div className="md:w-2/3 p-10 flex flex-col justify-center">
                                <div className="flex justify-between items-start mb-6">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-[#131314] px-3 py-1 rounded-lg">Module {i + 1}</span>
                                  <span className="text-sm text-[#A8C7FA] font-bold tracking-tight">{module.moduleType}</span>
                                </div>
                                <p className="text-base text-gray-200 mb-8 leading-relaxed">{module.content}</p>
                                <div className="bg-[#131314] p-6 rounded-2xl border border-blue-900/10">
                                  <h5 className="text-[10px] font-bold text-blue-400 uppercase mb-3 tracking-wider">排版引导建议</h5>
                                  <p className="text-xs text-gray-500 italic leading-relaxed">{module.visualGuidance}</p>
                                </div>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>
          </div>
        );
      case 'projects':
        return <main className="flex-1 bg-[#0b0b0b] p-16 overflow-y-auto"><h2 className="text-3xl font-bold mb-10 tracking-tight text-white">历史资产库</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-8">{[1,2,3,4,5,6].map(i => (<div key={i} className="bg-[#1e1f20] border border-[#3c4043] aspect-video rounded-3xl p-8 hover:border-[#A8C7FA] transition-all group cursor-pointer shadow-lg"><div className="w-full h-full bg-black/40 rounded-2xl mb-4 group-hover:bg-black/60 transition-colors" /> <h3 className="text-gray-400 font-bold text-sm tracking-wide">Project Archive 00{i}</h3></div>))}</div></main>;
      case 'settings':
        return (
          <main className="flex-1 bg-[#0b0b0b] p-16 overflow-y-auto flex justify-center custom-scrollbar">
            <div className="w-full max-w-4xl space-y-12 pb-32">
              <h2 className="text-3xl font-bold tracking-tight text-white">引擎架构配置</h2>
              
              <div className="space-y-10">
                {/* Brain Engine Card */}
                <div className="bg-[#1e1f20] border border-[#3c4043] rounded-[32px] overflow-hidden shadow-2xl">
                  <div className="p-8 bg-[#2a2a2c] border-b border-[#3c4043] flex items-center justify-between">
                    <h3 className="font-black text-sm uppercase tracking-tighter flex items-center text-white"><span className="p-2 bg-blue-500/10 text-blue-400 rounded-xl mr-3">🧠</span> 🅰️ 大脑引擎 (逻辑分析)</h3>
                    <button onClick={resetBrainInstruction} className="text-[9px] font-black uppercase text-gray-500 hover:text-white px-4 py-2 border border-[#3c4043] rounded-full transition-all tracking-widest">重置专家指令</button>
                  </div>
                  <div className="p-10 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">服务提供商 (Provider)</label>
                        <select value={config.brain.provider} onChange={(e) => setConfig({...config, brain: {...config.brain, provider: e.target.value as BrainProvider}})} className="w-full bg-[#131314] border border-[#3c4043] rounded-2xl p-4 text-sm outline-none focus:border-[#A8C7FA] text-white">
                          <option value="modelscope">ModelScope (推荐)</option>
                          <option value="gemini">Google Gemini</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">模型名称 (Model ID)</label>
                        <input type="text" value={config.brain.model} onChange={(e) => setConfig({...config, brain: {...config.brain, model: e.target.value}})} className="w-full bg-[#131314] border border-[#3c4043] rounded-2xl p-4 text-sm outline-none focus:border-[#A8C7FA] text-white" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Base URL</label>
                      <input type="text" value={config.brain.baseUrl} onChange={(e) => setConfig({...config, brain: {...config.brain, baseUrl: e.target.value}})} className="w-full bg-[#131314] border border-[#3c4043] rounded-2xl p-4 text-sm outline-none focus:border-[#A8C7FA] text-white" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">智能体角色指令 (System Prompt)</label>
                      <textarea value={config.brain.systemInstruction} onChange={(e) => setConfig({...config, brain: {...config.brain, systemInstruction: e.target.value}})} className="w-full bg-[#131314] border border-[#3c4043] rounded-[24px] p-6 text-sm h-48 outline-none focus:border-[#A8C7FA] mono leading-relaxed text-white" />
                    </div>
                  </div>
                </div>

                {/* Visual Engine Card */}
                <div className="bg-[#1e1f20] border border-[#3c4043] rounded-[32px] overflow-hidden shadow-2xl">
                  <div className="p-8 bg-[#2a2a2c] border-b border-[#3c4043] flex items-center justify-between">
                    <h3 className="font-black text-sm uppercase tracking-tighter flex items-center text-white"><span className="p-2 bg-purple-500/10 text-purple-400 rounded-xl mr-3">🎨</span> 🅱️ 视觉引擎 (图像生成)</h3>
                  </div>
                  <div className="p-10 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">提供商</label>
                        <select value={config.visual.provider} onChange={(e) => setConfig({...config, visual: {...config.visual, provider: e.target.value as any}})} className="w-full bg-[#131314] border border-[#3c4043] rounded-2xl p-4 text-sm outline-none focus:border-[#A8C7FA] text-white">
                          <option value="modelscope">ModelScope (Wanx)</option>
                          <option value="gemini">Google Gemini</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">模型名称</label>
                        <input type="text" value={config.visual.model} onChange={(e) => setConfig({...config, visual: {...config.visual, model: e.target.value}})} className="w-full bg-[#131314] border border-[#3c4043] rounded-2xl p-4 text-sm outline-none focus:border-[#A8C7FA] text-white" />
                      </div>
                    </div>
                    
                    <div className="bg-[#131314] p-6 rounded-2xl border border-[#3c4043] space-y-4">
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">🔑 计费与权限说明</p>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        使用 Gemini 视觉引擎时，系统将通过官方对话框要求您选择已启用计费的 API Key。
                        请确保您的项目已配置：<a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[#A8C7FA] underline ml-1">计费文档</a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#1e1f20] p-10 rounded-3xl border border-dashed border-[#3c4043] text-center">
                <button onClick={() => setConfig({...config, mockMode: !config.mockMode})} className="px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest border border-[#3c4043] hover:bg-[#3c4043] transition-all text-white">
                  {config.mockMode ? '切换到真实请求模式' : '切换到模拟演示模式'}
                </button>
              </div>
            </div>
          </main>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#131314] text-[#e3e3e3]">
      <aside className="w-16 flex flex-col items-center py-10 border-r border-[#3c4043] space-y-12 bg-[#1e1f20] z-50">
        <div onClick={() => setCurrentView('dashboard')} className="w-10 h-10 bg-[#A8C7FA] rounded-2xl flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-xl shadow-blue-500/20">
          <svg className="w-6 h-6 text-[#0b0b0b]" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <div className="flex flex-col space-y-8">
          <button 
            onClick={() => setCurrentView('dashboard')} 
            className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${currentView === 'dashboard' ? 'bg-[#3c4043] text-[#A8C7FA]' : 'text-gray-500 hover:text-white'}`}
            title="主工作台"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.21 1.21 0 0 0 1.72 0L21.64 5.36a1.21 1.21 0 0 0 0-1.72Z"/>
              <path d="m14 7 3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9"/>
            </svg>
          </button>
          <button 
            onClick={() => setCurrentView('projects')} 
            className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${currentView === 'projects' ? 'bg-[#3c4043] text-[#A8C7FA]' : 'text-gray-500 hover:text-white'}`}
            title="项目历史"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
          <button 
            onClick={() => setCurrentView('settings')} 
            className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${currentView === 'settings' ? 'bg-[#3c4043] text-[#A8C7FA]' : 'text-gray-500 hover:text-white'}`}
            title="配置中心"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>
            </svg>
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-10 border-b border-[#3c4043] bg-[#1e1f20]">
          <span className="text-sm font-black uppercase tracking-tight text-white">{currentView === 'dashboard' ? '亚马逊 A9 视觉营销引擎' : currentView === 'projects' ? '全球资产库' : '神经网络核心配置'}</span>
          <div className="flex items-center space-x-4">
             <span className="text-[10px] text-[#A8C7FA] font-mono uppercase bg-[#131314] px-3 py-1 rounded-full border border-[#3c4043]">Active Core: {config.brain.model}</span>
             <button onClick={() => alert('资产已同步到仓库')} className="px-6 py-2 rounded-xl bg-[#A8C7FA] text-[#0b0b0b] font-black text-[10px] uppercase tracking-widest shadow-xl">导出战略方案</button>
          </div>
        </header>
        {renderMainContent()}
      </div>
    </div>
  );
};

export default App;
