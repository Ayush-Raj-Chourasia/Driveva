import Dexie, { type EntityTable } from 'dexie';

export interface DriveFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  telegramMessageId?: number;
  telegramChannelId?: number;
  isChunked: boolean;
  totalChunks: number;
  folderId: string | null; // null means root
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

export interface DriveFolder {
  id: string;
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
  id: string;
  name: string;
  localPath?: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'failed' | 'completed' | 'paused';
  error?: string;
  folderId: string | null;
  currentChunk?: number;
  totalChunks?: number;
  mimeType: string;
  createdAt: number;
}

export interface DownloadQueueItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'downloading' | 'failed' | 'completed';
  error?: string;
  createdAt: number;
}

export interface AppSetting {
  key: string;
  value: any;
}

class TeleDriveDB extends Dexie {
  files!: EntityTable<DriveFile, 'id'>;
  folders!: EntityTable<DriveFolder, 'id'>;
  syncState!: EntityTable<DriveSyncState, 'key'>;
  uploadQueue!: EntityTable<UploadQueueItem, 'id'>;
  downloadQueue!: EntityTable<DownloadQueueItem, 'id'>;
  settings!: EntityTable<AppSetting, 'key'>;

  constructor() {
    super('TeleDriveDB');
    this.version(3).stores({
      files: 'id, name, folderId, telegramMessageId, createdAt, updatedAt, lastOpenedAt',
      folders: 'id, parentId, name, createdAt',
      syncState: 'key',
      uploadQueue: 'id, status, folderId, createdAt',
      downloadQueue: 'id, status, createdAt',
      settings: 'key'
    });
  }
}

export const db = new TeleDriveDB();

// Helper to get/set settings
export async function getSetting(key: string, defaultValue: any = null): Promise<any> {
  const row = await db.settings.get(key);
  return row ? row.value : defaultValue;
}

export async function setSetting(key: string, value: any): Promise<void> {
  await db.settings.put({ key, value });
}
