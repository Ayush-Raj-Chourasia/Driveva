import React, { useState } from 'react';
import { Folder, FileText, Image as ImageIcon, FileCode, MoreVertical, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Virtuoso } from 'react-virtuoso';

export default function DriveView() {
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  const folders = useLiveQuery(
    () => db.folders.where('parentId').equals(currentFolder || 'null').toArray(),
    [currentFolder]
  ) || [];

  const files = useLiveQuery(
    () => db.files.where('folderId').equals(currentFolder || 'null').reverse().sortBy('createdAt'),
    [currentFolder]
  ) || [];

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={24} />;
    if (mimeType.includes('pdf')) return <FileText size={24} />;
    return <FileCode size={24} />;
  };

  const getFileColors = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'bg-primary-container text-primary';
    if (mimeType.includes('pdf')) return 'bg-error-container text-error';
    return 'bg-secondary-container text-secondary';
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleCreateFolder = async () => {
    const name = prompt('Folder Name:');
    if (name) {
      await db.folders.add({
        id: crypto.randomUUID(),
        name,
        parentId: currentFolder,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      // pushSyncState should be called here in a full app
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto h-full">
      {/* Storage Overview */}
      <section className="glass-panel rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Storage</h2>
          <p className="text-sm text-on-surface-variant opacity-70">Calculating...</p>
        </div>
        <div className="w-full sm:w-1/2 h-3 bg-surface-container-highest rounded-full overflow-hidden p-[1px]">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '45%' }}
            className="h-full bg-gradient-to-r from-tertiary-container to-primary-container rounded-full"
          />
        </div>
      </section>


      {currentFolder && (
        <button onClick={() => setCurrentFolder(null)} className="text-primary font-bold text-sm self-start shrink-0 hover:underline">
          ← Back to Root
        </button>
      )}

      {/* Folders */}
      <section className="shrink-0">
        <h2 className="text-lg font-bold text-on-surface mb-4">Folders</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {folders.map((folder, i) => (
            <motion.div
              key={folder.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentFolder(folder.id)}
              className="glass-panel p-4 rounded-3xl flex flex-col gap-2 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center bg-primary-container/40 text-primary")}>
                <Folder size={24} fill="currentColor" className="opacity-80" />
              </div>
              <div className="mt-2 text-center sm:text-left">
                <p className="text-sm font-bold truncate">{folder.name}</p>
              </div>
            </motion.div>
          ))}
          <div 
            onClick={handleCreateFolder}
            className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center gap-2 border-dashed border-2 border-outline-variant/30 bg-transparent hover:bg-white/30 transition-colors cursor-pointer group"
          >
            <Plus className="text-outline group-hover:text-primary" size={24} />
            <span className="text-sm font-bold text-outline">New Folder</span>
          </div>
        </div>
      </section>

      {/* Recent Files */}
      <section className="flex-1 flex flex-col min-h-[300px]">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-lg font-bold text-on-surface">Files</h2>
          <span className="px-3 py-1 bg-surface-container-high rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            {files.length} items
          </span>
        </div>
        
        <div className="flex-1 h-full min-h-[300px] -mx-4 px-4">
          {files.length === 0 ? (
            <div className="h-full flex items-center justify-center text-outline text-sm">
              No files here. Upload something!
            </div>
          ) : (
            <Virtuoso
              data={files}
              style={{ height: '100%' }}
              itemContent={(i, file) => (
                <div className="py-1.5">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass-panel p-3 rounded-2xl flex items-center gap-4 hover:bg-white/40 transition-colors cursor-pointer group"
                  >
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", getFileColors(file.mimeType))}>
                      {getFileIcon(file.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">{file.name}</p>
                      <p className="text-[11px] text-on-surface-variant opacity-60 truncate">
                        {new Date(file.createdAt).toLocaleDateString()} • {formatSize(file.size)}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        import('../lib/transferManager').then(m => m.transferManager.queueDownload(file.id));
                      }}
                      className="p-2 text-outline hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical size={20} />
                    </button>
                  </motion.div>
                </div>
              )}
            />
          )}
        </div>
      </section>

      {/* FAB */}
      <input 
        type="file" 
        id="file-upload" 
        className="hidden" 
        multiple
        onChange={async (e) => {
          if (e.target.files) {
            const { transferManager } = await import('../lib/transferManager');
            for (let i = 0; i < e.target.files.length; i++) {
              await transferManager.queueUpload(e.target.files[i], currentFolder);
            }
          }
        }}
      />
      <motion.label 
        htmlFor="file-upload"
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-28 right-6 w-14 h-14 bg-gradient-to-br from-primary to-secondary text-white rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center z-40 md:static md:mt-4 md:mx-auto md:w-full md:rounded-3xl cursor-pointer"
      >
        <Plus size={32} strokeWidth={3} />
      </motion.label>
    </div>
  );
}
