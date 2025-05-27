import React from 'react';
import { Button } from '@/components/ui/button';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'swap', label: 'Swap Assistant', icon: '🔄' },
    { id: 'crosschain', label: 'Cross Chain Swap Assistant', icon: '🌉' },
  ];

  return (
    <div className="bg-slate-800/50 p-4 rounded-xl border border-purple-800/30">
      <h3 className="text-lg font-semibold text-white mb-4">Navigation</h3>
      <div className="space-y-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            variant={activeTab === tab.id ? "default" : "ghost"}
            className={`w-full justify-start ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'text-gray-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
