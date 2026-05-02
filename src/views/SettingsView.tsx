import React from 'react';
import { motion } from 'motion/react';
import { 
  ChevronRight, 
  ShieldCheck, 
  User, 
  CloudRain as CloudUsage, 
  RefreshCcw, 
  Moon, 
  Bell 
} from 'lucide-react';

export default function SettingsView() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto pb-8">
      {/* Backend Usage Card */}
      <section className="glass-panel rounded-3xl p-6 border-none overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Telegram Backend Usage</h2>
              <p className="text-sm text-on-surface-variant opacity-70">Unlimited storage active</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-tertiary-container/20 text-tertiary flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
          </div>
          
          <div className="w-full h-5 bg-surface-container-high rounded-full overflow-hidden p-1">
            <div className="h-full w-[15%] bg-gradient-to-r from-tertiary to-primary rounded-full" />
          </div>
          
          <div className="flex justify-between mt-3 text-[11px] font-bold text-on-surface-variant opacity-60">
            <span>124 GB Used</span>
            <span>Unmetered</span>
          </div>
        </div>
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
      </section>

      {/* Preferences Group */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] px-4">Preferences</h3>
        <section className="glass-panel rounded-[2rem] overflow-hidden divide-y divide-surface-container-highest/50">
          <SettingItem 
            icon={<Bell size={20} />} 
            color="bg-secondary-container/40 text-secondary"
            title="Auto Backup" 
            subtitle="Backup media automatically"
            toggle={true}
            active={true}
          />
          <SettingItem 
            icon={<RefreshCcw size={20} />} 
            color="bg-tertiary-container/40 text-tertiary"
            title="Sync" 
            subtitle="Keep files updated across devices"
            toggle={true}
            active={true}
          />
          <SettingItem 
            icon={<Moon size={20} />} 
            color="bg-surface-container-high text-on-surface"
            title="Dark Mode" 
            subtitle="Follow system settings"
            toggle={true}
            active={false}
          />
        </section>
      </div>

      {/* Account Group */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] px-4">Account</h3>
        <section className="glass-panel rounded-[2rem] overflow-hidden divide-y divide-surface-container-highest/50">
          <SettingLink 
            icon={<User size={20} />} 
            color="bg-primary-container/40 text-primary"
            title="Profile Details" 
          />
          <SettingLink 
            icon={<ShieldCheck size={20} />} 
            color="bg-error-container/40 text-error"
            title="Security & Passcode" 
          />
        </section>
      </div>
    </div>
  );
}

function SettingItem({ icon, color, title, subtitle, toggle, active }: any) {
  return (
    <div className="flex items-center justify-between p-5 hover:bg-white/40 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <p className="font-bold text-on-surface">{title}</p>
          <p className="text-[11px] text-on-surface-variant opacity-60 leading-tight">{subtitle}</p>
        </div>
      </div>
      {toggle && (
        <div className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 relative ${active ? 'bg-primary' : 'bg-surface-container-highest'}`}>
          <motion.div 
            animate={{ x: active ? 24 : 0 }}
            className="w-6 h-6 rounded-full bg-white shadow-md"
          />
        </div>
      )}
    </div>
  );
}

function SettingLink({ icon, color, title }: any) {
  return (
    <div className="flex items-center justify-between p-5 hover:bg-white/40 transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <p className="font-bold text-on-surface">{title}</p>
      </div>
      <ChevronRight className="text-outline group-hover:text-primary transition-colors" size={20} />
    </div>
  );
}
