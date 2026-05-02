import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Play, 
  Download, 
  Share2, 
  Trash2, 
  Maximize2 
} from 'lucide-react';

interface PreviewProps {
  onClose: () => void;
}

export default function PreviewView({ onClose }: PreviewProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black flex flex-col justify-between"
    >
      {/* Background Media */}
      <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center">
        <img 
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200" 
          alt="Preview"
          className="w-full h-full object-cover opacity-60 scale-110 blur-sm"
        />
        <motion.img 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800" 
          className="relative z-10 w-[90%] max-w-lg aspect-video object-cover rounded-3xl shadow-2xl shadow-black/50"
        />
      </div>

      {/* Top Bar */}
      <header className="relative z-20 w-full p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pt-12 pb-24">
        <button 
          onClick={onClose}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 transition-all"
        >
          <X size={24} />
        </button>
        
        <div className="text-center text-white drop-shadow-lg">
          <h1 className="text-lg font-bold tracking-tight">Creative_Direction_Reel_2024.mp4</h1>
          <p className="text-xs opacity-70 mt-1">42.8 MB • Uploaded 2 hrs ago</p>
        </div>

        <div className="w-12" />
      </header>

      {/* Bottom Controls */}
      <footer className="relative z-20 w-full pb-12 px-6 flex justify-center bg-gradient-to-t from-black/80 to-transparent pt-24">
        <div className="flex items-center gap-4 p-4 rounded-[2.5rem] bg-white/80 backdrop-blur-2xl border border-white/30 shadow-2xl min-w-[300px] justify-center">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-primary text-white shadow-lg"
          >
            <Play size={32} fill="currentColor" />
          </motion.button>
          
          <div className="w-px h-10 bg-outline/20" />
          
          <div className="flex gap-4 px-2">
            <PreviewAction icon={<Download size={22} />} label="Save" />
            <PreviewAction icon={<Share2 size={22} />} label="Share" />
            <PreviewAction icon={<Trash2 size={22} />} label="Delete" danger />
          </div>
        </div>
      </footer>
    </motion.div>
  );
}

function PreviewAction({ icon, label, danger }: any) {
  return (
    <button className={cn(
      "flex flex-col items-center gap-1 transition-colors",
      danger ? "text-error hover:text-error/70" : "text-on-surface hover:text-primary"
    )}>
      <div className={cn(
        "p-2 rounded-full",
        danger ? "hover:bg-error-container/30" : "hover:bg-primary-container/30"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

import { cn } from '../lib/utils';
