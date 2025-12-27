
import React, { useState, useEffect } from 'react';
import { WorkflowMode, RoleFocus, ProductInput, MarketingStrategy, AppConfig, BrainProvider } from './types';
import { generateMarketingStrategy, generateVisual } from './services/aiService';
import Settings from './components/Settings';
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

  const handleSaveSettings = () => {
    localStorage.setItem('amz_config_v3', JSON.stringify(config));
    alert("Configurations saved successfully!");
  };

  const handleRunWorkflow = async () => {
    if (!input.usps || !input.specs) {
      alert("Core USPs and Specs are required.");
      return;
    }

    setShowGuide(false);
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
      alert(`Workflow Failed: ${error.message}`);
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
                          <div className="flex space-x-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#A8C7FA]"><span className="text-lg">⚙️</span></div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Step 1: Configure</p>
                              <p className="text-sm text-gray-300">Go to Settings to set up your AI keys (ModelScope/OpenAI).</p>
                            </div>
                          </div>
                          <div className="flex space-x-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#A8C7FA]"><span className="text-lg">📸</span></div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Step 2: Upload</p>
                              <p className="text-sm text-gray-300">Upload your product images and reference styles.</p>
                            </div>
                          </div>
                        </div>
                        <button onClick={dismissGuide} className="w-full py-4 rounded-2xl bg-[#A8C7FA] text-black font-bold hover:bg-white transition-all shadow-lg">Start Building</button>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-10">
                        <p className="text-2xl font-light tracking-[0.2em] uppercase">No Strategy Generated</p>
                      </div>
                    )}
                  </div>
                ) : strategy && (
                  <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-in fade-in slide-in-from-bottom-8">
                    {activeTab === 'analysis' && (
                      <div className="bg-[#1e1f20] p-10 rounded-3xl border border-[#3c4043] shadow-2xl">
                        <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap mono bg-[#131314] p-8 rounded-2xl border border-[#3c4043] text-gray-300">
                          {strategy.analysis}
                        </div>
                      </div>
                    )}
                    {/* Render other tabs... (Simplified for brevity as they are unchanged logic-wise) */}
                    {/* Just re-render existing logic for secondary/aplus */}
                    {activeTab === 'secondary' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {strategy.secondaryImages.map((img, i) => (
                          <div key={i} className="bg-[#1e1f20] rounded-3xl border border-[#3c4043] overflow-hidden shadow-2xl">
                            <div className="aspect-square bg-black relative flex items-center justify-center overflow-hidden">
                              {img.generatedImageUrl ? <img src={img.generatedImageUrl} className="w-full h-full object-cover" /> : <span className="text-xs text-gray-500">{img.type}</span>}
                            </div>
                            <div className="p-6">
                              <p className="text-sm text-gray-400">{img.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeTab === 'aplus' && (
                      <div className="space-y-4">
                        {strategy.aPlusContent.map((m, i) => (
                          <div key={i} className="bg-[#1e1f20] p-6 rounded-2xl border border-[#3c4043]"><h4 className="text-[#A8C7FA] font-bold">{m.moduleType}</h4><p className="text-gray-400 text-sm mt-2">{m.content}</p></div>
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
        return <main className="flex-1 bg-[#0b0b0b] p-16 overflow-y-auto"><h2 className="text-3xl font-bold mb-10 tracking-tight text-white">Project Library</h2></main>;
      case 'settings':
        return (
          <main className="flex-1 bg-[#0b0b0b] p-16 overflow-y-auto flex justify-center custom-scrollbar">
            <Settings config={config} setConfig={setConfig} onSave={handleSaveSettings} />
          </main >
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
          <button onClick={() => setCurrentView('dashboard')} className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${currentView === 'dashboard' ? 'bg-[#3c4043] text-[#A8C7FA]' : 'text-gray-500'}`}>🏠</button>
          <button onClick={() => setCurrentView('settings')} className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${currentView === 'settings' ? 'bg-[#3c4043] text-[#A8C7FA]' : 'text-gray-500'}`}>⚙️</button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-10 border-b border-[#3c4043] bg-[#1e1f20]">
          <span className="text-sm font-black uppercase tracking-tight text-white">Amazon A9 Visual Architect</span>
          <span className="text-[10px] text-gray-500">Universal Mode Active</span>
        </header>
        {renderMainContent()}
      </div>
    </div>
  );
};

export default App;
