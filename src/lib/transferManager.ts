import { db, type UploadQueueItem, type DownloadQueueItem } from './db';
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

/** Convert a browser File/Blob to a Buffer that gramjs can use */
async function fileToBuffer(file: File | Blob): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export class TransferManager {
  private static instance: TransferManager;
  private isProcessingUploads = false;
  private isProcessingDownloads = false;
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
    // Small delay to let the client connect
    setTimeout(() => {
      this.processQueue();
      this.processDownloadQueue();
    }, 2000);
  }

  private setupBackgroundHooks() {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive && (this.isProcessingUploads || this.isProcessingDownloads)) {
          const taskId = await BackgroundTask.beforeExit(async () => {
            while (this.isProcessingUploads || this.isProcessingDownloads) {
              await new Promise(r => setTimeout(r, 1000));
            }
            BackgroundTask.finish({ taskId });
          });
        }
      });
    }
  }

  async queueUpload(file: File, folderId: string | null) {
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
      totalChunks
    };

    await db.uploadQueue.put(item);

    // Store file reference in memory
    // @ts-ignore
    window[`file_${item.id}`] = file;

    this.processQueue();
    return item.id;
  }

  async processQueue() {
    if (this.isProcessingUploads || this.pauseRequested) return;
    this.isProcessingUploads = true;

    try {
      const pending = await db.uploadQueue
        .where('status')
        .anyOf(['pending', 'uploading'])
        .toArray();

      for (const item of pending) {
        if (this.pauseRequested) break;
        await this.uploadItem(item);
      }
    } catch (e) {
      console.error('Queue processing error:', e);
    } finally {
      this.isProcessingUploads = false;
    }
  }

  private async uploadItem(item: UploadQueueItem) {
    await db.uploadQueue.update(item.id!, { status: 'uploading' });

    // @ts-ignore
    const file = window[`file_${item.id}`] as File;

    if (!file) {
      await db.uploadQueue.update(item.id!, {
        status: 'failed',
        error: 'File reference lost. Please re-select the file.'
      });
      return;
    }

    try {
      const client = await getClient();
      if (!client.connected) {
        await client.connect();
      }

      const channelId = await getDriveChannelId();
      const totalChunks = item.totalChunks || Math.ceil(file.size / CHUNK_SIZE);
      const isChunked = totalChunks > 1;
      let firstMsgId: number | undefined;

      for (let i = item.currentChunk || 0; i < totalChunks; i++) {
        if (this.pauseRequested) {
          await db.uploadQueue.update(item.id!, { status: 'paused', currentChunk: i });
          return;
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);
        const chunkName = isChunked ? `${file.name}.part${i + 1}` : file.name;

        // CRITICAL: Convert File/Blob to Buffer for gramjs compatibility
        const buffer = await fileToBuffer(chunkBlob);

        let retries = 0;
        const maxRetries = 3;
        let result: any = null;

        while (retries < maxRetries) {
          try {
            if (!client.connected) {
              await client.connect();
            }

            result = await client.sendFile(channelId as any, {
              file: new Api.InputFile({
                id: BigInt(Date.now() + i) as any,
                parts: 1,
                name: chunkName,
                md5Checksum: ''
              }),
              caption: isChunked ? `CHUNK|${item.id}|${i + 1}|${totalChunks}` : undefined,
              forceDocument: true,
              progressCallback: (progress: any) => {
                const overallProgress = (i + Number(progress)) / totalChunks;
                db.uploadQueue.update(item.id!, { progress: overallProgress });
              }
            });
            break; // Success
          } catch (uploadErr: any) {
            retries++;
            console.warn(`Upload attempt ${retries} failed for chunk ${i + 1}:`, uploadErr.message);

            if (uploadErr instanceof errors.FloodWaitError) {
              console.warn(`Flood wait: ${uploadErr.seconds}s`);
              await new Promise(r => setTimeout(r, uploadErr.seconds * 1000));
            } else if (retries >= maxRetries) {
              throw uploadErr;
            } else {
              await new Promise(r => setTimeout(r, 2000 * retries));
            }
          }
        }

        // Fallback: try sendFile with buffer directly
        if (!result) {
          try {
            result = await client.sendFile(channelId as any, {
              file: buffer,
              caption: isChunked ? `CHUNK|${item.id}|${i + 1}|${totalChunks}` : undefined,
              forceDocument: true,
              attributes: [
                new Api.DocumentAttributeFilename({ fileName: chunkName })
              ],
              progressCallback: (progress: any) => {
                const overallProgress = (i + Number(progress)) / totalChunks;
                db.uploadQueue.update(item.id!, { progress: overallProgress });
              }
            });
          } catch (bufferErr: any) {
            console.error(`Buffer upload also failed for chunk ${i + 1}:`, bufferErr.message);
            throw bufferErr;
          }
        }

        if (i === 0 && result) {
          firstMsgId = result.id;
        }

        // Save chunk progress
        await db.uploadQueue.update(item.id!, { currentChunk: i + 1 });
      }

      // Upload complete
      await db.uploadQueue.update(item.id!, { status: 'completed', progress: 1 });

      // Save file metadata to Dexie
      await db.files.put({
        id: item.id!,
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

      // Clean up file reference
      // @ts-ignore
      delete window[`file_${item.id}`];

      // Sync metadata to Telegram
      try {
        await pushSyncState();
      } catch (syncErr) {
        console.warn('Failed to sync state after upload:', syncErr);
      }

    } catch (error: any) {
      console.error('Upload failed:', error.message);

      if (error instanceof errors.FloodWaitError) {
        this.pauseRequested = true;
        await db.uploadQueue.update(item.id!, { status: 'pending' });
        setTimeout(() => {
          this.pauseRequested = false;
          this.processQueue();
        }, error.seconds * 1000);
      } else {
        await db.uploadQueue.update(item.id!, {
          status: 'failed',
          error: error.message || 'Upload failed'
        });
      }
    }
  }

  async retryUpload(itemId: string) {
    await db.uploadQueue.update(itemId, { status: 'pending', error: undefined });
    this.processQueue();
  }

  async cancelUpload(itemId: string) {
    // @ts-ignore
    delete window[`file_${itemId}`];
    await db.uploadQueue.delete(itemId);
  }

  // ============ DOWNLOADS ============

  async queueDownload(fileId: string) {
    const file = await db.files.get(fileId);
    if (!file) return;

    // Update lastOpenedAt
    await db.files.update(fileId, { lastOpenedAt: Date.now() });

    // Check if already queued
    const existing = await db.downloadQueue.get(fileId);
    if (existing && (existing.status === 'downloading' || existing.status === 'pending')) return;

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
    if (this.isProcessingDownloads) return;
    this.isProcessingDownloads = true;

    try {
      const pending = await db.downloadQueue
        .where('status')
        .anyOf(['pending'])
        .toArray();

      for (const item of pending) {
        await this.downloadItem(item);
      }
    } catch (e) {
      console.error('Download queue error:', e);
    } finally {
      this.isProcessingDownloads = false;
    }
  }

  private async downloadItem(item: DownloadQueueItem) {
    const file = await db.files.get(item.id);
    if (!file) {
      await db.downloadQueue.update(item.id, { status: 'failed', error: 'File metadata not found' });
      return;
    }

    await db.downloadQueue.update(item.id, { status: 'downloading' });

    try {
      const client = await getClient();
      if (!client.connected) {
        await client.connect();
      }

      const isNative = Capacitor.isNativePlatform();
      let blobParts: Uint8Array[] = [];

      if (file.isChunked) {
        // Fetch chunked file messages
        const result = await client.invoke(new Api.messages.GetHistory({
          peer: file.telegramChannelId! as any,
          offsetId: file.telegramMessageId! + file.totalChunks,
          limit: file.totalChunks + 5,
          addOffset: 0
        }));

        // @ts-ignore
        if (result.messages) {
          // @ts-ignore
          const messages = result.messages
            .filter((m: any) => m.media)
            .sort((a: any, b: any) => a.id - b.id);

          for (let i = 0; i < messages.length; i++) {
            const buffer = await client.downloadMedia(messages[i], {
              progressCallback: (progress: any) => {
                const overall = (i + Number(progress)) / file.totalChunks;
                db.downloadQueue.update(item.id, { progress: overall });
              }
            });

            if (buffer) {
              if (isNative) {
                const base64 = Buffer.from(buffer as any).toString('base64');
                await Filesystem.appendFile({
                  path: file.name,
                  data: base64,
                  directory: Directory.Documents
                });
              } else {
                blobParts.push(new Uint8Array(buffer as any));
              }
            }
          }
        }
      } else {
        // Single file download
        const result = await client.invoke(new Api.messages.GetMessages({
          id: [new Api.InputMessageID({ id: file.telegramMessageId! })]
        }));

        // @ts-ignore
        if (result.messages && result.messages.length > 0) {
          // @ts-ignore
          const msg = result.messages[0];
          const buffer = await client.downloadMedia(msg, {
            progressCallback: (progress: any) => {
              db.downloadQueue.update(item.id, { progress: Number(progress) });
            }
          });

          if (buffer) {
            if (isNative) {
              const base64 = Buffer.from(buffer as any).toString('base64');
              await Filesystem.writeFile({
                path: file.name,
                data: base64,
                directory: Directory.Documents
              });
            } else {
              blobParts.push(new Uint8Array(buffer as any));
            }
          }
        }
      }

      await db.downloadQueue.update(item.id, { status: 'completed', progress: 1 });

      // Trigger download in browser or show native path
      if (!isNative && blobParts.length > 0) {
        const assembledBlob = new Blob(blobParts as any, { type: file.mimeType });
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
          path: file.name,
          directory: Directory.Documents
        });
        console.log('Downloaded to:', uri.uri);
      }

      // Auto-clean completed downloads after 5s
      setTimeout(() => {
        db.downloadQueue.delete(item.id);
      }, 5000);

    } catch (e: any) {
      console.error('Download failed:', e.message);
      await db.downloadQueue.update(item.id, { status: 'failed', error: e.message });
    }
  }
}

export const transferManager = TransferManager.getInstance();
