import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TopNavProps {
  onSearch?: (query: string) => void;
}

export default function TopNav({ onSearch }: TopNavProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch?.(value);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery('');
    onSearch?.('');
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-4 h-14 bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-sm">
      <AnimatePresence mode="wait">
        {isSearchOpen ? (
          <motion.div
            key="search"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex items-center gap-2 w-full"
          >
            <Search className="text-outline shrink-0" size={18} />
            <input
              autoFocus
              type="text"
              placeholder="Search files & folders..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm text-on-surface placeholder:text-outline"
            />
            <button
              onClick={closeSearch}
              className="p-1.5 hover:bg-black/5 rounded-full transition-colors shrink-0"
            >
              <X size={18} className="text-outline" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white text-xs font-black">
                TD
              </div>
              <span className="text-lg font-extrabold text-on-surface tracking-tight">TeleDrive</span>
            </div>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-primary hover:bg-primary-container/20 rounded-full transition-colors"
            >
              <Search size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
