import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { db } from '../db';

let _client: TelegramClient | null = null;

// Users should set these in .env (Vite uses VITE_ prefix by default, but let's check config or just use process.env if define was set)
// Looking at vite.config.ts, define wasn't set for TELEGRAM_API_ID. 
// Standard Vite uses import.meta.env.VITE_... Let's assume the user will set VITE_APP_ID and VITE_APP_HASH
const API_ID = parseInt(import.meta.env.VITE_TELEGRAM_API_ID || import.meta.env.VITE_APP_API_ID || '0');
const API_HASH = import.meta.env.VITE_TELEGRAM_API_HASH || import.meta.env.VITE_APP_API_HASH || '';

export async function getClient(): Promise<TelegramClient> {
  if (_client) return _client;

  if (!API_ID || !API_HASH) {
    throw new Error('Telegram API credentials missing. Please define VITE_TELEGRAM_API_ID and VITE_TELEGRAM_API_HASH in .env');
  }

  const sessionState = await db.syncState.get('telegram_session');
  const sessionString = sessionState?.value || '';
  const stringSession = new StringSession(sessionString);

  _client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: true, // Use WebSockets for browser compatibility
  });

  return _client;
}

export async function saveSession(client: TelegramClient) {
  const sessionString = (client.session as StringSession).save();
  await db.syncState.put({ key: 'telegram_session', value: sessionString });
}

export async function clearSession() {
  await db.syncState.delete('telegram_session');
  if (_client) {
    await _client.disconnect();
    _client = null;
  }
}
