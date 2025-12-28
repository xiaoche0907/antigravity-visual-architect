import React from 'react';
import { AppConfig, BrainProvider } from '../types';

interface SettingsProps {
    config: AppConfig;
    setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
    onSave: () => void;
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig, onSave }) => {

    const handleBrainChange = (field: keyof AppConfig['brain'], value: string) => {
        setConfig(prev => ({
            ...prev,
            brain: { ...prev.brain, [field]: value }
        }));
    };

    const handleVisualChange = (field: keyof AppConfig['visual'], value: string) => {
        setConfig(prev => ({
            ...prev,
            visual: { ...prev.visual, [field]: value }
        }));
    };

    return (
        <div className="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between pb-6 border-b border-[#3c4043]">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">System Configuration</h2>
                    <p className="text-gray-400 text-sm">Manage your AI model connections and environment preferences.</p>
                </div>
                <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                        <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${config.mockMode ? 'text-[#A8C7FA]' : 'text-gray-500'}`}>Mock Mode</span>
                        <div
                            className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${config.mockMode ? 'bg-[#A8C7FA]/20' : 'bg-[#3c4043]'}`}
                            onClick={() => setConfig(prev => ({ ...prev, mockMode: !prev.mockMode }))}
                        >
                            <div className={`w-4 h-4 rounded-full shadow-md transition-all duration-300 ${config.mockMode ? 'bg-[#A8C7FA] translate-x-6' : 'bg-gray-400 translate-x-0'}`} />
                        </div>
                    </label>
                    <button
                        onClick={onSave}
                        className="px-6 py-2.5 bg-[#A8C7FA] hover:bg-[#d2e3fc] text-[#0b0b0b] font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 text-sm"
                    >
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Brain Engine Config */}
                <section className="bg-[#1e1f20] rounded-3xl p-8 border border-[#3c4043] space-y-6">
                    <div className="flex items-center space-x-4 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 text-xl">🧠</div>
                        <h3 className="text-lg font-bold text-white">Brain Engine</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Provider</label>
                            <select
                                value={config.brain.provider}
                                onChange={(e) => handleBrainChange('provider', e.target.value as BrainProvider)}
                                className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-[#A8C7FA] outline-none appearance-none cursor-pointer"
                            >
                                <option value="modelscope">ModelScope (Aliyun)</option>
                                <option value="openai">OpenAI</option>
                                <option value="google">Google Gemini</option>
                                <option value="custom">Custom Endpoint</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">API Key</label>
                            <input
                                type="password"
                                value={config.brain.apiKey || ''}
                                onChange={(e) => handleBrainChange('apiKey', e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-[#A8C7FA] outline-none placeholder-gray-600"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Model Name</label>
                            <input
                                type="text"
                                value={config.brain.model}
                                onChange={(e) => handleBrainChange('model', e.target.value)}
                                className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-[#A8C7FA] outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Base URL</label>
                            <input
                                type="text"
                                value={config.brain.baseUrl}
                                onChange={(e) => handleBrainChange('baseUrl', e.target.value)}
                                className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-gray-400 focus:ring-1 focus:ring-[#A8C7FA] outline-none font-mono tracking-tight"
                            />
                        </div>
                    </div>
                </section>

                {/* Visual Engine Config */}
                <section className="bg-[#1e1f20] rounded-3xl p-8 border border-[#3c4043] space-y-6">
                    <div className="flex items-center space-x-4 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 text-xl">🎨</div>
                        <h3 className="text-lg font-bold text-white">Visual Engine</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Provider</label>
                            <select
                                value={config.visual.provider}
                                onChange={(e) => handleVisualChange('provider', e.target.value)}
                                className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-[#A8C7FA] outline-none appearance-none cursor-pointer"
                            >
                                <option value="modelscope">ModelScope (Wanx)</option>
                                <option value="openai">DALL·E 3</option>
                                <option value="custom">Custom / Midjourney Proxy</option>
                            </select>
                        </div>

                        <div className="flex items-center space-x-3 py-1">
                            <input
                                type="checkbox"
                                checked={config.visual.useSameKeyAsBrain}
                                onChange={(e) => setConfig(prev => ({ ...prev, visual: { ...prev.visual, useSameKeyAsBrain: e.target.checked } }))}
                                className="w-4 h-4 rounded border-gray-600 bg-[#131314] text-[#A8C7FA] focus:ring-0 focus:ring-offset-0"
                            />
                            <span className="text-sm text-gray-400">Use same API Key as Brain</span>
                        </div>

                        {!config.visual.useSameKeyAsBrain && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Visual API Key</label>
                                <input
                                    type="password"
                                    value={config.visual.apiKey || ''}
                                    onChange={(e) => handleVisualChange('apiKey', e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-[#A8C7FA] outline-none"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Model Name</label>
                            <input
                                type="text"
                                value={config.visual.model}
                                onChange={(e) => handleVisualChange('model', e.target.value)}
                                className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-[#A8C7FA] outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Base URL</label>
                            <input
                                type="text"
                                value={config.visual.baseUrl}
                                onChange={(e) => handleVisualChange('baseUrl', e.target.value)}
                                className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-gray-400 focus:ring-1 focus:ring-[#A8C7FA] outline-none font-mono tracking-tight"
                            />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Settings;
