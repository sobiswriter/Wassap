
const DB_NAME = 'whatsapp_media_db';
const STORE_NAME = 'media_store';
const DB_VERSION = 2;

interface MediaEntry {
    id: string;
    data: string;
    timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
            console.warn('IndexedDB upgrade was blocked');
        };
    });
};

export const saveMedia = async (id: string, data: string): Promise<void> => {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

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


