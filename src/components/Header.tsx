import React from 'react';

interface HeaderProps {
  currentTab: 'today' | 'history';
  onSelectTab: (tab: 'today' | 'history') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab }) => {
  return (
    <header className="border-b border-[#F1F3F4] bg-[#FFFFFF]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <button
          onClick={() => onSelectTab('today')}
          className="text-base font-semibold tracking-tight text-[#202124] hover:opacity-80 transition-opacity cursor-pointer"
        >
          Daily Flow
        </button>

        {/* 2 Navigation entries: 今日计划, 历史记录 */}
        <nav className="flex items-center gap-6 text-sm">
          <button
            onClick={() => onSelectTab('today')}
            data-testid="nav-today"
            className={`py-4 border-b-2 font-medium transition-colors cursor-pointer ${
              currentTab === 'today'
                ? 'border-[#1A73E8] text-[#1A73E8]'
                : 'border-transparent text-[#5F6368] hover:text-[#202124]'
            }`}
          >
            今日计划
          </button>

          <button
            onClick={() => onSelectTab('history')}
            data-testid="nav-history"
            className={`py-4 border-b-2 font-medium transition-colors cursor-pointer ${
              currentTab === 'history'
                ? 'border-[#1A73E8] text-[#1A73E8]'
                : 'border-transparent text-[#5F6368] hover:text-[#202124]'
            }`}
          >
            历史记录
          </button>
        </nav>
      </div>
    </header>
  );
};
