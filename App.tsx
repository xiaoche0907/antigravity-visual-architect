import React, { useState, useEffect } from 'react';
import { AppConfig, ProductInput, MarketingStrategy, WorkflowMode, RoleFocus, HistorySession, PersonalAgent } from './types';
import { ModelConfig } from './types/models';
import { DEFAULT_SYSTEM_INSTRUCTION } from './constants';
import Sidebar from './components/Sidebar';
// New Components
import Workspace from './components/Workspace';
import EmployeeConfig from './components/EmployeeConfig';
import PersonalAgents from './components/PersonalAgents';
import ModelManager from './components/ModelManager';

const App: React.FC = () => {
  // Navigation State
  const [currentView, setCurrentView] = useState<'work' | 'employees' | 'myagents' | 'models'>('work');

  // Persistence Key
  const CONFIG_KEY = 'amz_visual_architect_v4';
  const HISTORY_KEY = 'amz_visual_history_v1';
  const MODELS_KEY = 'amz_model_configs_v1';
  const PERSONAL_AGENTS_KEY = 'amz_personal_agents_v1';

  // --- CONFIG STATE ---
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved config", e);
      }
    }
    return {
      mockMode: false,
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

  // --- MODEL CONFIGS STATE ---
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>(() => {
    const saved = localStorage.getItem(MODELS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved models", e);
      }
    }
    return [];
  });

  // Selected model IDs for Brain and Visual
  const [selectedBrainModelId, setSelectedBrainModelId] = useState<string>('');
  const [selectedVisualModelId, setSelectedVisualModelId] = useState<string>('');

  // --- WORKSPACE STATE (LIFTED) ---
  const [loadingState, setLoadingState] = useState<'idle' | 'analyzing' | 'generating'>('idle');
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

  // --- HISTORY STATE ---
  const [history, setHistory] = useState<HistorySession[]>(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    try { return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });

  // --- PERSONAL AGENTS STATE ---
  const [personalAgents, setPersonalAgents] = useState<PersonalAgent[]>(() => {
    const saved = localStorage.getItem(PERSONAL_AGENTS_KEY);
    try { return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });

  // --- ACTIVE AGENT STATE ---
  // 用于追踪当前激活的智能体，从「我的智能体」跳转到工作台时使用
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  // Auto-save Config
  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  // Auto-save Model Configs
  useEffect(() => {
    localStorage.setItem(MODELS_KEY, JSON.stringify(modelConfigs));
  }, [modelConfigs]);

  // Auto-save History
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  // Auto-save Personal Agents
  useEffect(() => {
    localStorage.setItem(PERSONAL_AGENTS_KEY, JSON.stringify(personalAgents));
  }, [personalAgents]);

  // --- ACTIONS ---
  const addToHistory = () => {
    if (!strategy && input.productImages.length === 0) return false;

    const newSession: HistorySession = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      title: input.usps ? input.usps.slice(0, 15) + '...' : `Project ${new Date().toLocaleTimeString()}`,
      thumbnail: input.productImages[0] || (strategy?.secondaryImages[0]?.generatedImageUrl) || undefined,
      input: JSON.parse(JSON.stringify(input)),
      strategy: strategy ? JSON.parse(JSON.stringify(strategy)) : null,
      mode,
      roleFocus
    };
    setHistory(prev => [newSession, ...prev]);
    return true;
  };

  const restoreSession = (session: HistorySession) => {
    if (window.confirm("确定要加载历史记录吗？当前未保存的工作将被覆盖。")) {
      setInput(JSON.parse(JSON.stringify(session.input)));
      setStrategy(session.strategy ? JSON.parse(JSON.stringify(session.strategy)) : null);
      setMode(session.mode);
      setRoleFocus(session.roleFocus);
      setCurrentView('work');
    }
  };

  const deleteSession = (id: string) => {
    if (window.confirm("确定要删除这条历史记录吗？")) {
      setHistory(prev => prev.filter(h => h.id !== id));
    }
  };

  // 保存智能体并跳转到工作台
  const handleSaveAndNavigate = (agentId: string) => {
    console.log('🚀 [App] 激活智能体并跳转到工作台:', agentId);
    const agent = personalAgents.find(a => a.id === agentId);

    if (!agent) {
      alert('⚠️ 智能体不存在');
      return;
    }

    // 设置激活的智能体
    setActiveAgentId(agentId);

    // 自动选择该智能体绑定的模型
    if (agent.modelId) {
      setSelectedBrainModelId(agent.modelId);
      console.log('✅ [App] 已自动选择模型:', agent.modelId);
    }

    // 切换到工作台视图
    setCurrentView('work');
    console.log('✅ [App] 已切换到工作台视图');
  };

  // View Routing
  const renderView = () => {
    switch (currentView) {
      case 'work':
        return (
          <Workspace
            config={config}
            onNavigateSettings={() => setCurrentView('models')}
            // Model Configs
            modelConfigs={modelConfigs}
            selectedBrainModelId={selectedBrainModelId}
            selectedVisualModelId={selectedVisualModelId}
            // Parameters
            loadingState={loadingState} setLoadingState={setLoadingState}
            activeTab={activeTab} setActiveTab={setActiveTab}
            mode={mode} setMode={setMode}
            roleFocus={roleFocus} setRoleFocus={setRoleFocus}
            input={input} setInput={setInput}
            strategy={strategy} setStrategy={setStrategy}
            // History
            history={history}
            onSaveToHistory={addToHistory}
            onRestoreSession={restoreSession}
            onDeleteSession={deleteSession}
          />
        );
      case 'employees':
        return (
          <EmployeeConfig
            config={config}
            setConfig={setConfig}
            modelConfigs={modelConfigs}
            selectedBrainModelId={selectedBrainModelId}
            selectedVisualModelId={selectedVisualModelId}
            onBrainModelChange={setSelectedBrainModelId}
            onVisualModelChange={setSelectedVisualModelId}
            onNavigateToModels={() => setCurrentView('models')}
          />
        );
      case 'myagents':
        return (
          <PersonalAgents
            agents={personalAgents}
            onAgentsChange={setPersonalAgents}
            modelConfigs={modelConfigs}
            onNavigateToModels={() => setCurrentView('models')}
          />
        );
      case 'models':
        return <ModelManager models={modelConfigs} onModelsChange={setModelConfigs} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#131314] text-[#e3e3e3]">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} config={config} setConfig={setConfig} />

      <div className="flex-1 flex flex-col min-w-0 bg-[#0b0b0b]">
        {/* Universal Header */}
        <header className="h-16 flex items-center justify-between px-10 border-b border-[#3c4043] bg-[#1e1f20]">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-black uppercase tracking-tight text-white">Amazon A9 Visual Architect</span>
            <span className="px-2 py-0.5 rounded bg-[#3c4043] text-[9px] font-mono text-gray-400">RC-3.0 ZONE-ARCH</span>
          </div>
          <div className="flex items-center space-x-4">
            {config.mockMode ? (
              <span className="px-2 py-1 rounded bg-yellow-900/40 text-yellow-400 text-[9px] font-bold animate-pulse flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-2"></span>
                模拟环境
              </span>
            ) : (
              <span className="px-2 py-1 rounded bg-green-900/40 text-green-400 text-[9px] font-bold flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2"></span>
                真实环境
              </span>
            )}
          </div>
        </header>

        {renderView()}
      </div>
    </div>
  );
};

export default App;
