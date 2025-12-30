import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PersonalAgent } from '../types';
import { ModelConfig } from '../types/models';
import { GoogleGenAI } from '@google/genai';
import MarkdownRenderer from './MarkdownRenderer';

interface PersonalAgentsProps {
    agents: PersonalAgent[];
    onAgentsChange: (agents: PersonalAgent[]) => void;
    modelConfigs: ModelConfig[];
    onNavigateToModels: () => void;
    onSaveAndNavigate?: (agentId: string) => void;
}

const EMOJI_PRESETS = ['🤖', '✨', '💡', '🎯', '🚀', '💬', '📝', '🎨', '🧠', '⚡'];

const EXPERT_TEMPLATE = `# Role: [角色名称]

## Profile
- Author: [你的名字]
- Version: 1.0
- Description: [简要描述]

## Rules
1. 始终保持专业和友好的态度
2. 提供准确、有价值的信息
3. 根据用户需求调整回复风格

## Workflow
1. 第一步：理解用户意图
2. 第二步：分析问题核心
3. 第三步：提供解决方案
4. 第四步：确认用户满意度

## Initialization
作为 [角色名称]，我将竭诚为您服务。请告诉我您的需求。`;

interface ChatMessage {
    role: 'user' | 'assistant' | 'error';
    content: string;
    attachments?: string[];
    timestamp: number;
}

// 会话状态接口
interface AgentSession {
    mode: 'edit' | 'chat';
    messages: ChatMessage[];
    lastUpdated: number;
}

// 工具函数：生成 localStorage 键
const getSessionKey = (agentId: string): string => `agent_session_${agentId}`;

// 工具函数：从 localStorage 读取会话
const loadAgentSession = (agentId: string): AgentSession | null => {
    try {
        const key = getSessionKey(agentId);
        const saved = localStorage.getItem(key);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.error('Failed to load agent session:', error);
    }
    return null;
};

// 工具函数：保存会话到 localStorage（带防抖）
let saveTimer: NodeJS.Timeout | null = null;
const saveAgentSession = (agentId: string, session: Partial<AgentSession>): void => {
    if (saveTimer) clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
        try {
            const key = getSessionKey(agentId);
            const existing = loadAgentSession(agentId);
            const merged: AgentSession = {
                mode: session.mode ?? existing?.mode ?? 'edit',
                messages: session.messages ?? existing?.messages ?? [],
                lastUpdated: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(merged));
        } catch (error) {
            console.error('Failed to save agent session:', error);
        }
    }, 300);
};

const PersonalAgents: React.FC<PersonalAgentsProps> = ({
    agents,
    onAgentsChange,
    modelConfigs,
    onNavigateToModels,
}) => {
    // 基础状态
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
        agents.length > 0 ? agents[0].id : null
    );
    const [viewMode, setViewMode] = useState<'edit' | 'chat'>('edit');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // 编辑器状态
    const [editingPrompt, setEditingPrompt] = useState<string>('');
    const [editingName, setEditingName] = useState<string>('');
    const [editingAvatar, setEditingAvatar] = useState<string>('');
    const [editingModelId, setEditingModelId] = useState<string>('');

    // 聊天状态
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [previewExpanded, setPreviewExpanded] = useState<boolean>(false);
    // ✅ 新增：加载状态标记，防止初始化时的空数据覆盖由于 saveAgentSession 导致的 localStorage 清空
    const [isSessionLoaded, setIsSessionLoaded] = useState<boolean>(false);

    // 📎 附件状态
    const [attachments, setAttachments] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 防抖状态：用于预览区渲染
    const [debouncedPrompt, setDebouncedPrompt] = useState<string>('');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 计算属性
    const enabledTextModels = modelConfigs.filter(m => m.category === 'text' && m.isEnabled);
    const selectedAgent = agents.find(a => a.id === selectedAgentId) || null;

    // 防抖效果：当用户停止输入 500ms 后，更新预览
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            setDebouncedPrompt(editingPrompt);
        }, 500); // 500ms 防抖延迟

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [editingPrompt]);

    // 当选择智能体改变时，重置所有状态并进入编辑模式
    // 使用 ref 来跟踪上一次的 agentId，只有真正切换智能体时才重置
    const prevAgentIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (selectedAgent) {
            const agentChanged = prevAgentIdRef.current !== selectedAgent.id;

            // 总是同步编辑器状态（这样从对话返回编辑时能看到最新保存的数据）
            setEditingPrompt(selectedAgent.systemPrompt);
            setEditingName(selectedAgent.name);
            setEditingAvatar(selectedAgent.avatar);
            setEditingModelId(selectedAgent.modelId);
            setDebouncedPrompt(selectedAgent.systemPrompt);

            // 只有真正切换到不同的智能体时，才从 localStorage 恢复状态
            if (agentChanged) {
                setIsSessionLoaded(false); // 切换时先标记为未加载

                // 🔥 核心修改：从 localStorage 恢复会话状态
                const savedSession = loadAgentSession(selectedAgent.id);
                if (savedSession) {
                    setViewMode(savedSession.mode || 'edit');
                    setChatMessages(savedSession.messages || []);
                } else {
                    // 首次打开该智能体，默认编辑模式
                    setViewMode('edit');
                    setChatMessages([]);
                }

                setIsSessionLoaded(true); // 加载完成

                // 仅重置输入框，保留其他状态
                setUserInput('');
                setAttachments([]); // 清空附件
                prevAgentIdRef.current = selectedAgent.id;
            }
        }
    }, [selectedAgent?.id]);

    // 自动保存会话状态到 localStorage
    useEffect(() => {
        // 🚨 只有当会话确实加载完成后，且有选中的智能体时才保存
        // 防止组件挂载时的初始空状态覆盖掉 localStorage 中的历史记录
        if (selectedAgent && isSessionLoaded) {
            saveAgentSession(selectedAgent.id, {
                mode: viewMode,
                messages: chatMessages,
                lastUpdated: Date.now()
            });
        }
    }, [selectedAgent?.id, viewMode, chatMessages, isSessionLoaded]);


    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    }, []);

    // ... (keep create/delete handlers) ... 
    const handleCreateAgent = useCallback(() => {
        const newAgent: PersonalAgent = {
            id: `agent_${Date.now()}`,
            name: '新智能体',
            avatar: '🤖',
            modelId: enabledTextModels[0]?.id || '',
            systemPrompt: '你是一个智能助手，请根据用户需求提供帮助。',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        const updatedAgents = [...agents, newAgent];
        onAgentsChange(updatedAgents);
        setSelectedAgentId(newAgent.id);
        showToast('✅ 新智能体已创建');
    }, [agents, enabledTextModels, onAgentsChange, showToast]);

    const handleDeleteAgent = useCallback((e: React.MouseEvent, agentId: string) => {
        e.stopPropagation(); // 阻止冒泡，防止触发选中操作

        const agentToDelete = agents.find(a => a.id === agentId);
        if (!agentToDelete) return;

        if (!confirm(`确定要删除智能体"${agentToDelete.name}"吗？删除后无法恢复。`)) return;

        // 1. 从列表删除
        const updatedAgents = agents.filter(a => a.id !== agentId);
        onAgentsChange(updatedAgents);

        // 2. 清理关联的 Session 缓存
        localStorage.removeItem(getSessionKey(agentId));

        // 3. 如果删的是当前选中的，重置选中状态
        if (selectedAgentId === agentId) {
            setSelectedAgentId(updatedAgents.length > 0 ? updatedAgents[0].id : null);
        }

        showToast('🗑️ 智能体已删除');
    }, [agents, onAgentsChange, selectedAgentId, showToast]);

    const handleSave = useCallback(() => {
        if (!selectedAgent) return;
        const updatedAgents = agents.map(a =>
            a.id === selectedAgent.id
                ? {
                    ...a,
                    name: editingName,
                    avatar: editingAvatar,
                    modelId: editingModelId,
                    systemPrompt: editingPrompt,
                    updatedAt: Date.now()
                }
                : a
        );
        onAgentsChange(updatedAgents);
        console.log('✅ [PersonalAgents] 数据已保存');
    }, [selectedAgent, agents, editingName, editingAvatar, editingModelId, editingPrompt, onAgentsChange]);

    const handleSaveAndChat = useCallback(() => {
        if (!editingModelId) {
            alert('⚠️ 请先绑定一个模型配置');
            return;
        }
        handleSave();
        setViewMode('chat');
        showToast('💾 已保存并进入对话模式');
    }, [editingModelId, handleSave, showToast]);

    // 清除会话功能
    const handleClearSession = useCallback(() => {
        if (!selectedAgent) return;
        if (!confirm(`确定要清除与"${selectedAgent.name}"的所有聊天记录吗？`)) return;

        // 清空 localStorage
        localStorage.removeItem(getSessionKey(selectedAgent.id));

        // 重置状态
        setChatMessages([]);
        setViewMode('edit');
        setUserInput('');
        setAttachments([]);

        showToast('🗑️ 会话已清除');
    }, [selectedAgent, showToast]);

    // 📎 文件处理逻辑
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setAttachments(prev => [...prev, ev.target!.result as string]);
                }
            };
            reader.readAsDataURL(file);
        });

        // Reset input for continuous upload
        e.target.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // 核心聊天逻辑
    const handleSendMessage = useCallback(async () => {
        if (!userInput.trim() && attachments.length === 0) return;

        const currentModelId = editingModelId;
        const currentSystemPrompt = editingPrompt;

        if (!currentModelId) {
            setChatMessages(prev => [...prev, { role: 'error', content: '⚠️ 未配置模型', timestamp: Date.now() }]);
            return;
        }

        const selectedModel = modelConfigs.find(m => m.id === currentModelId);
        if (!selectedModel) {
            setChatMessages(prev => [...prev, { role: 'error', content: '⚠️ 模型配置无效', timestamp: Date.now() }]);
            return;
        }

        // 替换变量
        const finalSystemPrompt = currentSystemPrompt.replace(/\{\{user_input\}\}/g, userInput);

        // 添加用户消息 (包含图片)
        const userMsg: ChatMessage = {
            role: 'user',
            content: userInput,
            attachments: [...attachments], // Save snapshot of current attachments
            timestamp: Date.now()
        };

        setChatMessages(prev => [...prev, userMsg]);
        setUserInput('');
        setAttachments([]); // Clear UI state immediately
        setIsGenerating(true);

        try {
            let responseText = '';

            if (selectedModel.provider === 'google') {
                const ai = new GoogleGenAI({ apiKey: selectedModel.apiKey });

                // Construct Google Parts
                const parts: any[] = [];
                if (userInput.trim()) {
                    parts.push({ text: userInput });
                }
                // Add images
                userMsg.attachments?.forEach(img => {
                    // Extract base64 info: data:image/jpeg;base64,....
                    const matches = img.match(/^data:(.+);base64,(.+)$/);
                    if (matches) {
                        parts.push({
                            inlineData: {
                                mimeType: matches[1],
                                data: matches[2]
                            }
                        });
                    }
                });

                const response = await ai.models.generateContent({
                    model: selectedModel.modelId,
                    contents: { parts },
                    config: { systemInstruction: finalSystemPrompt }
                });
                responseText = response.text?.trim() || '[空响应]';

            } else {
                // OpenAI Compatible
                const endpoint = selectedModel.baseUrl.endsWith('/chat/completions')
                    ? selectedModel.baseUrl
                    : `${selectedModel.baseUrl.replace(/\/$/, '')}/chat/completions`;

                // Construct OpenAI Messages
                let messageContent: any = userInput;

                if (userMsg.attachments && userMsg.attachments.length > 0) {
                    messageContent = [];
                    if (userInput.trim()) {
                        messageContent.push({ type: 'text', text: userInput });
                    }
                    userMsg.attachments.forEach(img => {
                        messageContent.push({
                            type: 'image_url',
                            image_url: { url: img }
                        });
                    });
                }

                const messages = [
                    { role: 'system', content: finalSystemPrompt },
                    { role: 'user', content: messageContent }
                ];

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${selectedModel.apiKey}`
                    },
                    body: JSON.stringify({
                        model: selectedModel.modelId,
                        messages,
                        temperature: 0.7
                    })
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                responseText = data.choices?.[0]?.message?.content || '[空响应]';
            }

            setChatMessages(prev => [...prev, { role: 'assistant', content: responseText, timestamp: Date.now() }]);

        } catch (err: any) {
            console.error(err);
            setChatMessages(prev => [...prev, { role: 'error', content: `❌ 错误: ${err.message}`, timestamp: Date.now() }]);
        } finally {
            setIsGenerating(false);
        }
    }, [userInput, attachments, editingModelId, editingPrompt, modelConfigs]);

    // ... (RenderEditor stays mostly same) ...
    const RenderEditor = useMemo(() => (
        <div className="flex flex-col h-full bg-[#0b0b0b] animate-in fade-in zoom-in-95 duration-200">
            {/* 顶部元数据行 */}
            <div className="p-6 border-b border-[#3c4043] bg-[#1e1f20] flex items-center gap-6">
                {/* 头像 */}
                <div className="relative group">
                    <button className="w-16 h-16 text-4xl bg-[#2a2a2c] rounded-2xl flex items-center justify-center border-2 border-[#3c4043] group-hover:border-purple-500 transition-all">
                        {editingAvatar}
                    </button>
                    <div className="absolute top-full mt-2 left-0 bg-[#2a2a2c] border border-[#3c4043] p-2 rounded-xl grid grid-cols-5 gap-1 w-64 hidden group-hover:grid shadow-xl z-50">
                        {EMOJI_PRESETS.map(e => (
                            <button key={e} onClick={() => setEditingAvatar(e)} className="w-10 h-10 text-xl hover:bg-[#3c4043] rounded-lg">{e}</button>
                        ))}
                    </div>
                </div>

                {/* 基本信息 */}
                <div className="flex-1 space-y-3">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">智能体名称</label>
                            <input
                                type="text"
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                className="w-full bg-[#0b0b0b] border-b-2 border-[#3c4043] focus:border-purple-500 px-0 py-2 text-xl font-bold text-white outline-none transition-colors"
                                placeholder="给你的智能体起个名字..."
                            />
                        </div>
                        <div className="w-64">
                            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">绑定模型</label>
                            <select
                                value={editingModelId}
                                onChange={e => setEditingModelId(e.target.value)}
                                className="w-full bg-[#2a2a2c] border border-[#3c4043] rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                            >
                                <option value="">选择模型...</option>
                                {enabledTextModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* 中间核心：Prompt Engineering Workbench */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
                {/* 工具栏 */}
                <div className="h-10 bg-[#252526] border-b border-[#3c4043] flex items-center px-4 gap-3">
                    <span className="text-xs text-gray-500 uppercase font-bold mr-2">PROMPT EDITOR</span>
                    <button onClick={() => { setEditingPrompt(EXPERT_TEMPLATE); showToast('已插入模板'); }} className="px-2 py-1 hover:bg-[#3c3c3c] rounded text-xs text-gray-300 flex items-center gap-1 transition-colors">
                        <span>⚡</span> 插入专家框架
                    </button>
                    <button onClick={() => { setEditingPrompt(prev => prev + '{{user_input}}'); showToast('已插入变量'); }} className="px-2 py-1 hover:bg-[#3c3c3c] rounded text-xs text-gray-300 flex items-center gap-1 transition-colors">
                        <span>📦</span> 插入变量
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={() => setPreviewExpanded(!previewExpanded)}
                        className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${previewExpanded ? 'bg-purple-500/20 text-purple-300' : 'hover:bg-[#3c3c3c] text-gray-400'}`}
                    >
                        <span>👁️</span> 预览编译
                    </button>
                </div>

                {/* 编辑区 */}
                <div className="flex-1 relative">
                    <textarea
                        value={editingPrompt}
                        onChange={e => setEditingPrompt(e.target.value)}
                        className="absolute inset-0 w-full h-full bg-[#1e1e1e] text-[#d4d4d4] p-6 font-mono text-sm leading-relaxed outline-none resize-none custom-scrollbar"
                        spellCheck={false}
                        style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Courier New', monospace" }}
                        placeholder="// 在这里编写 System Prompt..."
                    />
                </div>

                {/* 底部预览区 (Collapse) - 使用防抖后的状态 */}
                {previewExpanded && (
                    <div className="h-48 border-t border-[#3c4043] bg-[#0d0d0d] flex flex-col p-4 animate-in slide-in-from-bottom-5">
                        <h4 className="text-xs text-gray-500 font-bold mb-2 flex items-center gap-2">
                            DEBUG PREVIEW (System Prompt + Placeholder)
                            {editingPrompt !== debouncedPrompt && (
                                <span className="text-yellow-500 animate-pulse">⏳ 更新中...</span>
                            )}
                        </h4>
                        <div className="flex-1 overflow-auto font-mono text-xs text-green-400 whitespace-pre-wrap opacity-80">
                            {debouncedPrompt.replace(/\{\{user_input\}\}/g, '[USER_INPUT_WILL_GO_HERE]')}
                        </div>
                    </div>
                )}
            </div>

            {/* 底部 Action Bar */}
            <div className="p-4 bg-[#1e1f20] border-t border-[#3c4043] flex justify-end">
                <button
                    onClick={handleSaveAndChat}
                    className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-purple-900/20 flex items-center gap-2 transition-all transform hover:scale-[1.02]"
                >
                    <span>💾</span>
                    <span>保存并开始对话</span>
                </button>
            </div>
        </div>
    ), [editingAvatar, editingName, editingModelId, enabledTextModels, editingPrompt, debouncedPrompt, previewExpanded, handleSaveAndChat, showToast]);

    // --- 渲染函数：对话模式 (使用 useMemo 优化) ---
    const RenderChat = useMemo(() => (
        <div className="flex flex-col h-full bg-[#343541] animate-in fade-in duration-300">
            {/* 沉浸式顶部导航 */}
            <header className="h-16 border-b border-black/10 bg-[#343541] flex items-center justify-between px-6 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="text-2xl">{editingAvatar}</div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-100">{editingName}</h2>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-xs text-gray-400">
                                {modelConfigs.find(m => m.id === editingModelId)?.name || 'Unknown Model'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleClearSession}
                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-red-500/20"
                    >
                        <span>🗑️</span>
                        <span>清除会话</span>
                    </button>
                    <button
                        onClick={() => setViewMode('edit')}
                        className="px-4 py-2 bg-[#40414f] hover:bg-[#545563] text-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-white/5"
                    >
                        <span>✏️</span>
                        <span>修改配置</span>
                    </button>
                </div>
            </header>

            {/* 聊天区域 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 space-y-8 bg-[#343541] scroll-smooth">
                {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 select-none pb-20">
                        <div className="text-8xl mb-4 grayscale opacity-50 bg-[#40414f] rounded-3xl p-6">{editingAvatar}</div>
                        <h3 className="text-xl font-medium text-gray-400">How can I help you today?</h3>
                    </div>
                ) : (
                    <div className="flex flex-col w-full items-center pb-32 pt-8">
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`w-full flex justify-center py-2 ${msg.role === 'user' ? 'bg-transparent' : 'bg-transparent'}`}>
                                <div className="w-full max-w-3xl flex gap-6 px-4 md:px-0 relative group">
                                    <div className={`text-3xl shrink-0 select-none ${msg.role === 'user' ? 'order-2' : ''}`}>
                                        {msg.role === 'user' ? (
                                            <div className="w-8 h-8 rounded-sm bg-[#5436DA] flex items-center justify-center text-sm text-white">
                                                👤
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-sm overflow-hidden flex items-center justify-center text-xl bg-[#19c37d] border border-black/10 shadow-sm">
                                                {editingAvatar}
                                            </div>
                                        )}
                                    </div>

                                    <div className={`prose prose-invert max-w-none flex-1 min-w-0 ${msg.role === 'user' ? 'text-right order-1' : ''}`}>
                                        {/* Name for AI */}
                                        {msg.role === 'assistant' && (
                                            <div className="font-bold text-sm text-gray-300 mb-1">{editingName}</div>
                                        )}

                                        {/* Attachments */}
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className={`flex flex-wrap gap-2 mb-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                                {msg.attachments.map((img, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={img}
                                                        className="max-h-48 rounded-lg border border-white/10 hover:opacity-90 transition-opacity cursor-pointer"
                                                        alt="Upload"
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        <div className={`text-gray-100 leading-7 text-[16px] ${msg.role === 'user' ? 'bg-[#40414f] inline-block px-5 py-3 rounded-2xl rounded-tr-sm text-left' : ''}`}>
                                            {msg.role === 'user' ? (
                                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                            ) : (
                                                <MarkdownRenderer content={msg.content} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isGenerating && (
                            <div className="w-full flex justify-center py-6">
                                <div className="w-full max-w-3xl flex gap-6 px-4 md:px-0">
                                    <div className="w-8 h-8 rounded-sm overflow-hidden flex items-center justify-center text-xl bg-[#19c37d] border border-black/10 shadow-sm shrink-0">
                                        {editingAvatar}
                                    </div>
                                    <div className="flex items-center gap-1 h-7">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 输入区域 */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#343541] via-[#343541] to-transparent pt-10 pb-6 px-4">
                <div className="max-w-3xl mx-auto relative">
                    {/* 附件预览区 (Floating above) */}
                    {attachments.length > 0 && (
                        <div className="absolute -top-24 left-0 right-0 flex gap-3 p-3 overflow-x-auto custom-scrollbar">
                            {attachments.map((img, idx) => (
                                <div key={idx} className="relative flex-shrink-0 group">
                                    <img src={img} className="h-20 w-20 object-cover rounded-xl border-2 border-white/20 shadow-lg bg-[#40414f]" alt="preview" />
                                    <button
                                        onClick={() => removeAttachment(idx)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-100 hover:scale-110 transition-all shadow-lg"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative cursor-text bg-[#40414f] rounded-2xl shadow-xl border border-black/20 overflow-hidden ring-1 ring-white/5 focus-within:ring-white/10 transition-shadow">
                        <div className="flex items-end pl-3">
                            {/* 文件上传按钮 */}
                            <div className="pb-3 text-gray-400 hover:text-white transition-colors">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 rounded-lg hover:bg-black/20 transition-colors"
                                    title="上传图片"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                            </div>

                            <textarea
                                value={userInput}
                                onChange={e => setUserInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                disabled={isGenerating}
                                placeholder={`Message ${editingName}...`}
                                className="flex-1 bg-transparent text-white border-0 focus:ring-0 py-4 px-3 max-h-52 min-h-[56px] resize-none outline-none custom-scrollbar placeholder-gray-400/50 text-[16px]"
                                rows={1}
                                style={{ height: '56px' }}
                            />

                            <div className="pr-3 pb-3">
                                <button
                                    onClick={handleSendMessage}
                                    disabled={(!userInput.trim() && attachments.length === 0) || isGenerating}
                                    className={`p-2 rounded-lg transition-colors ${(!userInput.trim() && attachments.length === 0) ? 'bg-transparent text-gray-500 cursor-default' : 'bg-[#19c37d] text-white hover:bg-[#1a885d] shadow-sm'}`}
                                >
                                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="text-center text-[10px] text-gray-500 mt-2 select-none">
                        Amazon A9 Agent can make mistakes. Consider checking important information.
                    </div>
                </div>
            </div>
        </div>
    ), [editingAvatar, editingName, editingModelId, modelConfigs, chatMessages, isGenerating, userInput, handleSendMessage, attachments]);

    return (
        <div className="flex-1 bg-[#0b0b0b] flex overflow-hidden relative">
            {/* 全局 Toast */}
            {toastMessage && (
                <div className="fixed top-20 right-10 bg-[#3c4043] text-white px-6 py-3 rounded-xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-4 border border-gray-600 flex items-center">
                    {toastMessage}
                </div>
            )}

            {/* 左侧侧边栏 (始终可见) */}
            <aside className="w-72 bg-[#1e1f20] border-r border-[#3c4043] flex flex-col z-20">
                <div className="p-5 border-b border-[#3c4043]">
                    <h2 className="text-lg font-bold text-white mb-1">Agent Lab</h2>
                    <p className="text-xs text-gray-400">RC-3.0 Pro Studio</p>
                </div>
                <div className="p-3">
                    <button
                        onClick={handleCreateAgent}
                        className="w-full py-2 bg-[#2a2a2c] hover:bg-[#3c3c3e] text-gray-300 rounded-lg text-sm border border-[#3c4043] transition-all flex items-center justify-center gap-2 group"
                    >
                        <span className="text-purple-500 group-hover:scale-110 transition-transform">➕</span> 创建智能体
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {agents.map(agent => (
                        <button
                            key={agent.id}
                            onClick={() => setSelectedAgentId(agent.id)}
                            className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 group relative ${selectedAgentId === agent.id ? 'bg-[#343541] text-white' : 'hover:bg-[#2a2a2c] text-gray-400'
                                }`}
                        >
                            <span className="text-2xl">{agent.avatar}</span>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{agent.name}</div>
                                <div className="text-[10px] opacity-60 truncate">Updated {new Date(agent.updatedAt).toLocaleDateString()}</div>
                            </div>
                            {selectedAgentId === agent.id && (
                                <div className="absolute right-10 w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                            )}
                            {/* 🗑️ 删除按钮 */}
                            <button
                                onClick={(e) => handleDeleteAgent(e, agent.id)}
                                className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                                title="删除智能体"
                            >
                                <span className="text-sm">🗑️</span>
                            </button>
                        </button>
                    ))}
                </div>
            </aside>

            {/* 主内容区域 */}
            <main className="flex-1 overflow-hidden relative">
                {selectedAgent ? (
                    viewMode === 'edit' ? RenderEditor : RenderChat
                ) : (
                    <div className="flex h-full items-center justify-center flex-col text-gray-500">
                        <div className="text-6xl mb-4 grayscale opacity-20">🤖</div>
                        <p>Select or create an agent to start</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PersonalAgents;
