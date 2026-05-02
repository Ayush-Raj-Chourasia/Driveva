import { db, type UploadQueueItem } from './db';
import { getClient } from './telegram/client';
import { getDriveChannelId, pushSyncState } from './telegram/sync';
import { Api } from 'telegram';
import { errors } from 'telegram';
import { App } from '@capacitor/app';
import { BackgroundTask } from '@capawesome/capacitor-background-task';

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

        const result = await client.sendFile(channelId as any, {
          file: chunkFile,
          caption: isChunked ? `Chunk ${i+1}/${totalChunks} of ${item.id}` : undefined,
          forceDocument: true,
          progressCallback: (progress: any) => {
            const overallProgress = (i + Number(progress)) / totalChunks;
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

  async queueDownload(fileId: string) {
    const file = await db.files.get(fileId);
    if (!file) return;

    try {
      const client = await getClient();
      let blobParts: BlobPart[] = [];
      
      if (file.isChunked) {
        // Find all chunks. Telegram messages in the channel are sequential if uploaded together
        const result = await client.invoke(new Api.messages.GetHistory({
          peer: file.telegramChannelId! as any,
          offsetId: file.telegramMessageId! - 1, // Start just before the first chunk
          limit: file.totalChunks,
          addOffset: 0
        }));

        // @ts-ignore
        if (result.messages) {
          // @ts-ignore
          const messages = result.messages.sort((a, b) => a.id - b.id);
          for (let i = 0; i < messages.length; i++) {
             // download each chunk
             const buffer = await client.downloadMedia(messages[i], {
               progressCallback: (progress: any) => console.log(`Downloading chunk ${i+1}/${file.totalChunks}: ${progress}`)
             });
             if (buffer) blobParts.push(new Uint8Array(buffer as any));
          }
        }
      } else {
        // Single file
        const result = await client.invoke(new Api.messages.GetMessages({
          id: [new Api.InputMessageID({ id: file.telegramMessageId! })]
        }));
        
        // @ts-ignore
        if (result.messages && result.messages.length > 0) {
          // @ts-ignore
          const buffer = await client.downloadMedia(result.messages[0]);
          if (buffer) blobParts.push(new Uint8Array(buffer as any));
        }
      }

      if (blobParts.length > 0) {
        const assembledBlob = new Blob(blobParts, { type: file.mimeType });
        const url = URL.createObjectURL(assembledBlob);
        
        // Simple trigger for download in browser
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }

    } catch (e) {
      console.error('Download failed', e);
    }
  }
}

export const transferManager = TransferManager.getInstance();
