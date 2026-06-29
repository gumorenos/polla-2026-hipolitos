'use client';

import React, { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface PublicDashboardTabsProps {
  tabs: Tab[];
  children: React.ReactNode[];
}

export const PublicDashboardTabs: React.FC<PublicDashboardTabsProps> = ({ tabs, children }) => {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id);

  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);

  return (
    <div className="space-y-6">
      {/* Tabs list */}
      <div className="flex border-b border-border-subtle overflow-x-auto scrollbar-thin" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-mono border-b-2 font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'border-gold-400 text-gold-400 bg-gold-400/5'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover/30'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="transition-all duration-200" role="tabpanel">
        {children[activeIndex] || null}
      </div>
    </div>
  );
};
