import { db, type UploadQueueItem } from './db';
import { getClient } from './telegram/client';
import { getDriveChannelId, pushSyncState } from './telegram/sync';
import { Api } from 'telegram';
import { errors } from 'telegram';
import { App } from '@capacitor/app';
import { BackgroundTask } from '@capacitor/background-task';

const CHUNK_SIZE = 1.9 * 1024 * 1024 * 1024; // 1.9GB

export class TransferManager {
  private static instance: TransferManager;
  private isProcessing = false;
  private pauseRequested = false;

  private constructor() {
    this.setupBackgroundHooks();
  }

  static getInstance() {
    if (!TransferManager.instance) {
      TransferManager.instance = new TransferManager();
    }
    return TransferManager.instance;
  }

  private setupBackgroundHooks() {
    App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive && this.isProcessing) {
        const taskId = await BackgroundTask.beforeExit(async () => {
          while(this.isProcessing) {
             await new Promise(r => setTimeout(r, 1000));
          }
          BackgroundTask.finish({ taskId });
        });
      }
    });
  }

  async queueUpload(file: File, folderId: string | null) {
    const item: UploadQueueItem = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending',
      folderId,
      mimeType: file.type,
      createdAt: Date.now()
    };
    
    await db.uploadQueue.put(item);
    
    // @ts-ignore
    window[`file_${item.id}`] = file;

    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing || this.pauseRequested) return;
    this.isProcessing = true;

    try {
      const pending = await db.uploadQueue.where('status').equals('pending').toArray();
      
      for (const item of pending) {
        if (this.pauseRequested) break;
        await this.uploadItem(item);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async uploadItem(item: UploadQueueItem) {
    await db.uploadQueue.update(item.id, { status: 'uploading' });
    // @ts-ignore
    const file = window[`file_${item.id}`] as File;
    
    if (!file) {
      await db.uploadQueue.update(item.id, { status: 'failed', error: 'File lost from memory' });
      return;
    }

    try {
      const client = await getClient();
      const channelId = await getDriveChannelId();

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const isChunked = totalChunks > 1;
      let firstMsgId: number | undefined;

      for (let i = 0; i < totalChunks; i++) {
        if (this.pauseRequested) break;

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);
        const chunkName = isChunked ? `${file.name}.part${i+1}` : file.name;
        const chunkFile = new File([chunkBlob], chunkName, { type: file.type });

        const result = await client.sendFile(channelId, {
          file: chunkFile,
          caption: isChunked ? `Chunk ${i+1}/${totalChunks} of ${item.id}` : undefined,
          forceDocument: true,
          progressCallback: (progress: number) => {
            const overallProgress = (i + progress) / totalChunks;
            db.uploadQueue.update(item.id, { progress: overallProgress });
          }
        });

        if (i === 0 && result) {
            firstMsgId = result.id;
        }
      }

      if (!this.pauseRequested) {
        await db.uploadQueue.update(item.id, { status: 'completed', progress: 1 });
        
        await db.files.put({
          id: item.id,
          name: item.name,
          size: item.size,
          mimeType: item.mimeType,
          telegramMessageId: firstMsgId,
          telegramChannelId: typeof channelId === 'number' ? channelId : Number(channelId),
          isChunked,
          totalChunks,
          folderId: item.folderId,
          createdAt: item.createdAt,
          updatedAt: Date.now()
        });

        await pushSyncState();
      }
    } catch (error: any) {
      if (error instanceof errors.FloodWaitError) {
        console.warn(`Flood wait! Pausing queue for ${error.seconds}s`);
        this.pauseRequested = true;
        await db.uploadQueue.update(item.id, { status: 'pending' });
        setTimeout(() => {
          this.pauseRequested = false;
          this.processQueue();
        }, error.seconds * 1000);
      } else {
        console.error('Upload failed', error);
        await db.uploadQueue.update(item.id, { status: 'failed', error: error.message });
      }
    }
  }
}

export const transferManager = TransferManager.getInstance();
