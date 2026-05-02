import { Api } from 'telegram';
import { getClient } from './client';
import { db } from '../db';
import { Buffer } from 'buffer';

const CHANNEL_TITLE = 'TeleDrive_Storage_DoNotDelete';

export async function getDriveChannelId(): Promise<bigint | number> {
  const client = await getClient();
  if (!client.connected) {
    await client.connect();
  }
  const dialogs = await client.getDialogs({});
  
  for (const dialog of dialogs) {
    if (dialog.title === CHANNEL_TITLE && dialog.isChannel) {
      // @ts-ignore
      return dialog.entity.id;
    }
  }

  // Create it if not found
  const result = await client.invoke(new Api.channels.CreateChannel({
    title: CHANNEL_TITLE,
    about: 'Internal storage for TeleDrive app. Do not delete this channel or its messages.',
    broadcast: true, 
  }));

  // @ts-ignore
  if (result.chats && result.chats.length > 0) {
    // @ts-ignore
    return result.chats[0].id;
  }
  
  throw new Error('Failed to create storage channel');
}

export async function pushSyncState() {
  const client = await getClient();
  if (!client.connected) {
    await client.connect();
  }

  const channelId = await getDriveChannelId();

  const files = await db.files.toArray();
  const folders = await db.folders.toArray();

  const state = {
    version: 1,
    timestamp: Date.now(),
    files,
    folders
  };

  const stateJson = JSON.stringify(state);
  const buffer = Buffer.from(stateJson, 'utf-8');

  // Find the old pinned message and delete it to save space
  try {
    const searchResult = await client.invoke(new Api.messages.Search({
      peer: channelId as any,
      q: '',
      filter: new Api.InputMessagesFilterPinned(),
      limit: 1,
    }));
    
    // @ts-ignore
    if (searchResult.messages && searchResult.messages.length > 0) {
       // @ts-ignore
      const oldMsg = searchResult.messages[0];
      await client.invoke(new Api.channels.DeleteMessages({
        channel: channelId as any,
        id: [oldMsg.id]
      }));
    }
  } catch (e) {
    console.warn('Could not delete old index message', e);
  }

  // Upload new state — use Buffer directly (not File object) for gramjs WebView compatibility
  const uploaded = await client.sendFile(channelId as any, {
    file: buffer,
    caption: 'TeleDrive_Index',
    forceDocument: true,
    attributes: [
      new Api.DocumentAttributeFilename({ fileName: 'index.json' })
    ]
  });

  // Pin it
  if (uploaded) {
    await client.invoke(new Api.messages.UpdatePinnedMessage({
      peer: channelId as any,
      id: uploaded.id,
      pmOneside: false,
    }));
  }
}

export async function pullSyncState() {
  const client = await getClient();
  const channelId = await getDriveChannelId();

  // Get pinned message
  const result = await client.invoke(new Api.messages.Search({
    peer: channelId as any,
    q: '',
    filter: new Api.InputMessagesFilterPinned(),
    limit: 1,
  }));

  // @ts-ignore
  if (result.messages && result.messages.length > 0) {
    // @ts-ignore
    const indexMsg = result.messages[0];
    if (indexMsg.media && indexMsg.media.document) {
      const buffer = await client.downloadMedia(indexMsg, {});
      if (buffer) {
        const stateJson = buffer.toString('utf-8');
        try {
          const state = JSON.parse(stateJson);
          
          await db.transaction('rw', db.files, db.folders, async () => {
            await db.files.clear();
            await db.folders.clear();
            
            if (state.files?.length) await db.files.bulkAdd(state.files);
            if (state.folders?.length) await db.folders.bulkAdd(state.folders);
          });
          console.log('Sync from remote completed successfully.');
        } catch (e) {
          console.error('Failed to parse remote index', e);
        }
      }
    }
  }
}
