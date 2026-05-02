import React, { useState, useCallback, useMemo } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, FileCode, Film, Music, Archive,
  MoreVertical, Plus, Download, Trash2, Edit3, ChevronLeft, Upload, 
  Info, CheckCircle2, X, AlertTriangle, Layers, Calendar, HardDrive, Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DriveFile, type DriveFolder } from '../lib/db';
import { Virtuoso } from 'react-virtuoso';
import { pushSyncState } from '../lib/telegram/sync';
import { transferManager } from '../lib/transferManager';

interface DriveViewProps {
  searchQuery?: string;
  key?: string;
}

export default function DriveView({ searchQuery }: DriveViewProps) {
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Drive' }
  ]);
  const [contextMenu, setContextMenu] = useState<{ type: 'file' | 'folder'; item: any; x: number; y: number } | null>(null);
  const [modal, setModal] = useState<{ type: 'delete' | 'metadata' | 'rename' | 'createFolder'; item?: any } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Queries
  const folders = useLiveQuery(
    () => {
      if (searchQuery) return db.folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).toArray();
      return db.folders.filter(f => f.parentId === currentFolder).toArray();
    },
    [currentFolder, searchQuery]
  ) || [];

  const files = useLiveQuery(
    () => {
      if (searchQuery) return db.files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).toArray();
      return db.files.filter(f => f.folderId === currentFolder).toArray();
    },
    [currentFolder, searchQuery]
  ) || [];

  const totalUsed = useLiveQuery(
    () => db.files.toArray().then(allFiles => allFiles.reduce((sum, f) => sum + f.size, 0)),
    []
  ) || 0;

  // Helpers
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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

  // Actions
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
    if (newSelection.size === 0) setIsSelectionMode(false);
  };

  const startSelection = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds) as string[];
    await transferManager.batchDelete(ids);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setModal(null);
  };

  const handleSingleDelete = async () => {
    const { item } = modal!;
    if (modal?.item._type === 'file') {
      await transferManager.deleteFile(item.id);
    } else {
      await db.folders.delete(item.id);
      await pushSyncState();
    }
    setModal(null);
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    const { item } = modal!;
    if (item._type === 'file') {
      await transferManager.renameFile(item.id, renameValue.trim());
    } else {
      await db.folders.update(item.id, { name: renameValue.trim(), updatedAt: Date.now() });
      await pushSyncState();
    }
    setModal(null);
    setRenameValue('');
  };

  const handleCreateFolder = async () => {
    if (!renameValue.trim()) return;
    await db.folders.add({
      id: crypto.randomUUID(),
      name: renameValue.trim(),
      parentId: currentFolder,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    await pushSyncState();
    setModal(null);
    setRenameValue('');
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto h-full pb-20">
      {/* Selection Toolbar */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-[100] glass-panel rounded-2xl p-3 flex items-center justify-between shadow-2xl border-primary/20"
          >
            <div className="flex items-center gap-3">
              <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="p-1.5 hover:bg-black/5 rounded-full transition-colors">
                <X size={20} />
              </button>
              <span className="text-sm font-bold">{selectedIds.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setModal({ type: 'delete', item: { id: 'batch', name: `${selectedIds.size} items` } })}
                className="p-2 text-error hover:bg-error-container/20 rounded-xl transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage & Path */}
      <div className="flex flex-col gap-3">
        <section className="glass-panel rounded-3xl p-4 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 mb-1">
              <span>Storage Usage</span>
              <span>Unlimited</span>
            </div>
            <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-1">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((totalUsed / (1024 * 1024 * 1024)) * 100, 100)}%` }}
                className="h-full bg-primary rounded-full"
              />
            </div>
            <p className="text-[10px] font-bold text-primary">{formatSize(totalUsed)} of Telegram Drive used</p>
          </div>
        </section>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {folderPath.map((crumb, i) => (
            <React.Fragment key={crumb.id || 'root'}>
              {i > 0 && <span className="text-outline/40">/</span>}
              <button
                onClick={() => {
                  const newPath = folderPath.slice(0, i + 1);
                  setFolderPath(newPath);
                  setCurrentFolder(crumb.id);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                  i === folderPath.length - 1 ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-on-surface-variant hover:bg-surface-container"
                )}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Folders Grid */}
      {folders.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-outline">Folders</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {folders.map(folder => (
              <motion.div
                key={folder.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (isSelectionMode) toggleSelection(folder.id);
                  else {
                    setCurrentFolder(folder.id);
                    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ type: 'folder', item: { ...folder, _type: 'folder' }, x: e.clientX, y: e.clientY });
                }}
                className={cn(
                  "glass-panel p-3 rounded-2xl flex items-center gap-3 transition-all cursor-pointer relative overflow-hidden",
                  selectedIds.has(folder.id) ? "ring-2 ring-primary bg-primary-container/20" : ""
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-primary-container/40 text-primary flex items-center justify-center shrink-0">
                  <Folder size={20} fill="currentColor" />
                </div>
                <span className="text-xs font-bold truncate">{folder.name}</span>
                {selectedIds.has(folder.id) && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center">
                    <CheckCircle2 size={10} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Files List */}
      <section className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-outline">Files ({files.length})</h3>
        </div>
        <div className="flex-1 min-h-[300px]">
          {files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-20 opacity-40">
              <div className="w-16 h-16 rounded-3xl bg-surface-container-high flex items-center justify-center mb-4">
                <FileText size={32} />
              </div>
              <p className="text-sm font-bold">No files found</p>
            </div>
          ) : (
            <Virtuoso
              data={files}
              useWindowScroll
              itemContent={(i, file) => (
                <div className="pb-2">
                  <motion.div
                    key={file.id}
                    onClick={() => {
                      if (isSelectionMode) toggleSelection(file.id);
                      else transferManager.queueDownload(file.id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ type: 'file', item: { ...file, _type: 'file' }, x: e.clientX, y: e.clientY });
                    }}
                    className={cn(
                      "glass-panel p-3 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group relative",
                      selectedIds.has(file.id) ? "ring-2 ring-primary bg-primary-container/10" : ""
                    )}
                  >
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", getFileColors(file.mimeType))}>
                      {getFileIcon(file.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-on-surface">{file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-on-surface-variant opacity-60">{formatSize(file.size)}</span>
                        <span className="w-1 h-1 rounded-full bg-outline/20" />
                        <span className="text-[10px] font-bold text-on-surface-variant opacity-60">
                          {new Date(file.updatedAt || file.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({ type: 'file', item: { ...file, _type: 'file' }, x: e.clientX, y: e.clientY });
                      }}
                      className="p-2 hover:bg-black/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical size={18} className="text-outline" />
                    </button>
                    {selectedIds.has(file.id) && (
                      <div className="absolute top-2 left-2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center border-2 border-white">
                        <CheckCircle2 size={12} />
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            />
          )}
        </div>
      </section>

      {/* FABs */}
      <div className="fixed bottom-24 right-6 flex flex-col gap-3 z-50">
        <input 
          type="file" id="file-upload" className="hidden" multiple 
          onChange={async (e) => {
            if (e.target.files) {
              for (let i = 0; i < e.target.files.length; i++) {
                await transferManager.queueUpload(e.target.files[i], currentFolder);
              }
              e.target.value = '';
            }
          }}
        />
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
          onClick={() => setModal({ type: 'createFolder' })}
          className="w-12 h-12 bg-surface-container-highest text-primary rounded-2xl shadow-xl flex items-center justify-center border border-primary/10"
        >
          <Folder size={24} />
        </motion.button>
        <motion.label
          htmlFor="file-upload"
          whileHover={{ scale: 1.05, rotate: 90 }} whileTap={{ scale: 0.9 }}
          className="w-14 h-14 bg-primary text-white rounded-2xl shadow-[0_12px_40px_-12px_rgba(59,96,143,0.5)] flex items-center justify-center cursor-pointer border-2 border-white/20 z-50"
        >
          <Plus size={32} strokeWidth={3} />
        </motion.label>
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <div className="fixed inset-0 z-[110]" onClick={() => setContextMenu(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-[111] bg-white rounded-2xl shadow-2xl border border-white/20 overflow-hidden min-w-[200px]"
              style={{ top: Math.min(contextMenu.y, window.innerHeight - 250), left: Math.min(contextMenu.x, window.innerWidth - 220) }}
            >
              <ContextButton icon={<Download size={16} />} label="Download" onClick={() => transferManager.queueDownload(contextMenu.item.id)} />
              <ContextButton icon={<Edit3 size={16} />} label="Rename" onClick={() => { setModal({ type: 'rename', item: contextMenu.item }); setRenameValue(contextMenu.item.name); }} />
              <ContextButton icon={<Info size={16} />} label="Details" onClick={() => setModal({ type: 'metadata', item: contextMenu.item })} />
              <ContextButton icon={<Layers size={16} />} label="Select" onClick={() => startSelection(contextMenu.item.id)} />
              <div className="h-px bg-surface-container mx-2 my-1" />
              <ContextButton icon={<Trash2 size={16} />} label="Delete" color="text-error" onClick={() => setModal({ type: 'delete', item: contextMenu.item })} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Modal */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm glass-panel rounded-[2rem] p-6 shadow-2xl relative overflow-hidden"
            >
              {modal.type === 'delete' && (
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-error-container text-error flex items-center justify-center">
                    <Trash2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-on-surface">Permanently Delete?</h3>
                    <p className="text-xs text-on-surface-variant opacity-60 mt-1 px-4">
                      This will remove <span className="font-bold text-on-surface">"{modal.item.name}"</span> from TeleDrive and Telegram storage.
                    </p>
                  </div>
                  <div className="flex gap-3 w-full mt-2">
                    <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-2xl font-bold bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors">Cancel</button>
                    <button onClick={modal.item.id === 'batch' ? handleBatchDelete : handleSingleDelete} className="flex-1 py-3 rounded-2xl font-bold bg-error text-white shadow-lg shadow-error/20 hover:opacity-90 transition-opacity">Delete</button>
                  </div>
                </div>
              )}

              {modal.type === 'rename' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary-container text-secondary flex items-center justify-center"><Edit3 size={20}/></div>
                    <h3 className="text-lg font-extrabold">Rename</h3>
                  </div>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-container border-2 border-transparent focus:border-primary focus:bg-white outline-none font-bold transition-all"
                  />
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-2xl font-bold text-on-surface-variant">Cancel</button>
                    <button onClick={handleRename} className="flex-1 py-3 rounded-2xl font-bold bg-primary text-white shadow-lg">Save</button>
                  </div>
                </div>
              )}

              {modal.type === 'createFolder' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-container text-primary flex items-center justify-center"><Folder size={20} fill="currentColor"/></div>
                    <h3 className="text-lg font-extrabold">New Folder</h3>
                  </div>
                  <input
                    autoFocus
                    placeholder="Folder name"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-container border-2 border-transparent focus:border-primary focus:bg-white outline-none font-bold transition-all"
                  />
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-2xl font-bold text-on-surface-variant">Cancel</button>
                    <button onClick={handleCreateFolder} className="flex-1 py-3 rounded-2xl font-bold bg-primary text-white shadow-lg">Create</button>
                  </div>
                </div>
              )}

              {modal.type === 'metadata' && (
                <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold">File Details</h3>
                    <button onClick={() => setModal(null)} className="p-1 hover:bg-black/5 rounded-full"><X size={20}/></button>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <MetaRow icon={<FileText size={16}/>} label="Name" value={modal.item.name} />
                    <MetaRow icon={<HardDrive size={16}/>} label="Size" value={formatSize(modal.item.size)} />
                    <MetaRow icon={<Hash size={16}/>} label="MIME Type" value={modal.item.mimeType} />
                    <MetaRow icon={<Calendar size={16}/>} label="Created" value={new Date(modal.item.createdAt).toLocaleString()} />
                    <MetaRow icon={<Calendar size={16}/>} label="Last Modified" value={new Date(modal.item.updatedAt).toLocaleString()} />
                    {modal.item.checksum && <MetaRow icon={<Hash size={16}/>} label="SHA-256" value={modal.item.checksum.substring(0, 16) + '...'} />}
                    {modal.item.telegramMessageId && <MetaRow icon={<Plus size={16}/>} label="Telegram Msg ID" value={modal.item.telegramMessageId} />}
                    <MetaRow icon={<Plus size={16}/>} label="Internal ID" value={modal.item.id.substring(0, 8) + '...'} />
                  </div>

                  <button 
                    onClick={() => { transferManager.queueDownload(modal.item.id); setModal(null); }}
                    className="w-full py-4 bg-primary text-white rounded-3xl font-bold shadow-xl shadow-primary/20"
                  >
                    Download File
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContextButton({ icon, label, onClick, color }: any) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-3 hover:bg-black/5 transition-colors",
        color || "text-on-surface"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MetaRow({ icon, label, value }: any) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-outline opacity-40">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-outline opacity-50 mb-0.5">{label}</p>
        <p className="text-xs font-bold break-all">{value}</p>
      </div>
    </div>
  );
}
