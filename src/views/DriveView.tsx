import React, { useState, useCallback } from 'react';
import { Folder, FileText, Image as ImageIcon, FileCode, Film, Music, Archive,
  MoreVertical, Plus, Download, Trash2, Edit3, ChevronLeft, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Virtuoso } from 'react-virtuoso';
import { pushSyncState } from '../lib/telegram/sync';

interface DriveViewProps {
  searchQuery?: string;
  key?: string;
}

export default function DriveView({ searchQuery }: DriveViewProps) {
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Drive' }
  ]);
  const [contextMenu, setContextMenu] = useState<{ type: 'file' | 'folder'; id: string; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Query folders in current directory
  const folders = useLiveQuery(
    () => {
      if (searchQuery) {
        return db.folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).toArray();
      }
      return db.folders.filter(f => f.parentId === currentFolder).toArray();
    },
    [currentFolder, searchQuery]
  ) || [];

  // Query files in current directory
  const files = useLiveQuery(
    () => {
      if (searchQuery) {
        return db.files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).toArray();
      }
      return db.files.filter(f => f.folderId === currentFolder).toArray();
    },
    [currentFolder, searchQuery]
  ) || [];

  // Total storage used
  const totalUsed = useLiveQuery(
    () => db.files.toArray().then(allFiles => allFiles.reduce((sum, f) => sum + f.size, 0)),
    []
  ) || 0;

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={24} />;
    if (mimeType.startsWith('video/')) return <Film size={24} />;
    if (mimeType.startsWith('audio/')) return <Music size={24} />;
    if (mimeType.includes('pdf')) return <FileText size={24} />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return <Archive size={24} />;
    return <FileCode size={24} />;
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

  const navigateToFolder = (folderId: string, folderName: string) => {
    setCurrentFolder(folderId);
    setFolderPath(prev => [...prev, { id: folderId, name: folderName }]);
    setContextMenu(null);
  };

  const navigateBack = () => {
    if (folderPath.length <= 1) return;
    const newPath = folderPath.slice(0, -1);
    setFolderPath(newPath);
    setCurrentFolder(newPath[newPath.length - 1].id);
    setContextMenu(null);
  };

  const navigateToBreadcrumb = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolder(newPath[newPath.length - 1].id);
    setContextMenu(null);
  };

  const handleCreateFolder = async () => {
    const name = prompt('Folder Name:');
    if (!name || !name.trim()) return;

    await db.folders.add({
      id: crypto.randomUUID(),
      name: name.trim(),
      parentId: currentFolder,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    try {
      await pushSyncState();
    } catch (e) {
      console.warn('Failed to sync after folder creation:', e);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Delete this file? It will remain in Telegram but be removed from TeleDrive.')) return;
    await db.files.delete(fileId);
    setContextMenu(null);
    try { await pushSyncState(); } catch (e) { console.warn(e); }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const childFiles = await db.files.filter(f => f.folderId === folderId).count();
    const childFolders = await db.folders.filter(f => f.parentId === folderId).count();
    if (childFiles > 0 || childFolders > 0) {
      alert('Folder is not empty. Delete contents first.');
      return;
    }
    if (!confirm('Delete this folder?')) return;
    await db.folders.delete(folderId);
    setContextMenu(null);
    try { await pushSyncState(); } catch (e) { console.warn(e); }
  };

  const handleRename = async (type: 'file' | 'folder', id: string) => {
    if (!renameValue.trim()) { setRenaming(null); return; }
    if (type === 'file') {
      await db.files.update(id, { name: renameValue.trim(), updatedAt: Date.now() });
    } else {
      await db.folders.update(id, { name: renameValue.trim(), updatedAt: Date.now() });
    }
    setRenaming(null);
    setRenameValue('');
    setContextMenu(null);
    try { await pushSyncState(); } catch (e) { console.warn(e); }
  };

  const handleDownload = async (fileId: string) => {
    setContextMenu(null);
    const { transferManager } = await import('../lib/transferManager');
    transferManager.queueDownload(fileId);
  };

  const allItems = [
    ...folders.map(f => ({ ...f, _type: 'folder' as const })),
    ...files.map(f => ({ ...f, _type: 'file' as const }))
  ];

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto h-full">
      {/* Storage Overview */}
      <section className="glass-panel rounded-3xl p-5 flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-on-surface">Storage</h2>
            <p className="text-xs text-on-surface-variant opacity-70">
              {formatSize(totalUsed)} used • Telegram unlimited
            </p>
          </div>
          <Upload className="text-primary opacity-40" size={20} />
        </div>
        <div className="w-full h-2.5 bg-surface-container-highest rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: totalUsed > 0 ? `${Math.min((totalUsed / (2 * 1024 * 1024 * 1024)) * 100, 95)}%` : '2%' }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-primary to-tertiary rounded-full"
          />
        </div>
      </section>

      {/* Breadcrumb Navigation */}
      {folderPath.length > 1 && (
        <div className="flex items-center gap-1 text-xs shrink-0 overflow-x-auto">
          <button onClick={navigateBack} className="p-1.5 rounded-lg hover:bg-primary-container/30 text-primary shrink-0">
            <ChevronLeft size={16} />
          </button>
          {folderPath.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-outline opacity-40 shrink-0">/</span>}
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={cn(
                  "px-2 py-1 rounded-lg shrink-0 font-bold transition-colors",
                  i === folderPath.length - 1 ? "text-primary bg-primary-container/20" : "text-outline hover:text-primary"
                )}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Folders */}
      {!searchQuery && (
        <section className="shrink-0">
          <h2 className="text-sm font-bold text-on-surface mb-3 uppercase tracking-wider opacity-60">Folders</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {folders.map((folder, i) => (
              <motion.div
                key={folder.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigateToFolder(folder.id, folder.name)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ type: 'folder', id: folder.id, x: e.clientX, y: e.clientY });
                }}
                className="glass-panel p-3 rounded-2xl flex items-center gap-3 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-container/40 text-primary shrink-0">
                  <Folder size={20} fill="currentColor" className="opacity-80" />
                </div>
                {renaming === folder.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename('folder', folder.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename('folder', folder.id)}
                    className="text-xs font-bold bg-transparent border-b border-primary outline-none flex-1 min-w-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className="text-xs font-bold truncate">{folder.name}</p>
                )}
              </motion.div>
            ))}
            <div
              onClick={handleCreateFolder}
              className="glass-panel p-3 rounded-2xl flex items-center justify-center gap-2 border-dashed border-2 border-outline-variant/30 bg-transparent hover:bg-white/30 transition-colors cursor-pointer group"
            >
              <Plus className="text-outline group-hover:text-primary" size={18} />
              <span className="text-xs font-bold text-outline">New Folder</span>
            </div>
          </div>
        </section>
      )}

      {/* Files */}
      <section className="flex-1 flex flex-col min-h-[200px]">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider opacity-60">Files</h2>
          <span className="px-2.5 py-0.5 bg-surface-container-high rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            {files.length} items
          </span>
        </div>

        <div className="flex-1 min-h-[200px]">
          {files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-outline text-sm gap-2 py-12">
              <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center text-2xl mb-2">📁</div>
              <p className="font-bold">No files here</p>
              <p className="text-xs opacity-60">Tap + to upload something</p>
            </div>
          ) : (
            <Virtuoso
              data={files}
              style={{ height: '100%', minHeight: 200 }}
              itemContent={(i, file) => (
                <div className="py-1">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="glass-panel p-3 rounded-2xl flex items-center gap-3 hover:bg-white/50 transition-colors cursor-pointer group"
                    onClick={() => handleDownload(file.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ type: 'file', id: file.id, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", getFileColors(file.mimeType))}>
                      {getFileIcon(file.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {renaming === file.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRename('file', file.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename('file', file.id)}
                          className="text-xs font-bold bg-transparent border-b border-primary outline-none w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="text-xs font-bold text-on-surface truncate">{file.name}</p>
                      )}
                      <p className="text-[10px] text-on-surface-variant opacity-60 truncate">
                        {new Date(file.updatedAt || file.createdAt).toLocaleDateString()} • {formatSize(file.size)}
                        {file.isChunked && ` • ${file.totalChunks} parts`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({ type: 'file', id: file.id, x: e.clientX, y: e.clientY });
                      }}
                      className="p-1.5 text-outline hover:text-primary opacity-40 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </motion.div>
                </div>
              )}
            />
          )}
        </div>
      </section>

      {/* File Upload FAB */}
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
            e.target.value = ''; // Reset so same file can be picked again
          }
        }}
      />
      <motion.label
        htmlFor="file-upload"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-24 right-5 w-14 h-14 bg-gradient-to-br from-primary to-tertiary text-white rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center z-40 cursor-pointer"
      >
        <Plus size={28} strokeWidth={3} />
      </motion.label>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60]"
              onClick={() => setContextMenu(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-[61] bg-white rounded-2xl shadow-2xl border border-white/40 overflow-hidden min-w-[180px]"
              style={{
                top: Math.min(contextMenu.y, window.innerHeight - 200),
                left: Math.min(contextMenu.x, window.innerWidth - 200)
              }}
            >
              {contextMenu.type === 'file' && (
                <button
                  onClick={() => handleDownload(contextMenu.id)}
                  className="w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 hover:bg-primary-container/20 transition-colors"
                >
                  <Download size={16} className="text-primary" />
                  Download
                </button>
              )}
              <button
                onClick={() => {
                  const item = contextMenu.type === 'file'
                    ? files.find(f => f.id === contextMenu.id)
                    : folders.find(f => f.id === contextMenu.id);
                  if (item) {
                    setRenaming(contextMenu.id);
                    setRenameValue(item.name);
                  }
                  setContextMenu(null);
                }}
                className="w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 hover:bg-primary-container/20 transition-colors"
              >
                <Edit3 size={16} className="text-secondary" />
                Rename
              </button>
              <button
                onClick={() => contextMenu.type === 'file' ? handleDeleteFile(contextMenu.id) : handleDeleteFolder(contextMenu.id)}
                className="w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 hover:bg-error-container/20 transition-colors text-error"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
