import { db, type UploadQueueItem, type DownloadQueueItem, type DriveFile } from './db';
import { getClient } from './telegram/client';
import { getDriveChannelId, pushSyncState } from './telegram/sync';
import { Api } from 'telegram';
import { errors } from 'telegram';
import { App } from '@capacitor/app';
import { BackgroundTask } from '@capawesome/capacitor-background-task';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Buffer } from 'buffer';

const CHUNK_SIZE = 500 * 1024 * 1024; // 500MB chunks
const MAX_CONCURRENT_UPLOADS = 3;
const MAX_CONCURRENT_DOWNLOADS = 2;

/** Calculate SHA-256 checksum of a file */
async function calculateChecksum(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function fileToBuffer(file: File | Blob): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export class TransferManager {
  private static instance: TransferManager;
  private activeUploads = 0;
  private activeDownloads = 0;
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
    setTimeout(() => {
      this.processQueue();
      this.processDownloadQueue();
    }, 2000);
  }

  private setupBackgroundHooks() {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive && (this.activeUploads > 0 || this.activeDownloads > 0)) {
          const taskId = await BackgroundTask.beforeExit(async () => {
            while (this.activeUploads > 0 || this.activeDownloads > 0) {
              await new Promise(r => setTimeout(r, 1000));
            }
            BackgroundTask.finish({ taskId });
          });
        }
      });
    }
  }

  async queueUpload(file: File, folderId: string | null) {
    const checksum = await calculateChecksum(file);
    
    // Check for duplicate
    const existing = await db.files.where('checksum').equals(checksum).first();
    if (existing) {
      console.log('Duplicate file detected, skipping upload:', file.name);
      // Just add to local DB with new name/folder if needed, but reuse Telegram metadata
      await db.files.put({
        ...existing,
        id: crypto.randomUUID(),
        name: file.name,
        folderId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      await pushSyncState();
      return;
    }

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const item: UploadQueueItem = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending',
      folderId,
      mimeType: file.type || 'application/octet-stream',
      createdAt: Date.now(),
      currentChunk: 0,
      totalChunks,
      checksum
    };

    await db.uploadQueue.put(item);
    // @ts-ignore
    window[`file_${item.id}`] = file;

    this.processQueue();
    return item.id;
  }

  async processQueue() {
    if (this.pauseRequested) return;
    if (this.activeUploads >= MAX_CONCURRENT_UPLOADS) return;

    const pending = await db.uploadQueue
      .where('status')
      .anyOf(['pending', 'uploading'])
      .limit(MAX_CONCURRENT_UPLOADS - this.activeUploads)
      .toArray();

    for (const item of pending) {
      if (item.status === 'uploading') continue; // Already being handled
      this.uploadItem(item);
    }
  }

  private async uploadItem(item: UploadQueueItem) {
    this.activeUploads++;
    await db.uploadQueue.update(item.id!, { status: 'uploading' });

    // @ts-ignore
    const file = window[`file_${item.id}`] as File;

    if (!file) {
      await db.uploadQueue.update(item.id!, {
        status: 'failed',
        error: 'File reference lost.'
      });
      this.activeUploads--;
      this.processQueue();
      return;
    }

    try {
      const client = await getClient();
      const channelId = await getDriveChannelId();
      const totalChunks = item.totalChunks || 1;
      const isChunked = totalChunks > 1;
      let firstMsgId: number | undefined;

      for (let i = item.currentChunk || 0; i < totalChunks; i++) {
        if (this.pauseRequested) {
          await db.uploadQueue.update(item.id!, { status: 'paused', currentChunk: i });
          this.activeUploads--;
          return;
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);
        const chunkName = isChunked ? `${file.name}.part${i + 1}` : file.name;
        const buffer = await fileToBuffer(chunkBlob);

        let retries = 0;
        let result: any = null;

        while (retries < 3) {
          try {
            if (!client.connected) await client.connect();
            result = await client.sendFile(channelId as any, {
              file: buffer,
              caption: isChunked ? `CHUNK|${item.id}|${i + 1}|${totalChunks}` : undefined,
              forceDocument: true,
              attributes: [new Api.DocumentAttributeFilename({ fileName: chunkName })],
              progressCallback: (progress: any) => {
                const overallProgress = (i + Number(progress)) / totalChunks;
                db.uploadQueue.update(item.id!, { progress: overallProgress });
              }
            });
            break;
          } catch (e: any) {
            retries++;
            if (e instanceof errors.FloodWaitError) {
              await new Promise(r => setTimeout(r, e.seconds * 1000));
            } else {
              await new Promise(r => setTimeout(r, 2000 * retries));
            }
          }
        }

        if (!result) throw new Error('Failed to upload chunk after retries');
        if (i === 0) firstMsgId = result.id;
        await db.uploadQueue.update(item.id!, { currentChunk: i + 1 });
      }

      await db.uploadQueue.update(item.id!, { status: 'completed', progress: 1 });
      await db.files.put({
        id: item.id!,
        name: item.name,
        size: item.size,
        mimeType: item.mimeType,
        telegramMessageId: firstMsgId,
        telegramChannelId: Number(channelId),
        isChunked,
        totalChunks,
        folderId: item.folderId,
        createdAt: item.createdAt,
        updatedAt: Date.now(),
        checksum: item.checksum
      });

      // @ts-ignore
      delete window[`file_${item.id}`];
      await pushSyncState();

    } catch (error: any) {
      console.error('Upload failed:', error.message);
      await db.uploadQueue.update(item.id!, { status: 'failed', error: error.message });
    } finally {
      this.activeUploads--;
      this.processQueue();
    }
  }

  // ============ DELETION ============

  async deleteFile(fileId: string) {
    const file = await db.files.get(fileId);
    if (!file) return;

    try {
      const client = await getClient();
      const channelId = await getDriveChannelId();
      
      // Delete from Telegram
      if (file.telegramMessageId) {
        if (file.isChunked) {
          // If chunked, we need to find all related messages. 
          // For now, we delete the primary one, and the user can manually clean or we implement chunk tracking.
          // Better approach: search messages with the fileId in caption
          const searchResult = await client.invoke(new Api.messages.Search({
            peer: channelId as any,
            q: file.id,
            filter: new Api.InputMessagesFilterDocument(),
            limit: 100
          }));
          // @ts-ignore
          if (searchResult.messages) {
            // @ts-ignore
            const ids = searchResult.messages.map(m => m.id);
            await client.invoke(new Api.channels.DeleteMessages({
              channel: channelId as any,
              id: ids
            }));
          }
        } else {
          await client.invoke(new Api.channels.DeleteMessages({
            channel: channelId as any,
            id: [file.telegramMessageId]
          }));
        }
      }
    } catch (e) {
      console.warn('Failed to delete from Telegram, removing locally anyway:', e);
    }

    await db.files.delete(fileId);
    await pushSyncState();
  }

  async batchDelete(fileIds: string[]) {
    for (const id of fileIds) {
      await this.deleteFile(id);
    }
  }

  // ============ RENAME ============

  async renameFile(fileId: string, newName: string) {
    await db.files.update(fileId, { name: newName, updatedAt: Date.now() });
    await pushSyncState();
  }

  // ============ DOWNLOADS ============

  async queueDownload(fileId: string) {
    const file = await db.files.get(fileId);
    if (!file) return;
    await db.files.update(fileId, { lastOpenedAt: Date.now() });
    const existing = await db.downloadQueue.get(fileId);
    if (existing && (existing.status === 'downloading' || existing.status === 'pending')) return;

    await db.downloadQueue.put({
      id: file.id,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending',
      createdAt: Date.now()
    });
    this.processDownloadQueue();
  }

  async processDownloadQueue() {
    if (this.activeDownloads >= MAX_CONCURRENT_DOWNLOADS) return;
    const pending = await db.downloadQueue
      .where('status')
      .anyOf(['pending'])
      .limit(MAX_CONCURRENT_DOWNLOADS - this.activeDownloads)
      .toArray();

    for (const item of pending) {
      this.downloadItem(item);
    }
  }

  private async downloadItem(item: DownloadQueueItem) {
    this.activeDownloads++;
    const file = await db.files.get(item.id);
    if (!file) {
      await db.downloadQueue.update(item.id, { status: 'failed', error: 'File not found' });
      this.activeDownloads--;
      this.processDownloadQueue();
      return;
    }

    await db.downloadQueue.update(item.id, { status: 'downloading' });

    try {
      const client = await getClient();
      const isNative = Capacitor.isNativePlatform();
      let blobParts: Uint8Array[] = [];

      if (file.isChunked) {
        const channelId = await getDriveChannelId();
        const searchResult = await client.invoke(new Api.messages.Search({
          peer: channelId as any,
          q: file.id,
          filter: new Api.InputMessagesFilterDocument(),
          limit: 100
        }));
        
        // @ts-ignore
        const messages = (searchResult.messages || [])
          .filter((m: any) => m.media)
          .sort((a: any, b: any) => a.id - b.id);

        for (let i = 0; i < messages.length; i++) {
          const buffer = await client.downloadMedia(messages[i], {
            progressCallback: (p: any) => {
              const overall = (i + Number(p)) / messages.length;
              db.downloadQueue.update(item.id, { progress: overall });
            }
          });
          if (buffer) {
            if (isNative) {
              await Filesystem.appendFile({
                path: file.name,
                data: Buffer.from(buffer as any).toString('base64'),
                directory: Directory.Documents
              });
            } else {
              blobParts.push(new Uint8Array(buffer as any));
            }
          }
        }
      } else {
        const result = await client.invoke(new Api.messages.GetMessages({
          id: [new Api.InputMessageID({ id: file.telegramMessageId! })]
        }));
        // @ts-ignore
        const msg = result.messages[0];
        const buffer = await client.downloadMedia(msg, {
          progressCallback: (p: any) => db.downloadQueue.update(item.id, { progress: Number(p) })
        });
        if (buffer) {
          if (isNative) {
            await Filesystem.writeFile({
              path: file.name,
              data: Buffer.from(buffer as any).toString('base64'),
              directory: Directory.Documents
            });
          } else {
            blobParts.push(new Uint8Array(buffer as any));
          }
        }
      }

      await db.downloadQueue.update(item.id, { status: 'completed', progress: 1 });
      if (!isNative && blobParts.length > 0) {
        const url = URL.createObjectURL(new Blob(blobParts as any, { type: file.mimeType }));
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      setTimeout(() => db.downloadQueue.delete(item.id), 5000);
    } catch (e: any) {
      await db.downloadQueue.update(item.id, { status: 'failed', error: e.message });
    } finally {
      this.activeDownloads--;
      this.processDownloadQueue();
    }
  }

  async retryUpload(itemId: string) {
    await db.uploadQueue.update(itemId, { status: 'pending', error: undefined });
    this.processQueue();
  }
}

export const transferManager = TransferManager.getInstance();
