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
import UploadView from './views/UploadView';
import PreviewView from './views/PreviewView';
import LoginView from './views/LoginView';
import { db } from './lib/db';

export default function App() {
  const [activeTab, setActiveTab] = useState('drive');
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const sessionState = await db.syncState.get('telegram_session');
    setIsAuthenticated(!!sessionState?.value);
  };

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <LoginView onLogin={checkAuth} />
      </div>
    );
  }

  // Simple state-based routing
  const renderContent = () => {
    switch (activeTab) {
      case 'drive':
        return <DriveView key="drive" />;
      case 'settings':
        return <SettingsView key="settings" />;
      case 'shared':
      case 'recent':
        return (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-40">
            <div className="w-24 h-24 rounded-full bg-surface-container-highest flex items-center justify-center mb-4">
              {activeTab === 'shared' ? '👥' : '🕒'}
            </div>
            <h2 className="text-xl font-bold">Soon!</h2>
            <p className="text-sm">This section is under construction.</p>
          </div>
        );
      default:
        return <DriveView key="drive" />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav />
      
      <main className="pt-24 px-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Action shortcuts for demo */}
      <div className="fixed bottom-24 right-6 flex flex-col gap-3 md:hidden">
        <button 
          onClick={() => setIsUploading(true)}
          className="w-12 h-12 rounded-full bg-white shadow-lg border border-primary-container/30 flex items-center justify-center text-primary"
        >
          ☁️
        </button>
        <button 
          onClick={() => setIsPreviewOpen(true)}
          className="w-12 h-12 rounded-full bg-white shadow-lg border border-primary-container/30 flex items-center justify-center text-primary"
        >
          👁️
        </button>
      </div>

      <AnimatePresence>
        {isUploading && (
          <UploadView onCancel={() => setIsUploading(false)} />
        )}
        {isPreviewOpen && (
          <PreviewView onClose={() => setIsPreviewOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
