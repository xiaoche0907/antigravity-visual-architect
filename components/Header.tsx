
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="amazon-bg text-white py-4 px-6 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="bg-white p-1 rounded">
            <svg className="w-8 h-8 amazon-orange fill-current" viewBox="0 0 24 24">
              <path d="M15.93 17.13c-1.38.86-2.92 1.35-4.52 1.35-2.07 0-3.95-.82-5.32-2.14l-.94.94C6.46 18.66 8.57 19.78 11 19.78c1.9 0 3.65-.67 5.03-1.78l-.1-.87zm1.18-1.55c-.2-.17-.4-.36-.59-.55l-.75.64c.24.22.48.42.73.6l.61-.69zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">亚马逊 A9 <span className="amazon-orange">视觉营销专家</span></h1>
            <p className="text-xs text-gray-400">转化驱动型营销工作流</p>
          </div>
        </div>
        <nav className="hidden md:flex space-x-6 text-sm font-medium">
          <a href="#" className="hover:text-orange-400 transition-colors">营销策略</a>
          <a href="#" className="hover:text-orange-400 transition-colors">副图资产</a>
          <a href="#" className="hover:text-orange-400 transition-colors">A+ 设计器</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
