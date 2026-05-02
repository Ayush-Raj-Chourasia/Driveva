import React from 'react';
import { Cloud, FileText, Image as ImageIcon, FileCode, Film, Music, Archive, Download, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';

export default function SharedView() {
  // Show ALL files across all folders (since everything is in a shared private channel)
  const allFiles = useLiveQuery(
    () => db.files.orderBy('createdAt').reverse().toArray(),
    []
  ) || [];

  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);

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
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = async (fileId: string) => {
    const { transferManager } = await import('../lib/transferManager');
    transferManager.queueDownload(fileId);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto">
      {/* Channel Info Card */}
      <section className="glass-panel rounded-3xl p-5 relative overflow-hidden">
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-tertiary-container/40 text-tertiary flex items-center justify-center shrink-0">
            <Cloud size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-on-surface">Telegram Cloud Storage</h2>
            <p className="text-xs text-on-surface-variant opacity-70 mt-1">
              All your files are stored securely in a private Telegram channel.
              They sync automatically across all your devices.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-tertiary-container/20 rounded-full">
                <Shield size={12} className="text-tertiary" />
                <span className="text-[10px] font-bold text-tertiary uppercase">Encrypted</span>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant opacity-50">
                {allFiles.length} files • {formatSize(totalSize)}
              </span>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary/5 rounded-full blur-3xl -mr-16 -mt-16" />
      </section>

      {/* All Files List */}
      <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider opacity-60">All Files</h2>

      {allFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center text-3xl mb-4">☁️</div>
          <h3 className="text-lg font-bold text-on-surface mb-1">Nothing shared yet</h3>
          <p className="text-sm text-on-surface-variant opacity-60">Upload files from the Drive tab to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {allFiles.map((file, i) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => handleDownload(file.id)}
              className="glass-panel p-3 rounded-2xl flex items-center gap-3 hover:bg-white/50 transition-colors cursor-pointer group"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", getFileColors(file.mimeType))}>
                {getFileIcon(file.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-on-surface truncate">{file.name}</p>
                <p className="text-[10px] text-on-surface-variant opacity-60">
                  {new Date(file.createdAt).toLocaleDateString()} • {formatSize(file.size)}
                  {file.isChunked && ` • ${file.totalChunks} parts`}
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
