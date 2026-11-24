import { Chat, Message } from '../types';
import { getMedia } from './storage';
import { createZipArchive, dataUrlToUint8Array } from './zip';

export interface ChatExportOptions {
  includeVoiceNotes?: boolean;
}

/**
 * Triggers a browser download of a Blob.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports a chat as a standalone JSON file.
 */
export function exportChatAsJson(chat: Chat): void {
  const cleanName = ((chat?.name || 'Chat')).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Chat';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${cleanName}_Chat_${timestamp}.json`;

  const exportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    chat: {
      id: chat?.id,
      name: chat?.name,
      about: chat?.about,
      role: chat?.role,
      language: chat?.language,
      speechStyle: chat?.speechStyle,
      messages: Array.isArray(chat?.messages) ? chat.messages : []
    }
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  triggerDownload(blob, filename);
}

/**
 * Exports a chat as a ZIP bundle containing chat.json and all voice note audio files.
 */
export async function exportChatAsZipBundle(chat: Chat, onProgress?: (msg: string) => void): Promise<void> {
  const cleanName = ((chat?.name || 'Chat')).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Chat';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${cleanName}_ChatBundle_${timestamp}.zip`;

  onProgress?.('Gathering chat messages and audio files...');

  const zipEntries: Array<{ name: string; data: Uint8Array | string }> = [];
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];

  // 1. Collect all voice notes
  const exportedMessages: any[] = [];
  let audioCount = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const voiceMediaId = msg.voiceMediaId || msg.voiceAttachment?.mediaId;
    const hasAudio = msg.attachment?.type === 'audio' || Boolean(voiceMediaId) || Boolean(msg.voiceAttachment?.data);

    let audioFilename: string | undefined;

    if (hasAudio) {
      let audioData = msg.voiceAttachment?.data || (msg.attachment?.type === 'audio' ? msg.attachment.data : undefined);
      if (!audioData && voiceMediaId) {
        audioData = (await getMedia(voiceMediaId)) || undefined;
      }

      if (audioData) {
        audioCount++;
        audioFilename = `audio/voice_${msg.id || i + 1}.wav`;
        try {
          const audioBytes = dataUrlToUint8Array(audioData);
          zipEntries.push({
            name: audioFilename,
            data: audioBytes
          });
        } catch (err) {
          console.warn(`Failed to process audio for message ${msg.id}:`, err);
        }
      }
    }

    exportedMessages.push({
      ...msg,
      audioFile: audioFilename
    });
  }

  onProgress?.(`Found ${audioCount} audio voice notes. Creating ZIP archive...`);

  // 2. Add chat.json
  const exportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    chat: {
      id: chat.id,
      name: chat.name,
      about: chat.about,
      role: chat.role,
      language: chat.language,
      speechStyle: chat.speechStyle,
      audioCount,
      messages: exportedMessages
    }
  };

  zipEntries.unshift({
    name: 'chat.json',
    data: JSON.stringify(exportPayload, null, 2)
  });

  const zipBytes = createZipArchive(zipEntries);
  const zipBlob = new Blob([zipBytes], { type: 'application/zip' });
  triggerDownload(zipBlob, filename);
}

/**
 * Downloads a single voice note as WAV.
 */
export function downloadVoiceNoteAudio(src: string, senderName?: string, timestamp?: string): void {
  const cleanSender = (senderName || 'VoiceNote').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const timeStr = timestamp ? timestamp.replace(/[:.]/g, '-') : Date.now();
  const filename = `${cleanSender}_${timeStr}.wav`;

  try {
    const link = document.createElement('a');
    link.href = src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to download voice note audio:', err);
  }
}
