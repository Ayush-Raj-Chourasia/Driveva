import { db, type UploadQueueItem, type DownloadQueueItem } from './db';
import { getClient } from './telegram/client';
import { getDriveChannelId, pushSyncState } from './telegram/sync';
import { Api } from 'telegram';
import { errors } from 'telegram';
import { App } from '@capacitor/app';
import { BackgroundTask } from '@capawesome/capacitor-background-task';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
      TransferManager.instance.init();
    }
    return TransferManager.instance;
  }

  private async init() {
    // Resume pending transfers
    this.processQueue();
    this.processDownloadQueue();
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

    const item: DownloadQueueItem = {
      id: file.id,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending',
      createdAt: Date.now()
    };

    await db.downloadQueue.put(item);
    this.processDownloadQueue();
  }

  async processDownloadQueue() {
    const pending = await db.downloadQueue.where('status').equals('pending').toArray();
    for (const item of pending) {
      await this.downloadItem(item);
    }
  }

  private async downloadItem(item: DownloadQueueItem) {
    const file = await db.files.get(item.id);
    if (!file) {
      await db.downloadQueue.update(item.id, { status: 'failed', error: 'File not found' });
      return;
    }

    await db.downloadQueue.update(item.id, { status: 'downloading' });

    try {
      const client = await getClient();
      const isNative = Capacitor.isNativePlatform();
      let blobParts: BlobPart[] = [];
      let nativePath = '';

      if (isNative) {
        // Prepare file on native filesystem
        const check = await Filesystem.readdir({
           path: '',
           directory: Directory.Documents
        });
        // Just ensuring directory is accessible.
        nativePath = file.name;
      }
      
      const processBuffer = async (buffer: Buffer, currentIdx: number, totalParts: number) => {
        if (isNative) {
          // Convert buffer to base64 and append
          const base64 = buffer.toString('base64');
          await Filesystem.appendFile({
            path: nativePath,
            data: base64,
            directory: Directory.Documents
          });
        } else {
          blobParts.push(new Uint8Array(buffer as any));
        }
      };

      if (file.isChunked) {
        const result = await client.invoke(new Api.messages.GetHistory({
          peer: file.telegramChannelId! as any,
          offsetId: file.telegramMessageId! - 1,
          limit: file.totalChunks,
          addOffset: 0
        }));

        // @ts-ignore
        if (result.messages) {
          // @ts-ignore
          const messages = result.messages.sort((a, b) => a.id - b.id);
          for (let i = 0; i < messages.length; i++) {
             const buffer = await client.downloadMedia(messages[i], {
               progressCallback: (progress: any) => {
                 const overall = (i + Number(progress)) / file.totalChunks;
                 db.downloadQueue.update(item.id, { progress: overall });
               }
             });
             if (buffer) await processBuffer(buffer as Buffer, i, file.totalChunks);
          }
        }
      } else {
        const result = await client.invoke(new Api.messages.GetMessages({
          id: [new Api.InputMessageID({ id: file.telegramMessageId! })]
        }));
        
        // @ts-ignore
        if (result.messages && result.messages.length > 0) {
          // @ts-ignore
          const buffer = await client.downloadMedia(result.messages[0], {
            progressCallback: (progress: any) => {
              db.downloadQueue.update(item.id, { progress: Number(progress) });
            }
          });
          if (buffer) await processBuffer(buffer as Buffer, 0, 1);
        }
      }

      await db.downloadQueue.update(item.id, { status: 'completed', progress: 1 });

      if (!isNative && blobParts.length > 0) {
        const assembledBlob = new Blob(blobParts, { type: file.mimeType });
        const url = URL.createObjectURL(assembledBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else if (isNative) {
        const uri = await Filesystem.getUri({
          path: nativePath,
          directory: Directory.Documents
        });
        alert(`Downloaded to: ${uri.uri}`);
      }
    } catch (e: any) {
      console.error('Download failed', e);
      await db.downloadQueue.update(item.id, { status: 'failed', error: e.message });
    }
  }
}

export const transferManager = TransferManager.getInstance();
