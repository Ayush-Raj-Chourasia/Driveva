import React from 'react';
import { Folder, FileText, Image as ImageIcon, FileCode, MoreVertical, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function DriveView() {
  const folders = [
    { name: 'Design Assets', count: 12, color: 'bg-primary-container/40', text: 'text-primary' },
    { name: 'Invoices', count: 45, color: 'bg-secondary-container/40', text: 'text-secondary' },
    { name: 'Vacation 2023', count: 128, color: 'bg-tertiary-container/40', text: 'text-tertiary' },
  ];

  const recentFiles = [
    { name: 'Q3_Marketing_Report.pdf', type: 'pdf', size: '2.4 MB', time: '2 hours ago', iconColor: 'bg-error-container', textColor: 'text-error' },
    { name: 'Hero_Concept_v2.png', type: 'image', size: '4.1 MB', time: 'Yesterday', iconColor: 'bg-primary-container', textColor: 'text-primary' },
    { name: 'Project_Notes.docx', type: 'doc', size: '156 KB', time: 'Oct 12', iconColor: 'bg-secondary-container', textColor: 'text-secondary' },
  ];

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      {/* Storage Overview */}
      <section className="glass-panel rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Storage</h2>
          <p className="text-sm text-on-surface-variant opacity-70">45 GB of 100 GB used</p>
        </div>
        <div className="w-full sm:w-1/2 h-3 bg-surface-container-highest rounded-full overflow-hidden p-[1px]">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '45%' }}
            className="h-full bg-gradient-to-r from-tertiary-container to-primary-container rounded-full"
          />
        </div>
      </section>

      {/* Folders */}
      <section>
        <h2 className="text-lg font-bold text-on-surface mb-4">Folders</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {folders.map((folder, i) => (
            <motion.div
              key={folder.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              whileTap={{ scale: 0.95 }}
              className="glass-panel p-4 rounded-3xl flex flex-col gap-2 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", folder.color, folder.text)}>
                <Folder size={24} fill="currentColor" className="opacity-80" />
              </div>
              <div className="mt-2 text-center sm:text-left">
                <p className="text-sm font-bold truncate">{folder.name}</p>
                <p className="text-[11px] text-outline">{folder.count} Files</p>
              </div>
            </motion.div>
          ))}
          <div className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center gap-2 border-dashed border-2 border-outline-variant/30 bg-transparent hover:bg-white/30 transition-colors cursor-pointer group">
            <Plus className="text-outline group-hover:text-primary" size={24} />
            <span className="text-sm font-bold text-outline">New Folder</span>
          </div>
        </div>
      </section>

      {/* Recent Files */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-on-surface">Recent Files</h2>
          <span className="px-3 py-1 bg-surface-container-high rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            This Week
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {recentFiles.map((file, i) => (
            <motion.div
              key={file.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel p-3 rounded-2xl flex items-center gap-4 hover:bg-white/40 transition-colors cursor-pointer group"
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", file.iconColor, file.textColor)}>
                {file.type === 'pdf' && <FileText size={24} />}
                {file.type === 'image' && <ImageIcon size={24} />}
                {file.type === 'doc' && <FileCode size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">{file.name}</p>
                <p className="text-[11px] text-on-surface-variant opacity-60 truncate">
                  Modified {file.time} • {file.size}
                </p>
              </div>
              <button className="p-2 text-outline hover:text-on-surface opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical size={20} />
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAB */}
      <motion.button 
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-28 right-6 w-14 h-14 bg-gradient-to-br from-primary to-secondary text-white rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center z-40 md:static md:mt-4 md:mx-auto md:w-full md:rounded-3xl"
      >
        <Plus size={32} strokeWidth={3} />
      </motion.button>
    </div>
  );
}
