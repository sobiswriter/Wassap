
const DB_NAME = 'whatsapp_media_db';
const STORE_NAME = 'media_store';
const PENDING_STORE_NAME = 'pending_messages';
const SYNC_STORE_NAME = 'synced_chats';
const DB_VERSION = 2;

interface MediaEntry {
    id: string;
    data: string;
    timestamp: number;
}

export interface PendingBackgroundMessage {
    id: string;
    chatId: string;
    message: any;
    createdAt: number;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(PENDING_STORE_NAME)) {
                db.createObjectStore(PENDING_STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(SYNC_STORE_NAME)) {
                db.createObjectStore(SYNC_STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const saveMedia = async (id: string, data: string): Promise<void> => {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Check if data is too big for a single record (most browsers limit to 100MB+ which is fine)
        // We store it as a simple record
        const entry: MediaEntry = {
            id,
            data,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = store.put(entry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error saving to IndexedDB:', error);
        throw error;
    }
};

export const getMedia = async (id: string): Promise<string | null> => {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => {
                const result = request.result as MediaEntry | undefined;
                resolve(result ? result.data : null);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error getting from IndexedDB:', error);
        return null;
    }
};

export const deleteMedia = async (id: string): Promise<void> => {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error deleting from IndexedDB:', error);
    }
};

export const saveSyncedChats = async (chats: any[]): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
        const store = tx.objectStore(SYNC_STORE_NAME);
        for (const chat of chats) {
            store.put(chat);
        }
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.warn('Error saving synced chats to IndexedDB:', error);
    }
};

export const getSyncedChats = async (): Promise<any[]> => {
    try {
        const db = await openDB();
        const tx = db.transaction(SYNC_STORE_NAME, 'readonly');
        const store = tx.objectStore(SYNC_STORE_NAME);
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.warn('Error getting synced chats from IndexedDB:', error);
        return [];
    }
};

export const saveBackgroundPendingMessage = async (item: PendingBackgroundMessage): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(PENDING_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PENDING_STORE_NAME);
        return new Promise((resolve, reject) => {
            const req = store.put(item);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.warn('Error saving background pending message:', error);
    }
};

export const getBackgroundPendingMessages = async (): Promise<PendingBackgroundMessage[]> => {
    try {
        const db = await openDB();
        const tx = db.transaction(PENDING_STORE_NAME, 'readonly');
        const store = tx.objectStore(PENDING_STORE_NAME);
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.warn('Error getting background pending messages:', error);
        return [];
    }
};

export const clearBackgroundPendingMessage = async (id: string): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(PENDING_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PENDING_STORE_NAME);
        return new Promise((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.warn('Error clearing background pending message:', error);
    }
};

export const clearAllBackgroundPendingMessages = async (): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(PENDING_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PENDING_STORE_NAME);
        return new Promise((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.warn('Error clearing all background pending messages:', error);
    }
};

