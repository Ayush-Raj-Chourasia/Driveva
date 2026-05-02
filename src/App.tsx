/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TopNav from './components/TopNav';
import BottomNav from './components/BottomNav';
import DriveView from './views/DriveView';
import SettingsView from './views/SettingsView';
import RecentView from './views/RecentView';
import SharedView from './views/SharedView';
import LoginView from './views/LoginView';
import { db } from './lib/db';
import TransferOverlay from './components/TransferOverlay';

export default function App() {
  const [activeTab, setActiveTab] = useState('drive');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const sessionState = await db.syncState.get('telegram_session');
    setIsAuthenticated(!!sessionState?.value);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full"
          />
          <p className="text-sm font-bold text-on-surface-variant">Loading TeleDrive...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <LoginView onLogin={checkAuth} />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'drive':
        return <DriveView key="drive" searchQuery={searchQuery || undefined} />;
      case 'shared':
        return <SharedView key="shared" />;
      case 'recent':
        return <RecentView key="recent" />;
      case 'settings':
        return <SettingsView key="settings" onLogout={handleLogout} />;
      default:
        return <DriveView key="drive" />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      <TopNav onSearch={setSearchQuery} />

      <main className="pt-20 px-4 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setSearchQuery(''); }} />
      <TransferOverlay />
    </div>
  );
}
