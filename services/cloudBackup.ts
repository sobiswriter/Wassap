import { Chat, AppSettings, UserProfile } from '../types';

export interface CloudSlot {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  chatCount: number;
  messageCount: number;
  personaCount: number;
  sizeBytes?: number;
}

export interface CloudBackupData {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  chatCount: number;
  messageCount: number;
  personaCount: number;
  payload: {
    chats: Chat[];
    settings?: AppSettings;
    userProfile?: UserProfile;
    exportedAt: string;
  };
}

const LOCAL_SLOTS_KEY = 'wassap_cloud_backup_slots';

/**
 * Reads local slots cache from localStorage.
 */
export function getLocalSlots(): CloudSlot[] {
  try {
    const raw = localStorage.getItem(LOCAL_SLOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Saves slots cache to localStorage.
 */
function setLocalSlots(slots: CloudSlot[]): void {
  try {
    localStorage.setItem(LOCAL_SLOTS_KEY, JSON.stringify(slots));
  } catch (e) {
    console.warn('Could not cache cloud slots to localStorage:', e);
  }
}

/**
 * Fetches the list of all available cloud backup slots.
 */
export async function listCloudSlots(passcode?: string): Promise<{ ok: boolean; slots: CloudSlot[]; error?: string; locked?: boolean }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (passcode) headers['x-vertex-passcode'] = passcode;

    const res = await fetch('/api/gemini/backup?action=list', {
      method: 'GET',
      headers
    });

    if (res.status === 401) {
      return { ok: false, slots: getLocalSlots(), locked: true, error: 'Password required' };
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, slots: getLocalSlots(), error: data.error || 'Failed to list backup slots' };
    }

    const data = await res.json();
    const serverSlots: CloudSlot[] = data.slots || [];
    setLocalSlots(serverSlots);
    return { ok: true, slots: serverSlots };
  } catch (err: any) {
    console.warn('Network error listing cloud slots, falling back to local slots cache:', err);
    return { ok: true, slots: getLocalSlots() };
  }
}

/**
 * Saves a new backup slot to the cloud.
 */
export async function saveCloudSlot(
  title: string,
  payload: { chats: Chat[]; settings?: AppSettings; userProfile?: UserProfile },
  passcode?: string
): Promise<{ ok: boolean; slot?: CloudSlot; error?: string; locked?: boolean }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (passcode) headers['x-vertex-passcode'] = passcode;

    const res = await fetch('/api/gemini/backup', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'save',
        title: title || 'Progress Save',
        payload: {
          ...payload,
          exportedAt: new Date().toISOString()
        },
        passcode
      })
    });

    if (res.status === 401) {
      return { ok: false, locked: true, error: 'Incorrect passcode. Unlock Cloud Save with your member passkey.' };
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || 'Failed to save cloud slot' };
    }

    const data = await res.json();
    const newSlot: CloudSlot = data.slot;

    // Update local cache
    const current = getLocalSlots();
    const updated = [newSlot, ...current.filter(s => s.id !== newSlot.id)];
    setLocalSlots(updated);

    // Also mirror full slot data locally for offline recovery
    try {
      localStorage.setItem(`wassap_slot_data_${newSlot.id}`, JSON.stringify({
        ...newSlot,
        payload
      }));
    } catch (e) {
      console.warn('Could not mirror slot data locally:', e);
    }

    return { ok: true, slot: newSlot };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network error saving cloud slot' };
  }
}

/**
 * Retrieves a full backup slot to restore.
 */
export async function restoreCloudSlot(
  slotId: string,
  passcode?: string
): Promise<{ ok: boolean; slotData?: CloudBackupData; error?: string; locked?: boolean }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (passcode) headers['x-vertex-passcode'] = passcode;

    const res = await fetch(`/api/gemini/backup?action=restore&id=${encodeURIComponent(slotId)}`, {
      method: 'GET',
      headers
    });

    if (res.status === 401) {
      return { ok: false, locked: true, error: 'Password required to restore slot' };
    }

    if (!res.ok) {
      // Check local fallback
      const localData = localStorage.getItem(`wassap_slot_data_${slotId}`);
      if (localData) {
        return { ok: true, slotData: JSON.parse(localData) };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || 'Failed to retrieve slot' };
    }

    const data = await res.json();
    return { ok: true, slotData: data.slot };
  } catch (err: any) {
    // Check local fallback
    const localData = localStorage.getItem(`wassap_slot_data_${slotId}`);
    if (localData) {
      return { ok: true, slotData: JSON.parse(localData) };
    }
    return { ok: false, error: err.message || 'Network error retrieving slot' };
  }
}

/**
 * Deletes a backup slot.
 */
export async function deleteCloudSlot(
  slotId: string,
  passcode?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (passcode) headers['x-vertex-passcode'] = passcode;

    await fetch(`/api/gemini/backup?action=delete&id=${encodeURIComponent(slotId)}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ passcode })
    });

    // Clean up local cache
    const current = getLocalSlots();
    setLocalSlots(current.filter(s => s.id !== slotId));
    localStorage.removeItem(`wassap_slot_data_${slotId}`);

    return { ok: true };
  } catch (err: any) {
    const current = getLocalSlots();
    setLocalSlots(current.filter(s => s.id !== slotId));
    localStorage.removeItem(`wassap_slot_data_${slotId}`);
    return { ok: true };
  }
}
