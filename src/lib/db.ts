import Dexie, { type EntityTable } from 'dexie';

export interface DriveFile {
  id: string; // internal UUID
  name: string;
  size: number;
  mimeType: string;
  telegramMessageId?: number; // Main message ID or First Chunk message ID
  telegramChannelId?: number;
  isChunked: boolean;
  totalChunks: number;
  folderId: string | null; // null means root
  createdAt: number;
  updatedAt: number;
}

export interface DriveFolder {
  id: string; // internal UUID
  name: string;
  parentId: string | null; // null means root
  createdAt: number;
  updatedAt: number;
}

export interface DriveSyncState {
  key: string;
  value: any;
}

export interface UploadQueueItem {
  id: string; // file UUID
  name: string;
  localPath?: string; // For capacitor, or File object placeholder
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'failed' | 'completed' | 'paused';
  error?: string;
  folderId: string | null;
  mimeType: string;
  createdAt: number;
}

export interface DownloadQueueItem {
  id: string; // file UUID
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'downloading' | 'failed' | 'completed';
  error?: string;
  createdAt: number;
}

class TeleDriveDB extends Dexie {
  files!: EntityTable<DriveFile, 'id'>;
  folders!: EntityTable<DriveFolder, 'id'>;
  syncState!: EntityTable<DriveSyncState, 'key'>;
  uploadQueue!: EntityTable<UploadQueueItem, 'id'>;
  downloadQueue!: EntityTable<DownloadQueueItem, 'id'>;

  constructor() {
    super('TeleDriveDB');
    this.version(2).stores({
      files: 'id, name, folderId, telegramMessageId, createdAt',
      folders: 'id, parentId, name, createdAt',
      syncState: 'key',
      uploadQueue: 'id, status, folderId, createdAt',
      downloadQueue: 'id, status, createdAt'
    });
  }
}

export const db = new TeleDriveDB();
