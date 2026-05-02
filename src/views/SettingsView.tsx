import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ChevronRight,
  ShieldCheck,
  User,
  RefreshCcw,
  Moon,
  LogOut,
  Cloud,
  HardDrive,
  Wifi,
  WifiOff
} from 'lucide-react';
import { db, getSetting, setSetting } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { getClient, clearSession } from '../lib/telegram/client';
import { pushSyncState, pullSyncState } from '../lib/telegram/sync';

interface SettingsViewProps {
  onLogout?: () => void;
  key?: string;
}

export default function SettingsView({ onLogout }: SettingsViewProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  // Calculate real storage usage
  const totalUsed = useLiveQuery(
    () => db.files.toArray().then(allFiles => allFiles.reduce((sum, f) => sum + f.size, 0)),
    []
  ) || 0;

  const fileCount = useLiveQuery(() => db.files.count(), []) || 0;
  const folderCount = useLiveQuery(() => db.folders.count(), []) || 0;

  useEffect(() => {
    loadSettings();
    loadProfile();
  }, []);

  const loadSettings = async () => {
    const dm = await getSetting('darkMode', false);
    const as = await getSetting('autoSync', true);
    setDarkMode(dm);
    setAutoSync(as);
  };

  const loadProfile = async () => {
    try {
      const client = await getClient();
      if (client.connected) {
        const me = await client.getMe();
        // @ts-ignore
        setUserName(`${me.firstName || ''} ${me.lastName || ''}`.trim() || 'User');
        // @ts-ignore
        setUserPhone(me.phone ? `+${me.phone}` : '');
      }
    } catch (e) {
      console.warn('Could not load profile:', e);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus('Pushing local data...');
    try {
      await pushSyncState();
      setSyncStatus('Pulling remote data...');
      await pullSyncState();
      setSyncStatus('✓ Synced successfully!');
    } catch (e: any) {
      setSyncStatus(`✗ Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus(''), 4000);
    }
  };

  const handleToggleDarkMode = async () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    await setSetting('darkMode', newVal);
    // Apply to document
    if (newVal) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleToggleAutoSync = async () => {
    const newVal = !autoSync;
    setAutoSync(newVal);
    await setSetting('autoSync', newVal);
  };

  const handleLogout = async () => {
    if (!confirm('Log out of TeleDrive? Your files will remain in Telegram.')) return;
    try {
      await clearSession();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    onLogout?.();
    window.location.reload();
  };

  const storagePercentage = Math.min((totalUsed / (10 * 1024 * 1024 * 1024)) * 100, 95); // Scale to 10GB for visual

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto pb-8">
      {/* Backend Usage Card */}
      <section className="glass-panel rounded-3xl p-5 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-base font-bold text-on-surface">Telegram Backend</h2>
              <p className="text-xs text-on-surface-variant opacity-70">
                {fileCount} files • {folderCount} folders
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-tertiary-container/20 text-tertiary flex items-center justify-center">
              <Cloud size={22} />
            </div>
          </div>

          <div className="w-full h-4 bg-surface-container-high rounded-full overflow-hidden p-0.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${storagePercentage > 0 ? storagePercentage : 2}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-tertiary to-primary rounded-full"
            />
          </div>

          <div className="flex justify-between mt-2 text-[11px] font-bold text-on-surface-variant opacity-60">
            <span>{formatSize(totalUsed)} Used</span>
            <span>Unlimited</span>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
      </section>

      {/* Sync Status */}
      {syncStatus && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold text-center ${
            syncStatus.includes('✓') ? 'bg-tertiary-container/30 text-tertiary' :
            syncStatus.includes('✗') ? 'bg-error-container text-error' :
            'bg-primary-container/30 text-primary'
          }`}
        >
          {syncStatus}
        </motion.div>
      )}

      {/* Preferences Group */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] px-4">Preferences</h3>
        <section className="glass-panel rounded-[1.5rem] overflow-hidden divide-y divide-surface-container-highest/50">
          <SettingToggle
            icon={<RefreshCcw size={18} className={syncing ? 'animate-spin' : ''} />}
            color="bg-tertiary-container/40 text-tertiary"
            title="Auto Sync"
            subtitle="Keep files updated across devices"
            active={autoSync}
            onToggle={handleToggleAutoSync}
          />
          <SettingToggle
            icon={<Moon size={18} />}
            color="bg-surface-container-high text-on-surface"
            title="Dark Mode"
            subtitle="Follow system settings"
            active={darkMode}
            onToggle={handleToggleDarkMode}
          />
        </section>
      </div>

      {/* Actions Group */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] px-4">Actions</h3>
        <section className="glass-panel rounded-[1.5rem] overflow-hidden divide-y divide-surface-container-highest/50">
          <SettingButton
            icon={<RefreshCcw size={18} className={syncing ? 'animate-spin' : ''} />}
            color="bg-primary-container/40 text-primary"
            title="Sync Now"
            subtitle={syncing ? 'Syncing...' : 'Push & pull latest data'}
            onClick={handleSync}
          />
        </section>
      </div>

      {/* Account Group */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] px-4">Account</h3>
        <section className="glass-panel rounded-[1.5rem] overflow-hidden divide-y divide-surface-container-highest/50">
          <div className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-full bg-primary-container/40 text-primary flex items-center justify-center">
              <User size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-on-surface">{userName || 'Loading...'}</p>
              <p className="text-[10px] text-on-surface-variant opacity-60">{userPhone}</p>
            </div>
          </div>

          <SettingButton
            icon={<HardDrive size={18} />}
            color="bg-secondary-container/40 text-secondary"
            title="Storage Details"
            subtitle={`${fileCount} files, ${folderCount} folders, ${formatSize(totalUsed)}`}
            onClick={() => {}}
          />

          <SettingButton
            icon={<LogOut size={18} />}
            color="bg-error-container/40 text-error"
            title="Log Out"
            subtitle="Sign out from TeleDrive"
            onClick={handleLogout}
            danger
          />
        </section>
      </div>
    </div>
  );
}

function SettingToggle({ icon, color, title, subtitle, active, onToggle }: any) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-white/40 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold text-on-surface">{title}</p>
          <p className="text-[10px] text-on-surface-variant opacity-60 leading-tight">{subtitle}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`w-12 h-7 rounded-full p-0.5 cursor-pointer transition-colors duration-300 relative ${active ? 'bg-primary' : 'bg-surface-container-highest'}`}
      >
        <motion.div
          animate={{ x: active ? 20 : 0 }}
          className="w-6 h-6 rounded-full bg-white shadow-md"
        />
      </button>
    </div>
  );
}

function SettingButton({ icon, color, title, subtitle, onClick, danger }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 hover:bg-white/40 transition-colors text-left ${danger ? 'hover:bg-error-container/10' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <p className={`text-sm font-bold ${danger ? 'text-error' : 'text-on-surface'}`}>{title}</p>
          <p className="text-[10px] text-on-surface-variant opacity-60 leading-tight">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="text-outline opacity-40" size={16} />
    </button>
  );
}
