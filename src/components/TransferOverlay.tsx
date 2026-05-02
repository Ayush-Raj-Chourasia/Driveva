import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, ArrowDown, X, Check, AlertCircle } from 'lucide-react';

export default function TransferOverlay() {
  const uploads = useLiveQuery(() => db.uploadQueue.where('status').anyOf(['uploading', 'pending', 'failed']).toArray()) || [];
  const downloads = useLiveQuery(() => db.downloadQueue.where('status').anyOf(['downloading', 'pending', 'failed']).toArray()) || [];

  const activeTransfers = [...uploads.map(u => ({ ...u, type: 'upload' })), ...downloads.map(d => ({ ...d, type: 'download' }))];

  if (activeTransfers.length === 0) return null;

  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-50 pointer-events-none">
      <AnimatePresence>
        <div className="flex flex-col gap-2 pointer-events-auto">
          {activeTransfers.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-panel p-3 rounded-2xl flex items-center gap-3 shadow-xl border border-white/20 bg-white/80 backdrop-blur-xl"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                item.type === 'upload' ? 'bg-primary-container text-primary' : 'bg-tertiary-container text-tertiary'
              }`}>
                {item.type === 'upload' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-2 mb-1">
                  <p className="text-[11px] font-bold truncate">{item.name}</p>
                  <span className="text-[10px] opacity-60 font-mono">
                    {Math.round(item.progress * 100)}%
                  </span>
                </div>
                <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.progress * 100}%` }}
                    className={`h-full ${item.status === 'failed' ? 'bg-error' : (item.type === 'upload' ? 'bg-primary' : 'bg-tertiary')}`}
                  />
                </div>
              </div>

              {item.status === 'failed' && (
                <AlertCircle className="text-error shrink-0" size={16} title={item.error} />
              )}
              
              <button 
                onClick={() => {
                   if (item.type === 'upload') db.uploadQueue.delete(item.id);
                   else db.downloadQueue.delete(item.id);
                }}
                className="p-1 hover:bg-black/5 rounded-full text-outline transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
