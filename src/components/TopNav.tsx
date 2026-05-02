import React from 'react';
import { Search } from 'lucide-react';

interface TopNavProps {
  onSearch?: (query: string) => void;
}

export default function TopNav({ onSearch }: TopNavProps) {
  return (
    <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 h-16 bg-white/70 backdrop-blur-lg border-b border-white/10 shadow-xl shadow-primary-container/10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm">
          <img 
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150" 
            alt="User Profile" 
            className="w-full h-full object-cover"
          />
        </div>
        <span className="text-xl font-extrabold text-on-surface tracking-tight">TeleDrive</span>
      </div>

      <div className="flex-1 max-w-md mx-6 hidden md:flex items-center bg-surface-container rounded-full px-4 py-2 border border-white/40">
        <Search className="text-outline mr-2" size={18} />
        <input 
          type="text" 
          placeholder="Search in Drive"
          className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-outline"
        />
      </div>

      <button className="p-2 text-primary hover:bg-primary-container/20 rounded-full transition-colors">
        <Search size={22} className="md:hidden" />
      </button>
    </header>
  );
}
