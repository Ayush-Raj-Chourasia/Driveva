import React from 'react';
import { Cloud, Users, History, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'drive', label: 'Drive', icon: Cloud },
    { id: 'shared', label: 'Shared', icon: Users },
    { id: 'recent', label: 'Recent', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20 px-4 pb-2 bg-white/70 backdrop-blur-xl border-t border-white/20 shadow-[0_-10px_40px_rgba(165,201,255,0.15)] rounded-t-[32px] md:hidden">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center transition-all duration-300 relative px-5 py-1 rounded-full",
              isActive ? "bg-primary-container/30 text-primary" : "text-outline"
            )}
          >
            <motion.div
              whileTap={{ scale: 0.9 }}
              animate={isActive ? { scale: 1.1 } : { scale: 1 }}
            >
              <Icon 
                size={24} 
                strokeWidth={isActive ? 2.5 : 2}
                fill={isActive ? "currentColor" : "none"}
                className={isActive ? "opacity-90" : "opacity-60"}
              />
            </motion.div>
            <span className={cn(
              "text-[11px] font-bold mt-1 transition-colors",
              isActive ? "text-primary" : "text-outline/70"
            )}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
