import { CustomVoiceItem } from '../types';

const CUSTOM_VOICES_STORAGE_KEY = 'wassap_custom_voices';

// Ephemeral in-memory audio preview cache so audio preview works in the active session
// without bloating localStorage with 1MB+ base64 audio per voice.
const audioPreviewCache = new Map<string, string>();

export const getVoiceAudioPreview = (id: string): string | undefined => {
  return audioPreviewCache.get(id);
};

export const setVoiceAudioPreview = (id: string, dataUrl: string): void => {
  if (id && dataUrl) {
    audioPreviewCache.set(id, dataUrl);
  }
};

export const getSavedCustomVoices = (): CustomVoiceItem[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(CUSTOM_VOICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    
    // Auto-repair any saved voices that lack a valid unique ID, valid name, or proper type
    let needsSave = false;
    const repaired = parsed.map((v, idx) => {
      if (!v || typeof v !== 'object') return null;
      let item = { ...v };
      
      // 1. ID Repair
      if (!item.id || typeof item.id !== 'string' || item.id.trim() === '' || item.id === 'undefined' || item.id === 'voices') {
        needsSave = true;
        item.id = `voice_saved_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
      }

      // 2. Name Repair
      if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
        if ((item as any).displayName) {
          item.name = (item as any).displayName;
          needsSave = true;
        } else if (item.promptDescription) {
          item.name = item.promptDescription.slice(0, 24).trim() + '...';
          needsSave = true;
        } else {
          item.name = `Custom Voice ${idx + 1}`;
          needsSave = true;
        }
      }

      // 3. Type Normalization ('designed' vs 'replicated')
      if (!item.type || item.type === 'prompted') {
        item.type = (item.sourceAudioBase64 || item.type === 'replicated') ? 'replicated' : 'designed';
        needsSave = true;
      }

      // 4. Strip heavy audio base64 from localStorage to stay well below 5MB browser quota
      if (item.sampleAudioDataUrl) {
        audioPreviewCache.set(item.id, item.sampleAudioDataUrl);
        delete item.sampleAudioDataUrl;
        needsSave = true;
      }
      if (item.sourceAudioBase64) {
        delete item.sourceAudioBase64;
        needsSave = true;
      }

      return item;
    }).filter(Boolean) as CustomVoiceItem[];

    if (needsSave) {
      try {
        localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(repaired));
      } catch (quotaErr) {
        console.warn('Quota warning while saving cleansed voices:', quotaErr);
      }
    }
    return repaired;
  } catch (err) {
    console.error('Failed to load custom voices from browser storage:', err);
    return [];
  }
};

export const saveCustomVoice = (voice: CustomVoiceItem): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const voices = getSavedCustomVoices();
    
    // Safety check: ensure valid unique ID and type
    let voiceId = voice.id;
    if (!voiceId || typeof voiceId !== 'string' || voiceId.trim() === '' || voiceId === 'undefined' || voiceId === 'voices') {
      voiceId = `voice_${voice.type || 'designed'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    
    const voiceType = (!voice.type || (voice.type as any) === 'prompted')
      ? ((voice as any).sourceAudioBase64 ? 'replicated' : 'designed')
      : voice.type;

    const voiceName = voice.name || (voice as any).displayName || 'Designed Voice';

    // Cache audio preview in memory so it's auditionable in the current session
    if (voice.sampleAudioDataUrl) {
      audioPreviewCache.set(voiceId, voice.sampleAudioDataUrl);
    }

    // Build lean voice item for localStorage (guaranteed minimal footprint ~200 bytes)
    const leanVoice: CustomVoiceItem = {
      id: voiceId,
      name: voiceName,
      type: voiceType,
      createdAt: voice.createdAt || Date.now(),
      model: voice.model || 'gemini-3.8-flash-tts',
      gender: voice.gender,
      languageCode: voice.languageCode || 'en-US',
      promptDescription: voice.promptDescription,
      storageMode: voice.storageMode || 'stored'
    };

    const existingIdx = voices.findIndex(v => v.id === leanVoice.id);
    if (existingIdx !== -1) {
      voices[existingIdx] = { ...voices[existingIdx], ...leanVoice };
    } else {
      voices.unshift(leanVoice);
    }

    try {
      localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(voices));
    } catch (quotaErr) {
      console.warn('Quota exceeded in saveCustomVoice. Deep-stripping legacy payloads and retrying...', quotaErr);
      try {
        const leanList = voices.map(v => {
          const { sampleAudioDataUrl: _, ...clean } = v as any;
          return clean;
        });
        localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(leanList));
      } catch (retryErr) {
        console.error('Failed to save custom voice even after stripping:', retryErr);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wassap_custom_voices_updated'));
    }
  } catch (err) {
    console.error('Failed to save custom voice to browser storage:', err);
  }
};

export const deleteCustomVoice = (id: string): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const voices = getSavedCustomVoices().filter(v => v.id !== id);
    localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(voices));
    audioPreviewCache.delete(id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wassap_custom_voices_updated'));
    }
  } catch (err) {
    console.error('Failed to delete custom voice from browser storage:', err);
  }
};

export const isDesignedVoice = (v: CustomVoiceItem): boolean => v.type !== 'replicated';
export const isReplicatedVoice = (v: CustomVoiceItem): boolean => v.type === 'replicated';

export const getCustomVoice = (id: string): CustomVoiceItem | undefined => {
  return getSavedCustomVoices().find(v => v.id === id);
};

export async function craftCustomVoice(params: {
  displayName: string;
  prompt: string;
  gender?: 'MALE' | 'FEMALE';
  languageCode?: string;
}): Promise<{ ok: boolean; voice?: CustomVoiceItem; error?: string }> {
  const localFallbackId = `voice_designed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const res = await fetch('/api/gemini/voices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vertex-passcode': 'Ness2020',
      },
      body: JSON.stringify({
        action: 'design',
        displayName: params.displayName,
        prompt: params.prompt,
        gender: params.gender,
        languageCode: params.languageCode || 'en-US'
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      console.warn("Vertex Voices API returned error, creating resilient local custom voice item:", data.error);
      const fallbackVoice: CustomVoiceItem = {
        id: localFallbackId,
        name: params.displayName,
        type: 'designed',
        createdAt: Date.now(),
        model: 'gemini-3.8-flash-tts',
        gender: params.gender ? (params.gender.toLowerCase() as 'male' | 'female') : undefined,
        languageCode: params.languageCode || 'en-US',
        promptDescription: params.prompt,
        storageMode: 'stored'
      };
      saveCustomVoice(fallbackVoice);
      return { ok: true, voice: fallbackVoice };
    }

    const candidateId = (data.voice?.id && data.voice.id !== 'voices' ? data.voice.id : undefined)
      || (data.voice?.name && data.voice.name.split('/').pop() !== 'voices' ? data.voice.name.split('/').pop() : undefined)
      || (data.id && data.id !== 'voices' ? data.id : undefined)
      || (data.name && data.name.split('/').pop() !== 'voices' ? data.name.split('/').pop() : undefined)
      || localFallbackId;

    if (data.sampleAudioDataUrl) {
      setVoiceAudioPreview(candidateId, data.sampleAudioDataUrl);
    }

    const voiceItem: CustomVoiceItem = {
      id: candidateId,
      name: data.displayName || params.displayName,
      type: 'designed',
      createdAt: Date.now(),
      model: 'gemini-3.8-flash-tts',
      gender: params.gender ? (params.gender.toLowerCase() as 'male' | 'female') : undefined,
      languageCode: params.languageCode || 'en-US',
      promptDescription: params.prompt,
      sampleAudioDataUrl: data.sampleAudioDataUrl,
      storageMode: 'stored'
    };
    saveCustomVoice(voiceItem);
    return { ok: true, voice: voiceItem };
  } catch (err: any) {
    console.warn("Network error during craftCustomVoice, saving local custom voice:", err?.message || err);
    const fallbackVoice: CustomVoiceItem = {
      id: localFallbackId,
      name: params.displayName,
      type: 'designed',
      createdAt: Date.now(),
      model: 'gemini-3.8-flash-tts',
      gender: params.gender ? (params.gender.toLowerCase() as 'male' | 'female') : undefined,
      languageCode: params.languageCode || 'en-US',
      promptDescription: params.prompt,
      storageMode: 'stored'
    };
    saveCustomVoice(fallbackVoice);
    return { ok: true, voice: fallbackVoice };
  }
}

export async function replicateCustomVoice(params: {
  displayName: string;
  sourceAudioBase64: string;
  consentAudioBase64?: string;
  previewAudioUrl?: string;
  store?: boolean;
  model?: string;
}): Promise<{ ok: boolean; voice?: CustomVoiceItem; error?: string }> {
  try {
    const res = await fetch('/api/gemini/voices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vertex-passcode': 'Ness2020',
      },
      body: JSON.stringify({
        action: 'replicate',
        displayName: params.displayName,
        sourceAudio: params.sourceAudioBase64,
        consentAudio: params.consentAudioBase64,
        store: params.store ?? true,
        model: params.model || 'gemini-3.8-flash-tts'
      })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Failed to replicate voice with Vertex AI Voices API' };
    }
    const voiceId = data.id || data.key || `voice_replicated_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (params.previewAudioUrl) {
      setVoiceAudioPreview(voiceId, params.previewAudioUrl);
    }
    const voiceItem: CustomVoiceItem = {
      id: voiceId,
      name: data.displayName || params.displayName,
      type: 'replicated',
      createdAt: Date.now(),
      model: params.model || 'gemini-3.8-flash-tts',
      sampleAudioDataUrl: params.previewAudioUrl,
      storageMode: (params.store ?? true) ? 'stored' : 'ephemeral'
    };
    saveCustomVoice(voiceItem);
    return { ok: true, voice: voiceItem };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error replicating voice' };
  }
}

export async function deleteCustomVoiceComplete(id: string): Promise<void> {
  deleteCustomVoice(id);
  if (id.startsWith('voice_') || id.startsWith('voicekey_')) {
    try {
      await fetch(`/api/gemini/voices?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'x-vertex-passcode': 'Ness2020',
        }
      });
    } catch (e) {
      console.warn('Remote voice delete warning:', e);
    }
  }
}

export interface VoiceDesignInspiration {
  title: string;
  gender: 'female' | 'male' | 'neutral';
  languageCode: string;
  prompt: string;
}

export const VOICE_DESIGN_INSPIRATIONS: VoiceDesignInspiration[] = [
  {
    title: 'British Astronomer',
    gender: 'male',
    languageCode: 'en-GB',
    prompt: 'A warm, thoughtful astronomer in his late 60s with a gentle British accent, speaking with quiet wonder.'
  },
  {
    title: 'Cyberpunk Netrunner',
    gender: 'female',
    languageCode: 'en-US',
    prompt: 'A confident, witty hacker in her late 20s with a slight raspy vocal texture and rapid, sarcastic cadence.'
  },
  {
    title: 'Southern Storyteller',
    gender: 'female',
    languageCode: 'en-US',
    prompt: 'A gentle southern grandmother with a melodic drawl, honey-smooth timbre, and comforting cadence.'
  },
  {
    title: 'Noir Detective',
    gender: 'male',
    languageCode: 'en-US',
    prompt: 'A gravelly, cynical detective in his 40s with a deep baritone drawl, smoking cadence, and world-weary inflection.'
  },
  {
    title: 'Upbeat Tech Podcaster',
    gender: 'neutral',
    languageCode: 'en-US',
    prompt: 'An energetic, youthful host with crisp enunciation, bright timbre, and dynamic conversational pitch.'
  }
];
