// IndexedDB manager for offline outgoing message queue and background notification exchange sync
import { Message } from '../types';

const OFFLINE_DB_NAME = 'whatsapp_offline_db';
const OFFLINE_DB_VERSION = 1;

export const PENDING_OUTBOX_STORE = 'pending_outbox';
export const SYNCED_BACKGROUND_STORE = 'synced_background';

export interface PendingQueueItem {
  id: string;
  chatId: string;
  message: Message;
  queuedAt: number;
}

export interface BackgroundExchangeItem {
  id: string;
  chatId: string;
  userMessage: Message;
  personaReplies: Message[];
  timestamp: number;
}

export const openOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PENDING_OUTBOX_STORE)) {
        db.createObjectStore(PENDING_OUTBOX_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SYNCED_BACKGROUND_STORE)) {
        db.createObjectStore(SYNCED_BACKGROUND_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('whatsapp_offline_db upgrade blocked');
    };
  });
};

// Enqueue message sent while device was offline
export const enqueuePendingMessage = async (chatId: string, message: Message): Promise<void> => {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(PENDING_OUTBOX_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_OUTBOX_STORE);

    const item: PendingQueueItem = {
      id: message.id,
      chatId,
      message,
      queuedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to enqueue pending offline message:', err);
  }
};

// Get all pending messages waiting to be sent
export const getPendingMessages = async (): Promise<PendingQueueItem[]> => {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(PENDING_OUTBOX_STORE, 'readonly');
    const store = tx.objectStore(PENDING_OUTBOX_STORE);

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to retrieve pending offline messages:', err);
    return [];
  }
};

// Remove a message from pending outbox once sent
export const removePendingMessage = async (id: string): Promise<void> => {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(PENDING_OUTBOX_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_OUTBOX_STORE);

    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to remove pending offline message:', err);
  }
};

// Record an inline reply & persona response handled while window was closed
export const recordBackgroundExchange = async (
  chatId: string,
  userMessage: Message,
  personaReplies: Message[]
): Promise<void> => {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(SYNCED_BACKGROUND_STORE, 'readwrite');
    const store = tx.objectStore(SYNCED_BACKGROUND_STORE);

    const item: BackgroundExchangeItem = {
      id: userMessage.id || Date.now().toString(),
      chatId,
      userMessage,
      personaReplies,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to record background exchange in IndexedDB:', err);
  }
};

// Retrieve all background exchanges to sync with active chat state
export const getBackgroundExchanges = async (): Promise<BackgroundExchangeItem[]> => {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(SYNCED_BACKGROUND_STORE, 'readonly');
    const store = tx.objectStore(SYNCED_BACKGROUND_STORE);

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get background exchanges:', err);
    return [];
  }
};

// Clear all background exchanges once reconciled in React state
export const clearBackgroundExchanges = async (): Promise<void> => {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(SYNCED_BACKGROUND_STORE, 'readwrite');
    const store = tx.objectStore(SYNCED_BACKGROUND_STORE);

    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to clear background exchanges:', err);
  }
};
