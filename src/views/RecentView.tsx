import React from 'react';
import { FileText, Image as ImageIcon, FileCode, Film, Music, Archive, Download, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';

export default function RecentView() {
  // Show files sorted by most recently updated/opened
  const recentFiles = useLiveQuery(
    () => db.files.orderBy('updatedAt').reverse().limit(50).toArray(),
    []
  ) || [];

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={22} />;
    if (mimeType.startsWith('video/')) return <Film size={22} />;
    if (mimeType.startsWith('audio/')) return <Music size={22} />;
    if (mimeType.includes('pdf')) return <FileText size={22} />;
    if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive size={22} />;
    return <FileCode size={22} />;
  };

  const getFileColors = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'bg-primary-container text-primary';
    if (mimeType.startsWith('video/')) return 'bg-tertiary-container text-tertiary';
    if (mimeType.startsWith('audio/')) return 'bg-secondary-container text-secondary';
    if (mimeType.includes('pdf')) return 'bg-error-container text-error';
    return 'bg-surface-container-high text-on-surface';
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const handleDownload = async (fileId: string) => {
    const { transferManager } = await import('../lib/transferManager');
    transferManager.queueDownload(fileId);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-secondary-container/40 text-secondary flex items-center justify-center">
          <Clock size={22} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-on-surface">Recent Files</h2>
          <p className="text-xs text-on-surface-variant opacity-60">{recentFiles.length} files</p>
        </div>
      </div>

      {recentFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center text-3xl mb-4">🕒</div>
          <h3 className="text-lg font-bold text-on-surface mb-1">No recent files</h3>
          <p className="text-sm text-on-surface-variant opacity-60">Files you upload or access will appear here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recentFiles.map((file, i) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => handleDownload(file.id)}
              className="glass-panel p-3 rounded-2xl flex items-center gap-3 hover:bg-white/50 transition-colors cursor-pointer group"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", getFileColors(file.mimeType))}>
                {getFileIcon(file.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-on-surface truncate">{file.name}</p>
                <p className="text-[10px] text-on-surface-variant opacity-60">
                  {getTimeAgo(file.updatedAt || file.createdAt)} • {formatSize(file.size)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(file.id); }}
                className="p-1.5 text-outline hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <Download size={16} />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
