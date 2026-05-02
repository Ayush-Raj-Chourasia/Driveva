import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, ArrowDown, X, AlertCircle, RotateCcw } from 'lucide-react';

export default function TransferOverlay() {
  const uploads = useLiveQuery(
    () => db.uploadQueue.where('status').anyOf(['uploading', 'pending', 'failed']).toArray()
  ) || [];

  const downloads = useLiveQuery(
    () => db.downloadQueue.where('status').anyOf(['downloading', 'pending', 'failed']).toArray()
  ) || [];

  const activeTransfers = [
    ...uploads.map(u => ({ ...u, type: 'upload' as const })),
    ...downloads.map(d => ({ ...d, type: 'download' as const }))
  ];

  if (activeTransfers.length === 0) return null;

  const handleRetry = async (item: any) => {
    if (item.type === 'upload') {
      const { transferManager } = await import('../lib/transferManager');
      transferManager.retryUpload(item.id);
    }
  };

  const handleDismiss = (item: any) => {
    if (item.type === 'upload') {
      db.uploadQueue.delete(item.id);
    } else {
      db.downloadQueue.delete(item.id);
    }
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-sm z-50 pointer-events-none">
      <AnimatePresence>
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          {activeTransfers.slice(0, 3).map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white/90 backdrop-blur-xl p-2.5 rounded-xl flex items-center gap-2.5 shadow-xl border border-white/30"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                item.status === 'failed'
                  ? 'bg-error-container text-error'
                  : item.type === 'upload'
                    ? 'bg-primary-container text-primary'
                    : 'bg-tertiary-container text-tertiary'
              }`}>
                {item.status === 'failed'
                  ? <AlertCircle size={14} />
                  : item.type === 'upload'
                    ? <ArrowUp size={14} />
                    : <ArrowDown size={14} />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-1 mb-0.5">
                  <p className="text-[10px] font-bold truncate">{item.name}</p>
                  <span className="text-[9px] opacity-50 font-mono shrink-0">
                    {item.status === 'failed' ? 'Failed' : `${Math.round(item.progress * 100)}%`}
                  </span>
                </div>
                {item.status !== 'failed' && (
                  <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress * 100}%` }}
                      className={`h-full ${item.type === 'upload' ? 'bg-primary' : 'bg-tertiary'}`}
                    />
                  </div>
                )}
                {item.status === 'failed' && item.error && (
                  <p className="text-[9px] text-error truncate">{item.error}</p>
                )}
              </div>

              {item.status === 'failed' && (
                <button
                  onClick={() => handleRetry(item)}
                  className="p-1 hover:bg-primary-container/30 rounded-full text-primary transition-colors shrink-0"
                  title="Retry"
                >
                  <RotateCcw size={12} />
                </button>
              )}

              <button
                onClick={() => handleDismiss(item)}
                className="p-1 hover:bg-black/5 rounded-full text-outline transition-colors shrink-0"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
          {activeTransfers.length > 3 && (
            <div className="text-center text-[10px] font-bold text-on-surface-variant opacity-50">
              +{activeTransfers.length - 3} more transfers
            </div>
          )}
        </div>
      </AnimatePresence>
    </div>
  );
}
