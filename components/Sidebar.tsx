import React from 'react';
import { LayoutDashboard, Users, Sparkles, Database } from 'lucide-react';
import { AppConfig } from '../types';

interface SidebarProps {
    currentView: 'work' | 'employees' | 'myagents' | 'models';
    onNavigate: (view: 'work' | 'employees' | 'myagents' | 'models') => void;
    config: AppConfig;
    setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, config, setConfig }) => {

    const navItems = [
        { id: 'work', icon: LayoutDashboard, label: '工作台' },
        { id: 'employees', icon: Users, label: '标准员工' },
        { id: 'myagents', icon: Sparkles, label: '我的智能体' },
        { id: 'models', icon: Database, label: '模型资产' },
    ] as const;

    return (
        <aside className="w-20 flex flex-col items-center py-8 border-r border-[#3c4043] space-y-8 bg-[#1e1f20] z-50">
            {/* Logo / Brand Icon */}
            <div className="w-12 h-12 bg-gradient-to-br from-[#A8C7FA] to-[#8AB4F8] rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 mb-4 cursor-default">
                <svg className="w-7 h-7 text-[#0b0b0b]" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>

            {/* Navigation Items */}
            <div className="flex flex-col space-y-6 w-full px-2">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`group relative flex items-center justify-center w-full aspect-square rounded-2xl transition-all duration-300 ${currentView === item.id ? 'bg-[#3c4043] text-[#A8C7FA] shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2c]'}`}
                        title={item.label}
                    >
                        <item.icon className="w-6 h-6" strokeWidth={1.5} />
                        {currentView === item.id && <div className="absolute left-0 w-1 h-8 bg-[#A8C7FA] rounded-r-full" />}
                    </button>
                ))}
            </div>

            <div className="flex-1" />

            {/* Simulation Mode Toggle */}
            <button
                onClick={() => setConfig(prev => ({ ...prev, mockMode: !prev.mockMode }))}
                className={`group relative flex items-center justify-center w-full aspect-square rounded-2xl transition-all duration-300 mb-4 ${config.mockMode
                    ? 'bg-yellow-500/20 text-yellow-400 shadow-inner'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2c]'
                    }`}
                title={config.mockMode ? '模拟模式已开启 (点击关闭)' : '模拟模式 (点击开启)'}
            >
                <span className="text-2xl">{config.mockMode ? '🎭' : '⚙️'}</span>
                {config.mockMode && <div className="absolute left-0 w-1 h-8 bg-yellow-400 rounded-r-full" />}
            </button>

            {/* User Profile */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 opacity-50 flex items-center justify-center text-[10px] font-bold text-white cursor-default">
                A9
            </div>
        </aside>
    );
};

export default Sidebar;
