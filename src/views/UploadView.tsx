import React from 'react';
import { motion } from 'motion/react';
import { CloudIcon, CheckCircle2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function UploadView({ onCancel }: { onCancel: () => void }) {
  const progress = 65;
  
  return (
    <div className="fixed inset-0 z-[60] bg-background p-6 flex flex-col items-center animate-in slide-in-from-bottom duration-500">
      <header className="flex items-center justify-between w-full mb-12">
        <button 
          onClick={onCancel}
          className="w-12 h-12 flex items-center justify-center rounded-full glass-panel"
        >
          <X size={24} />
        </button>
        <h2 className="text-lg font-bold text-on-surface-variant">Uploading</h2>
        <div className="w-12" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md gap-12">
        {/* Progress Circle */}
        <div className="relative w-56 h-56 flex items-center justify-center glow-primary rounded-full bg-white shadow-inner">
          <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle 
              className="text-surface-container-low" 
              strokeWidth="10" 
              stroke="currentColor" 
              fill="transparent" 
              r="40" cx="50" cy="50" 
            />
            <motion.circle 
              className="text-primary" 
              strokeWidth="10" 
              strokeDasharray="251.2"
              animate={{ strokeDashoffset: 251.2 - (251.2 * progress) / 100 }}
              strokeLinecap="round" 
              stroke="currentColor" 
              fill="transparent" 
              r="40" cx="50" cy="50" 
            />
          </svg>
          <div className="flex flex-col items-center text-center">
            <CloudIcon className="text-primary mb-2 opacity-50" size={32} />
            <span className="text-5xl font-black text-primary tracking-tighter">
              {progress}%
            </span>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-black text-on-surface">Almost there!</h1>
          <p className="text-on-surface-variant opacity-70">Sending your memories to the cloud...</p>
        </div>

        <div className="w-full space-y-4">
          <div className="glass-panel p-4 rounded-3xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container/40 text-secondary flex items-center justify-center">
              <ImageIcon size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold truncate">IMG_8472.JPG</p>
              <p className="text-[11px] text-on-surface-variant opacity-60">2.4 MB • 1 sec left</p>
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-secondary/20 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-3xl flex items-center gap-4 opacity-60">
            <div className="w-12 h-12 rounded-2xl bg-tertiary-container/40 text-tertiary flex items-center justify-center">
              <FileIcon size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold truncate">Project_Brief.pdf</p>
              <p className="text-[11px] text-tertiary font-bold">Uploaded</p>
            </div>
            <CheckCircle2 className="text-tertiary" size={24} />
          </div>
        </div>
      </main>

      <footer className="w-full max-w-md mt-auto pb-12">
        <button 
          onClick={onCancel}
          className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface-variant font-bold hover:bg-error-container hover:text-error transition-colors"
        >
          Cancel Upload
        </button>
      </footer>
    </div>
  );
}

import { Image as ImageIcon, File as FileIcon } from 'lucide-react';
