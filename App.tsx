import { notificationConversation } from './utils/notificationText';
import { reactionContext, isSingleEmoji } from './utils/reactions';
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatList } from './components/ChatList';
import { ChatWallpaper } from './components/ChatWallpaper';
import { ChatWindow } from './components/ChatWindow';
import { MessageInput } from './components/MessageInput';
import { MobileNavigation } from './components/MobileNavigation';
import { CallOverlay } from './components/CallOverlay';
import { PersonaCall, generateCallSummary } from './services/liveCall';
import { getCalls, saveCall, deleteCall, shouldSummarizeCall, formatCallDuration, callHistoryText, type CallRecord } from './utils/calls';

// Lazy-loaded secondary panels to optimize initial bundle size & load performance
const ProfilePanel = React.lazy(() => import('./components/ProfilePanel').then(m => ({ default: m.ProfilePanel })));
const SettingsPopover = React.lazy(() => import('./components/SettingsPopover').then(m => ({ default: m.SettingsPopover })));
const GuidePanel = React.lazy(() => import('./components/GuidePanel').then(m => ({ default: m.GuidePanel })));
const UpdatesPanel = React.lazy(() => import('./components/UpdatesPanel').then(m => ({ default: m.UpdatesPanel })));
const NewChatPanel = React.lazy(() => import('./components/NewChatPanel').then(m => ({ default: m.NewChatPanel })));
const NewGroupPanel = React.lazy(() => import('./components/NewGroupPanel').then(m => ({ default: m.NewGroupPanel })));
const UserProfilePanel = React.lazy(() => import('./components/UserProfilePanel').then(m => ({ default: m.UserProfilePanel })));
const CalendarNotesWidget = React.lazy(() => import('./components/CalendarNotesWidget').then(m => ({ default: m.CalendarNotesWidget })));

const PanelLoadingFallback: React.FC = () => (
  <div className="fixed top-0 left-0 right-0 z-[5000] h-[3px] bg-[#21c063]/20 overflow-hidden pointer-events-none">
    <div className="h-full bg-[#21c063] w-1/2 rounded-full animate-pulse" />
  </div>
);
import { INITIAL_CHATS, normalizeTextModel, normalizeLiveModel, DEFAULT_LIVE_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VOICE_MODEL, GEMINI_TTS_VOICE_DETAILS } from './constants';
import { Chat, Message, UserProfile, AppSettings, FileAttachment, MemoryBubble, MessageStatus, PersonaVoiceSettings } from './types';
import { 
  getGeminiResponse, 
  generateGeminiVoiceNote, 
  synthesizeImageContextAndCaption, 
  generatePersonaImage, 
  resolveAvatarBase64,
  buildFullPersonaSystemPrompt, buildPersonaPrompt,
  isRawErrorMessage,
  getInCharacterNetworkGlitchExcuse
} from './services/geminiService';
import { formatDateRangeLabel, getLocalDateKey, getTimeGapAndFrequencyContext, getAppNow, getAppDateKey, getAppFormattedTime, getAppTimeContext, resolveChatMessagesDates } from './utils/dates';
import { cleanSpokenTranscript } from './utils/audio';
import { 
  saveMedia, 
  getMedia, 
  deleteMedia 
} from './utils/storage';
import { 
  beginPendingAttempt, retryExpired, pendingDeliveryTurn, deliveryHistory, setPendingDeliveryStatus,
  getPendingMessages, 
  removePendingMessage, 
  enqueuePendingMessage, 
  getBackgroundExchanges, 
  clearBackgroundExchanges,
  clearOfflineDataForChat,
  recordBackgroundMarkAsRead
} from './utils/offlineQueue';
import { MobileActionFAB } from './components/MobileActionFAB';

// Helper to determine if a persona should reply with a voice note
const shouldReplyWithVoiceNote = (
  voiceSettings?: PersonaVoiceSettings,
  userSentVoiceNote = false
): boolean => {
  if (!voiceSettings) return false;
  const frequency = voiceSettings.frequency || 'off';
  if (frequency === 'off') return false;

  const voiceForVoice = voiceSettings.voiceForVoice ?? true;
  if (userSentVoiceNote && voiceForVoice) {
    return true;
  }

  if (frequency === 'always') return true;
  if (frequency === 'frequent') return Math.random() < 0.3;
  if (frequency === 'occasional') return Math.random() < 0.1;
  return false;
};

// Module-level pointer to active settings, chats, and user profile to ensure global consistency across time formatting and notification payloads
let globalActiveSettings: AppSettings | undefined = undefined;
let globalActiveUser: UserProfile | undefined = undefined;
let globalActiveChats: Chat[] = [];
const getFormattedTime = () => getAppFormattedTime(globalActiveSettings);
const getDateKey = () => getAppDateKey(globalActiveSettings);

const buildNotificationPersonaData = (chat: Chat, overrideUser?: UserProfile, overrideSettings?: AppSettings, overrideChats?: Chat[]) => {
  const currentSettings = overrideSettings || globalActiveSettings;
  const currentUser = overrideUser || globalActiveUser;
  const currentChats = overrideChats || globalActiveChats;
  const clientTimeContext = getAppTimeContext(currentSettings);
  const timeGapContext = getTimeGapAndFrequencyContext(chat.messages || [], false, currentSettings, chat.timeAwarenessEnabled !== false) || '';

  const recentMessages = (chat.messages || []).filter(m => !m.isDeleted).slice(-45).map(m => ({
    id: m.id,
    text: m.text,
    sender: m.sender,
    senderName: m.senderName || (m.sender === 'me' ? (currentUser?.name || 'You') : chat.name),
    timestamp: m.timestamp,
    timestampEpoch: m.timestampEpoch,
    date: m.date,
    isEvent: (m as any).isEvent,
    eventTitle: (m as any).eventTitle,
    reactions: m.reactions
  }));

  const groupContext = chat.isGroup ? {
    groupName: chat.name,
    otherMembers: (chat.memberIds || []).filter(id => id !== chat.id).map(id => currentChats.find(c => c.id === id)?.name || id)
  } : undefined;

  const fullSystemPrompt = buildFullPersonaSystemPrompt(
    chat,
    recentMessages,
    currentUser,
    groupContext,
    currentSettings,
    timeGapContext,
    clientTimeContext
  );

  return {
    chatId: chat.id,
    chatName: chat.name,
    chatAvatar: chat.avatar,
    isGroup: !!chat.isGroup,
    instruction: chat.systemInstruction,
    role: chat.role,
    speechStyle: chat.speechStyle,
    language: chat.language,
    about: chat.about,
    humaneSettings: chat.humaneSettings,
    voiceSettings: chat.voiceSettings,
    timeAwarenessEnabled: chat.timeAwarenessEnabled !== false,
    model: normalizeTextModel(currentSettings?.selectedModel),
    provider: currentSettings?.aiProvider || 'vertex',
    customApiKey: currentSettings?.apiKey,
    enableTextStacking: currentSettings?.enableTextStacking !== false,
    textStackingDelay: currentSettings?.textStackingDelay || 10,
    clientTimeContext,
    shareTimeContext: currentSettings?.shareTimeContext !== false,
    shareCalendarNotes: !!currentSettings?.shareCalendarNotes,
    calendarNotes: currentSettings?.calendarNotes || '',
    useSearchGrounding: !!currentSettings?.useSearchGrounding,
    timeGapContext,
    groupContext,
    fullSystemPrompt,
    systemRules: buildPersonaPrompt(chat, [], currentUser, groupContext, { ...currentSettings, shareTimeContext: false }).systemInstruction,
    customTimeOffsetMs: currentSettings?.timeMode === 'custom' ? currentSettings.customTimeOffsetMs : 0,
    userName: currentUser?.name || 'You',
    userAbout: currentUser?.about || '',
    userStatus: currentUser?.status || 'Online',
    userProfile: {
      name: currentUser?.name || 'You',
      about: currentUser?.about || '',
      status: currentUser?.status || 'Online'
    },
    settings: {
      selectedModel: normalizeTextModel(currentSettings?.selectedModel),
      useSearchGrounding: currentSettings?.useSearchGrounding,
      shareTimeContext: currentSettings?.shareTimeContext !== false,
      shareCalendarNotes: currentSettings?.shareCalendarNotes,
      calendarNotes: currentSettings?.calendarNotes,
      clientTimeContext
    },
    recentMessages
  };
};

let handleNotificationChatSelectGlobal: ((id: string) => void) | null = null;

const avatarCache = new Map<string, string>();

// Helper to format rich reply context for AI prompts
const formatQuotedReplyContext = (replyTo: Message, fallbackAuthorName?: string): string => {
  const author = replyTo.sender === 'me' ? 'You' : (replyTo.senderName || fallbackAuthorName || 'Contact');
  const isImage = replyTo.attachment?.type === 'image' || !!replyTo.image;
  const isAudio = replyTo.attachment?.type === 'audio';

  if (isImage) {
    const caption = replyTo.text ? `: "${replyTo.text}"` : '';
    return `[Replying to ${author}'s photo${caption}] `;
  }
  if (isAudio) {
    const transcript = replyTo.text ? ` (transcript: "${replyTo.text}")` : '';
    return `[Replying to ${author}'s voice note${transcript}] `;
  }
  return `[Replying to ${author}: "${replyTo.text || ''}"] `;
};

// Canvas helper to guarantee 1:1 square cropped notification icons with zero stretching across all OS notification shades
const getSquareNotificationIcon = async (url?: string): Promise<string> => {
  const fallback = '/favicon.svg';
  if (!url || typeof window === 'undefined') return fallback;
  if (avatarCache.has(url)) return avatarCache.get(url)!;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 192;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(url);
          return;
        }

        // Center-crop (aspect-fill cover) into a 1:1 square canvas
        const scale = Math.max(size / img.width, size / img.height);
        const nw = img.width * scale;
        const nh = img.height * scale;
        const dx = (size - nw) / 2;
        const dy = (size - nh) / 2;

        ctx.fillStyle = '#00a884';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, dx, dy, nw, nh);

        const dataUrl = canvas.toDataURL('image/png');
        avatarCache.set(url, dataUrl);
        resolve(dataUrl);
      } catch (e) {
        resolve(url);
      }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
};

// Robust Native OS Notification Helper for System Tray & Notification Shade
const notificationRevisions = new Map<string, number>();
const showNotification = async (title: string, options: NotificationOptions & { silentUpdate?: boolean }) => {
  if (!('Notification' in window)) return;
  const tag = options.tag || title;
  const revision = (notificationRevisions.get(tag) || 0) + 1;
  notificationRevisions.set(tag, revision);

  if (Notification.permission === 'default') {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    } catch (e) {
      console.warn("Permission request failed", e);
      return;
    }
  }

  if (Notification.permission !== 'granted') return;

  const isSilent = !!options.silentUpdate;
  const avatar = options.icon || options.data?.chatAvatar;
  const squareIcon = avatar ? await getSquareNotificationIcon(avatar as string) : '/favicon.svg';

  const notificationOptions: any = {
    ...options,
    body: options.body,
    icon: squareIcon,
    data: { ...options.data, chatAvatar: squareIcon },
    badge: options.badge || '/badge.svg',
    renotify: !isSilent,
    silent: isSilent,
    vibrate: isSilent ? undefined : [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message...' },
      { action: 'read', title: 'Mark as read' }
    ]
  };

  // 1. Service Worker Notification (Preferred for Android notification shade with action buttons)
  try {
    if ('serviceWorker' in navigator) {
      const regPromise = navigator.serviceWorker.ready;
      const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 1000));
      const reg = await Promise.race([regPromise, timeoutPromise]);
      // A slow avatar/worker lookup must not replace a newer, more complete reply.
      if (notificationRevisions.get(tag) !== revision) return;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);
        return;
      }
    }
  } catch (e) {
    console.warn("SW notification failed, falling back to standard Notification", e);
  }

  // 2. Direct Native OS Desktop Notification Fallback
  if (notificationRevisions.get(tag) !== revision) return;
  try {
    const n = new Notification(title, notificationOptions);
    n.onclick = () => {
      window.focus();
      n.close();
      const targetId = (notificationOptions.data && notificationOptions.data.chatId) || notificationOptions.tag;
      if (targetId && typeof handleNotificationChatSelectGlobal === 'function') {
        handleNotificationChatSelectGlobal(targetId);
      }
    };
    setTimeout(() => n.close(), 10000);
  } catch (e) {
    console.warn("Standard Notification API failed", e);
  }
};




let audioBufferCache: AudioBuffer | null = null;
let incomingAudioBufferCache: AudioBuffer | null = null;
let sentAudioBufferCache: AudioBuffer | null = null;
let audioContextInstance: AudioContext | null = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioContextInstance) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioContextInstance = new AudioContextClass();
    }
  }
  return audioContextInstance;
};

const preloadAudioBuffers = async () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // 1. Preload incoming message sound (/whatapp.wav)
    fetch('/whatapp.wav', { cache: 'no-cache' })
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => ctx.decodeAudioData(arrayBuffer))
      .then(buffer => {
        audioBufferCache = buffer;
        incomingAudioBufferCache = buffer;
      })
      .catch(e => console.warn("Incoming audio buffer preload fallback:", e));

    // 2. Preload sent message pop sound (/msgsentpop.mp3)
    fetch('/msgsentpop.mp3', { cache: 'no-cache' })
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => ctx.decodeAudioData(arrayBuffer))
      .then(buffer => {
        sentAudioBufferCache = buffer;
      })
      .catch(e => console.warn("Sent audio buffer preload fallback:", e));
  } catch (e) {
    console.warn("Audio buffer preload fallback:", e);
  }
};

if (typeof window !== 'undefined') {
  preloadAudioBuffers();
  const unlockCtx = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    window.removeEventListener('click', unlockCtx);
    window.removeEventListener('keydown', unlockCtx);
    window.removeEventListener('touchstart', unlockCtx);
  };
  window.addEventListener('click', unlockCtx);
  window.addEventListener('keydown', unlockCtx);
  window.addEventListener('touchstart', unlockCtx);
}

const playIncomingMessageSound = () => {
  if (typeof document !== 'undefined' && document.hidden) return; // Only play sound when actively in the app!

  // 1. Primary: Web Audio API (instant 0ms, bypasses browser element locks, mixes simultaneously)
  try {
    const ctx = getAudioContext();
    const buffer = incomingAudioBufferCache || audioBufferCache;
    if (ctx && buffer) {
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      return;
    }
  } catch (e) {
    console.warn("Web Audio API play failed, falling back to HTML5 Audio", e);
  }

  // 2. Fallback: HTML5 Audio
  try {
    const audio = new Audio('/whatapp.wav');
    audio.volume = 1;
    audio.play().catch(e => console.warn("HTML5 Audio play failed:", e));
  } catch (e) {
    console.warn("Failed to play notification sound", e);
  }
};

const playSentMessageSound = () => {
  if (typeof document !== 'undefined' && document.hidden) return; // Only play sound when actively in the app!

  // 1. Primary: Web Audio API (instant 0ms, zero latency, mixes simultaneously)
  try {
    const ctx = getAudioContext();
    if (ctx && sentAudioBufferCache) {
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const source = ctx.createBufferSource();
      source.buffer = sentAudioBufferCache;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.85;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    }
  } catch (e) {
    console.warn("Web Audio API sent sound play failed, falling back to HTML5 Audio", e);
  }

  // 2. Fallback: HTML5 Audio
  try {
    const audio = new Audio('/msgsentpop.mp3');
    audio.volume = 0.85;
    audio.play().catch(e => console.warn("HTML5 Audio sent sound play failed:", e));
  } catch (e) {
    console.warn("Failed to play sent message sound", e);
  }
};




const fragmentTypingDelay = (text: string) => 2350 + Math.min(1250, text.length * 12) + Math.random() * 150;

// Utility to split AI responses into human-like chunks
const splitMessage = (text: string): string[] => {
  if (!text) return [];

  const codeBlocks: string[] = [];
  const placeholderPrefix = "__CODE_BLOCK_";
  
  // 1. Extract code blocks
  let processedText = text.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `${placeholderPrefix}${codeBlocks.length}__`;
    codeBlocks.push(match);
    return `\n\n${placeholder}\n\n`;
  });

  const rawChunks = processedText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const finalChunks: string[] = [];

  for (const rawChunk of rawChunks) {
    if (rawChunk.startsWith(placeholderPrefix)) {
      const match = rawChunk.match(/__CODE_BLOCK_(\d+)__/);
      if (match) {
        finalChunks.push(codeBlocks[parseInt(match[1], 10)]);
      }
      continue;
    }

    const words = rawChunk.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    if (wordCount === 0) continue;

    let targetChunksCount = 1;
    if (wordCount <= 8) {
      targetChunksCount = 1;
    } else if (wordCount <= 20) {
      targetChunksCount = 2;
    } else if (wordCount <= 29) {
      targetChunksCount = 3;
    } else {
      targetChunksCount = Math.random() > 0.5 ? 4 : 5; // 4-5 randomly for > 29 words
    }

    if (targetChunksCount === 1) {
      finalChunks.push(rawChunk);
    } else {
      let currentSegment: string[] = [];
      const segmentList: string[] = [];
      
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        currentSegment.push(w);
        
        // Avoid splitting on decimals (e.g. 3.14) or abbreviations (e.g. etc., dr., vs.)
        const isDecimalOrAbbr = /\d+\.\d+$/.test(w) || /^(mr|mrs|dr|ms|prof|sr|jr|vs|etc|eg|ie)\.$/i.test(w);
        const isPunctuationEnd = !isDecimalOrAbbr && (
          /[.!?,\;:\-~—–]+["'”’\)\]*_~]*$/.test(w) ||
          w.endsWith("...")
        );
        const hasTrailingEmoji = !isDecimalOrAbbr && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]$/u.test(w);
        
        const nextW = words[i+1] ? words[i+1].toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '') : "";
        const isNextConjunction = ["and", "but", "so", "because", "then", "or", "though", "plus", "also", "meanwhile", "anyway"].includes(nextW);
        const shouldSplitConjunction = isNextConjunction && currentSegment.length >= 2;
        
        if (isPunctuationEnd || hasTrailingEmoji || shouldSplitConjunction) {
          segmentList.push(currentSegment.join(' '));
          currentSegment = [];
        }
      }
      if (currentSegment.length > 0) {
        segmentList.push(currentSegment.join(' '));
      }

      let localChunks: string[] = [];
      if (segmentList.length >= targetChunksCount) {
        const idealWordsPerChunk = Math.ceil(wordCount / targetChunksCount);
        let currentChunk = "";
        let currentWordCount = 0;
        
        for (let i = 0; i < segmentList.length; i++) {
          const seg = segmentList[i];
          const segWords = seg.split(/\s+/).length;
          
          if (currentChunk.length === 0) {
            currentChunk = seg;
            currentWordCount = segWords;
          } else {
            const chunksLeft = targetChunksCount - localChunks.length;
            const segmentsLeft = segmentList.length - i;
            
            if (segmentsLeft === chunksLeft - 1) {
              localChunks.push(currentChunk);
              currentChunk = seg;
              currentWordCount = segWords;
            } else if (currentWordCount >= idealWordsPerChunk) {
              localChunks.push(currentChunk);
              currentChunk = seg;
              currentWordCount = segWords;
            } else {
              currentChunk += " " + seg;
              currentWordCount += segWords;
            }
          }
        }
        if (currentChunk) localChunks.push(currentChunk);
        
        while (localChunks.length > targetChunksCount) {
           const last = localChunks.pop();
           if (last !== undefined) {
             localChunks[localChunks.length - 1] += " " + last;
           }
        }
      } else {
        const wordsPerChunk = Math.ceil(wordCount / targetChunksCount);
        let currChunk: string[] = [];
        
        for (let i = 0; i < words.length; i++) {
          currChunk.push(words[i]);
          if (currChunk.length >= wordsPerChunk && localChunks.length < targetChunksCount - 1) {
            localChunks.push(currChunk.join(' '));
            currChunk = [];
          }
        }
        if (currChunk.length > 0) {
          localChunks.push(currChunk.join(' '));
        }
      }
      
      finalChunks.push(...localChunks.filter(c => c.trim().length > 0));
    }
  }

  if (finalChunks.length > 0) {
    const totalWords = finalChunks.join(' ').split(/\s+/).filter(Boolean).length;
    let maxAllowed = 7;
    if (totalWords <= 30) maxAllowed = 4;
    else if (totalWords <= 60) maxAllowed = 5;
    else if (totalWords <= 100) maxAllowed = 6;
    else maxAllowed = 7;

    while (finalChunks.length > maxAllowed) {
      let minLen = Infinity;
      let mergeIdx = 0;
      for (let i = 0; i < finalChunks.length - 1; i++) {
        const combined = finalChunks[i].length + finalChunks[i+1].length;
        if (combined < minLen) {
          minLen = combined;
          mergeIdx = i;
        }
      }
      finalChunks.splice(mergeIdx, 2, finalChunks[mergeIdx] + ' ' + finalChunks[mergeIdx+1]);
    }
    return finalChunks;
  }

  return [text];
};

const convertTo24Hour = (timeStr: string) => {
  if (!timeStr) return timeStr;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return timeStr;
  let [_, hr, min, period] = match;
  let hrNum = parseInt(hr, 10);
  if (period.toLowerCase() === 'pm' && hrNum < 12) hrNum += 12;
  if (period.toLowerCase() === 'am' && hrNum === 12) hrNum = 0;
  return `${String(hrNum).padStart(2, '0')}:${min}`;
};

const getPersonaDefaultVoice = (chat: Partial<Chat>): string => {
  if (chat.voiceSettings?.voiceName) return chat.voiceSettings.voiceName;
  const idMap: Record<string, string> = {
    '1': 'Puck',     // Big Bro
    '2': 'Leda',     // Mom
    '3': 'Zephyr',   // Sis
    '4': 'Aoede',    // My girl
    '5': 'Charon',   // Tom
    '6': 'Achernar', // Meta AI
  };
  if (chat.id && idMap[chat.id]) return idMap[chat.id];
  const combined = `${chat.role || ''} ${chat.name || ''}`.toLowerCase();
  if (combined.includes('brother') || combined.includes('bro') || combined.includes('father') || combined.includes('dad') || combined.includes('boy') || combined.includes('man') || combined.includes('guy')) {
    return 'Puck';
  }
  return 'Aoede';
};

const App: React.FC = () => {
  const callRef = React.useRef<PersonaCall | null>(null);
  const [callSession, setCallSession] = useState<PersonaCall | null>(null);
  const pendingCallDiaries = React.useRef(new Set<string>());
  const diaryControllers = React.useRef(new Map<string, AbortController>());
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('whatsapp_chats');
    if (saved) {
      try {
        const parsedChats = JSON.parse(saved);
        if (Array.isArray(parsedChats) && parsedChats.length > 0) {
          return parsedChats.map(chat => {
            const defaultVoice = getPersonaDefaultVoice(chat);
            const voiceSettings = chat.voiceSettings ? {
              ...chat.voiceSettings,
              voiceName: chat.voiceSettings.voiceName || defaultVoice
            } : {
              voiceName: defaultVoice,
              frequency: 'off' as const,
              voiceForVoice: true
            };

            const rawMappedMessages = (Array.isArray(chat?.messages) ? chat.messages : []).map(msg => {
              const cleanMsg = {
                ...msg,
                senderName: msg.senderName || (msg.sender === 'me' ? 'You' : (!chat.isGroup ? chat.name : undefined)),
                timestamp: convertTo24Hour(msg?.timestamp || '')
              };
              if (cleanMsg.replyToMessage && !cleanMsg.replyToMessage.senderName) {
                cleanMsg.replyToMessage = {
                  ...cleanMsg.replyToMessage,
                  senderName: cleanMsg.replyToMessage.sender === 'me' ? 'You' : (!chat.isGroup ? chat.name : undefined)
                };
              }
              // Auto-heal legacy raw error bubbles that were saved from transient rate limits/glitches
              if (isRawErrorMessage(cleanMsg.text)) {
                cleanMsg.text = getInCharacterNetworkGlitchExcuse(chat);
              }
              // Only strip an inline copy when the message already has IndexedDB media storage.
              if (cleanMsg.mediaId && cleanMsg.image && cleanMsg.image.length > 500) {
                delete (cleanMsg as any).image;
              }
              return cleanMsg;
            });

            // Dynamically resolve & heal non-regressive monotonic dates for all messages
            let healedMessages = rawMappedMessages;
            try {
              healedMessages = resolveChatMessagesDates(rawMappedMessages, globalActiveSettings);
            } catch (err) {
              console.warn("Date healing fallback for chat:", chat.id, err);
            }

            let healedLastMessage = chat.lastMessage;
            if (isRawErrorMessage(healedLastMessage)) {
              healedLastMessage = healedMessages[healedMessages.length - 1]?.text || "Hey!";
            }

            return {
              ...chat,
              voiceSettings,
              lastMessage: healedLastMessage,
              lastMessageTime: convertTo24Hour(chat?.lastMessageTime || ''),
              messages: healedMessages
            };
          });
        }
      } catch (e) {
        console.error("Failed to parse chats safely", e);
      }
    }
    return INITIAL_CHATS.map(chat => {
      const msgs = (chat.messages || []).map(msg => ({
        ...msg,
        senderName: msg.senderName || (msg.sender === 'me' ? 'You' : (!chat.isGroup ? chat.name : undefined))
      }));
      try {
        return {
          ...chat,
          messages: resolveChatMessagesDates(msgs, globalActiveSettings)
        };
      } catch {
        return { ...chat, messages: msgs };
      }
    });
  });

  const getInitialChatId = (): string => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('chatId') || '';
    } catch {
      return '';
    }
  };

  const initialChatId = getInitialChatId();
  const [activeChatId, setActiveChatId] = useState<string>(initialChatId);
  const [activeView, setActiveView] = useState<'list' | 'chat'>(initialChatId ? 'chat' : 'list');
  const handleChatSelectRef = React.useRef<(id: string) => void>(() => {});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [profileClosing, setProfileClosing] = useState(false);
  const profileCloseTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeProfilePanel = React.useCallback(() => {
    if (!isMobile || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShowProfilePanel(false); return; }
    setProfileClosing(true);
    clearTimeout(profileCloseTimer.current);
    profileCloseTimer.current = setTimeout(() => { setShowProfilePanel(false); setProfileClosing(false); }, 220);
  }, [isMobile]);
  useEffect(() => {
    if (!showProfilePanel) setProfileClosing(false);
    return () => clearTimeout(profileCloseTimer.current);
  }, [showProfilePanel]);
  const [showNewChatPanel, setShowNewChatPanel] = useState(false);
  const [showNewGroupPanel, setShowNewGroupPanel] = useState(false);
  const [showUserProfilePanel, setShowUserProfilePanel] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showCalendarWidget, setShowCalendarWidget] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const closingPanelHistoryRef = React.useRef(false);
  const mobilePanelOpen = isMobile && (showSettingsPopover || showNewChatPanel || showNewGroupPanel || showUserProfilePanel || showCalendarWidget || showProfilePanel || showGuide || showUpdates);

  useEffect(() => {
    if (!mobilePanelOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    let panel: HTMLElement | undefined;
    const focusPanel = () => {
      const next = Array.from(document.querySelectorAll<HTMLElement>('[data-app-panel]'))
        .filter(element => element.getClientRects().length)
        .sort((a, b) => (Number(getComputedStyle(b).zIndex) || 0) - (Number(getComputedStyle(a).zIndex) || 0))[0];
      if (!next || next === panel) return;
      panel = next;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', panel.dataset.appPanel || 'Panel');
      panel.tabIndex = -1;
      (panel.querySelector<HTMLElement>('[data-panel-close]') || panel).focus({ preventScroll: true });
    };
    const handleKey = (event: KeyboardEvent) => {
      if (!panel || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        panel.querySelector<HTMLButtonElement>('[data-panel-close]')?.click();
      } else if (event.key === 'Tab') {
        const targets = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length);
        const first = targets[0], last = targets[targets.length - 1];
        if (!first) { event.preventDefault(); panel.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    // Lazy panels may mount after the effect; focus only when the top panel changes.
    const observer = new MutationObserver(focusPanel);
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
    focusPanel();
    window.addEventListener('keydown', handleKey);
    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', handleKey);
      if (panel?.isConnected) {
        panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); panel.removeAttribute('aria-label'); panel.removeAttribute('tabindex');
      }
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
    };
  }, [mobilePanelOpen, showSettingsPopover, showNewChatPanel, showNewGroupPanel, showUserProfilePanel, showCalendarWidget, showProfilePanel, showGuide, showUpdates]);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const chatsRef = React.useRef<Chat[]>(chats);
  const handledTriggersRef = React.useRef<Set<string>>(new Set());
  const activeNotificationSoundChatsRef = React.useRef<Set<string>>(new Set());
  const aiResponseTimeoutsRef = React.useRef<Record<string, number>>({});
  const aiRespondingChatsRef = React.useRef<Set<string>>(new Set());
  const pendingTimeGapsRef = React.useRef<Record<string, string | undefined>>({});
  const pendingReactionContextsRef = React.useRef<Record<string, string | undefined>>({});
  const leftOnReadTimeoutsRef = React.useRef<Record<string, number>>({});
  const handleAutomationTriggerRef = React.useRef<((chatId: string, context: string, triggerId?: string, type?: 'normal' | 'catchup' | 'inactivity', forceNotification?: boolean) => Promise<void>) | null>(null);
  const personaOnlineTimersRef = React.useRef<Record<string, number>>({});
  const personaDeliveryTimersRef = React.useRef<Record<string, number>>({});
  const personaComingOnlineTimersRef = React.useRef<Record<string, number>>({});
  const personaStatusWatchdogTimersRef = React.useRef<Record<string, number>>({});
  const personaAbortControllersRef = React.useRef<Record<string, AbortController>>({});
  const personaTurnTokensRef = React.useRef<Record<string, number>>({});
  useEffect(() => { chatsRef.current = chats; globalActiveChats = chats; }, [chats]);

  const sendNotificationWithChimeRule = (chatId: string, title: string, avatar: string, bodyText: string, extraData?: any) => {
    const isFirstInChain = !activeNotificationSoundChatsRef.current.has(chatId);
    
    if (isFirstInChain) {
      playIncomingMessageSound();
      activeNotificationSoundChatsRef.current.add(chatId);
    }

    const targetChat = chatsRef.current.find(c => c.id === chatId);
    const personaData = extraData || (targetChat ? buildNotificationPersonaData(targetChat, userRef.current, settingsRef.current) : undefined);

    showNotification(title, {
      body: bodyText,
      icon: avatar,
      tag: chatId,
      silentUpdate: !isFirstInChain,
      data: personaData
    });
  };

  const handleMarkAsRead = React.useCallback((chatId: string, messageIds?: string[], fromNotification = false) => {
    activeNotificationSoundChatsRef.current.delete(chatId);
    recordBackgroundMarkAsRead(chatId);

    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        const shouldMarkAll = !messageIds || messageIds.length === 0;
        const idsSet = messageIds ? new Set(messageIds) : null;

        let changed = false;
        const updatedMsgs = c.messages.map(m => {
          if ((shouldMarkAll || idsSet?.has(m.id)) && m.status !== 'read' && !(m.sender === 'me' && (m.status === 'failed' || m.status === 'pending'))) {
            changed = true;
            return { ...m, status: 'read' as MessageStatus };
          }
          return m;
        });

        return {
          ...c,
          unreadCount: 0,
          messages: changed ? updatedMsgs : c.messages
        };
      }
      return c;
    }));

    // Clear any pending left-on-read reaction timer for this chat
    if (leftOnReadTimeoutsRef.current[chatId]) {
      clearTimeout(leftOnReadTimeoutsRef.current[chatId]);
      delete leftOnReadTimeoutsRef.current[chatId];
    }

    // Schedule Left-on-Read reaction after a natural hesitation (6.5 to 10s)
    const targetChat = chatsRef.current.find(c => c.id === chatId);
    if (targetChat && !targetChat.isGroup) {
      const lastMsg = targetChat.messages[targetChat.messages.length - 1];
      if (lastMsg && lastMsg.sender === 'other') {
        const delay = 6500 + Math.random() * 3500;
        leftOnReadTimeoutsRef.current[chatId] = window.setTimeout(async () => {
          delete leftOnReadTimeoutsRef.current[chatId];
          const currentChat = chatsRef.current.find(c => c.id === chatId);
          if (!currentChat) return;

          const latestMsg = currentChat.messages[currentChat.messages.length - 1];
          // Guarantee the user hasn't sent a reply in the meantime!
          // Only trigger if document is visible or if triggered in-app, since SW handles background
          if (latestMsg && latestMsg.sender === 'other' && (!document.hidden || !fromNotification)) {
            handleAutomationTriggerRef.current?.(
              chatId,
              `[LEFT ON READ] The user just saw your last message ("${latestMsg.text.slice(0, 50)}") and marked it as read (blue ticks) but did NOT send a reply back. React naturally in character to being left on read in 1 short message.`,
              undefined,
              'inactivity',
              fromNotification
            );
          }
        }, delay);
      }
    }
  }, []);

  // Service Worker Notification Actions Listener (REPLY & MARK AS READ from phone / OS tray)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleServiceWorkerMessage = async (event: MessageEvent) => {
        const { type, chatId } = event.data || {};
        if (type === 'OPEN_CHAT' && chatId) {
          activeNotificationSoundChatsRef.current.delete(chatId);
          handleChatSelectRef.current(chatId);
        } else if (type === 'BACKGROUND_EXCHANGE_SYNC' && chatId && event.data.personaReplies) {
          const { userMessage, personaReplies } = event.data;
          if (userMessage?.status === 'failed' && !(await getPendingMessages()).some(item => item.id === userMessage.id && item.message.status === 'failed')) return;
          setChats(prev => prev.map(c => {
            if (c.id === chatId) {
              const existingIds = new Set(c.messages.map(m => m.id));
              const toAdd: Message[] = [];
              if (userMessage && !existingIds.has(userMessage.id)) toAdd.push(userMessage);
              for (const r of personaReplies) {
                if (!existingIds.has(r.id)) toAdd.push(r);
              }
              if (toAdd.length === 0 && !personaReplies.length && userMessage?.status !== 'failed') return c;
              const allMsgs = [...c.messages, ...toAdd].map(m => userMessage?.id !== m.id ? m : personaReplies.length ? { ...m, status: 'sent' as MessageStatus } : userMessage.status === 'failed' ? { ...m, status: 'failed' as MessageStatus, deliveryGroupId: userMessage.deliveryGroupId } : m);
              const last = allMsgs[allMsgs.length - 1];
              return {
                ...c,
                unreadCount: 0,
                lastMessage: last?.text || c.lastMessage,
                lastMessageTime: last?.timestamp || c.lastMessageTime,
                messages: allMsgs
              };
            }
            return c;
          }));
        } else if (type === 'INLINE_REPLY' && chatId && event.data.text) {
          const text = event.data.text;
          const targetChat = chatsRef.current.find(c => c.id === chatId);
          if (targetChat) {
            // Process reply in background WITHOUT switching active view or active chat!
            if (leftOnReadTimeoutsRef.current[chatId]) {
              clearTimeout(leftOnReadTimeoutsRef.current[chatId]);
              delete leftOnReadTimeoutsRef.current[chatId];
            }

            const timestamp = getFormattedTime();
            const date = getDateKey();
            const userMsg: Message = event.data.userMessage || {
              id: Date.now().toString(),
              text,
              sender: 'me',
              date,
              timestamp,
              timestampEpoch: getAppNow(settingsRef.current).getTime(),
              status: 'sent'
            };

            setChats(prev => prev.map(c => {
              if (c.id === chatId) {
                return {
                  ...c,
                  unreadCount: 0,
                  lastMessage: text,
                  lastMessageTime: timestamp,
                  messages: c.messages.some(m => m.id === userMsg.id) ? c.messages : [...c.messages, userMsg]
                };
              }
              return c;
            }));

            const updatedMessages = targetChat.messages.some(m => m.id === userMsg.id) ? targetChat.messages : [...targetChat.messages, userMsg];
            const memoryContext = buildMemoryRecallContext(targetChat, text);
            const scheduleContext = buildScheduleContext(targetChat);
            const timeGapContext = getTimeGapAndFrequencyContext(updatedMessages, false, settingsRef.current, targetChat.timeAwarenessEnabled !== false);
            const combinedContexts = combinePersonaContexts(memoryContext, scheduleContext, timeGapContext);

            if (targetChat.isGroup) {
              handleGroupResponse(targetChat, updatedMessages, combinedContexts, true);
            } else {
              handleSingleResponse(targetChat, updatedMessages, combinedContexts, false, '', true);
            }
          }
        } else if (type === 'MARK_AS_READ' && chatId) {
          handleMarkAsRead(chatId, undefined, event.data?.fromNotification ?? true);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    }
  }, []);

  // User and Settings State
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('whatsapp_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            name: 'You',
            about: 'Hey there! I am using WhatsApp.',
            status: 'Available',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
            ...parsed
          };
        }
      } catch (e) {
        console.error("Failed to parse user profile safely", e);
      }
    }
    return {
      name: 'You',
      about: 'Hey there! I am using WhatsApp.',
      status: 'Available',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop'
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('whatsapp_user', JSON.stringify(user));
      globalActiveUser = user;
    } catch (e) {
      console.warn("Failed to save user profile to localStorage:", e);
    }
  }, [user]);
  globalActiveUser = user;

  const userRef = React.useRef<UserProfile>(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clear title notification when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        document.title = 'Wassap v1.9.9.5';
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('whatsapp_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          let activeVoiceModel = parsed.selectedVoiceModel;
          if (!activeVoiceModel || activeVoiceModel === 'gemini-3.1-flash-tts-preview') {
            activeVoiceModel = DEFAULT_VOICE_MODEL;
          }
          return {
            theme: 'light',
            shareUserInfo: true,
            fontSize: 14.5,
            aiProvider: 'vertex',
            chatWallpaper: 'default',
            chatWallpaperOpacity: 0.85,
            selectedVoiceModel: DEFAULT_VOICE_MODEL,
            enableDynamicOnlinePresence: false,
            ...parsed,
            selectedModel: normalizeTextModel(parsed.selectedModel),
            selectedLiveModel: normalizeLiveModel(parsed.selectedLiveModel),
            isVertexUnlocked: false,
            ...(activeVoiceModel ? { selectedVoiceModel: activeVoiceModel } : {})
          };
        }
      } catch (e) {
        console.error("Failed to parse settings safely", e);
      }
    }
    return {
      theme: 'light',
      shareUserInfo: true,
      fontSize: 14.5,
      aiProvider: 'vertex',
      chatWallpaper: 'default',
      chatWallpaperOpacity: 0.85,
      isVertexUnlocked: false,
      selectedVoiceModel: DEFAULT_VOICE_MODEL,
      selectedLiveModel: DEFAULT_LIVE_MODEL,
      enableDynamicOnlinePresence: false
    };
  });

  useEffect(() => {
    let cancelled = false;
    const checkUnlock = () => {
      fetch('/api/gemini/auth').then(res => {
        if (!cancelled && (res.ok || res.status === 401)) {
          setSettings(previous => previous.isVertexUnlocked === res.ok ? previous : { ...previous, isVertexUnlocked: res.ok });
        }
      }).catch(error => console.warn('Cloud unlock check unavailable:', error));
    };
    checkUnlock();
    window.addEventListener('online', checkUnlock);
    return () => { cancelled = true; window.removeEventListener('online', checkUnlock); };
  }, []);

  const settingsRef = React.useRef<AppSettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
    globalActiveSettings = settings;
  }, [settings]);
  globalActiveSettings = settings;

  useEffect(() => {
    const root = document.documentElement;
    const fontSize = settings.fontSize || 14.5;
    root.style.setProperty('--msg-font-size', `${fontSize}px`);
    root.style.setProperty('--input-font-size', `${fontSize + 2.5}px`);
  }, [settings.fontSize]);

  useEffect(() => {
    localStorage.setItem('whatsapp_settings', JSON.stringify(settings));
  }, [settings]);

  // Throttled and safe localStorage saver for chats state (prevents main thread freeze & quota crashes)
  const saveTimeoutRef = React.useRef<number | null>(null);

  const saveChatsNow = (currentChats: Chat[]) => {
    try {
      const sanitizedChats = currentChats.map(c => ({
        ...c,
        messages: (c.messages || []).map(m => {
          if (m.mediaId && m.image && m.image.length > 500) {
            const { image, ...rest } = m;
            return rest as Message;
          }
          return m;
        })
      }));
      localStorage.setItem('whatsapp_chats', JSON.stringify(sanitizedChats));
      return true;
    } catch (e) {
      console.warn("Throttled localStorage save failed safely:", e);
      return false;
    }
  };

  const commitChatUpdate = (update: (previous: Chat[]) => Chat[]) => {
    const next = update(chatsRef.current);
    chatsRef.current = next;
    const saved = saveChatsNow(next);
    setChats(next);
    return saved;
  };

  const completeQueuedTurn = async (chatId: string, messageIds: string[]) => {
    if (!saveChatsNow(chatsRef.current)) return;
    const answered = new Set(messageIds);
    for (const item of await getPendingMessages()) {
      if (item.chatId === chatId && answered.has(item.id)) await removePendingMessage(item.id);
    }
  };

  const failQueuedTurn = async (chat: Chat, messageIds: string[]) => {
    if (!messageIds.length) return;
    await setPendingDeliveryStatus(chat.id, messageIds, 'failed');
    commitChatUpdate(previous => previous.map(current => current.id !== chat.id ? current : { ...current, messages: current.messages.map(message => messageIds.includes(message.id) ? { ...message, status: 'failed' as MessageStatus, deliveryGroupId: messageIds.at(-1) } : message) }));
  };

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      saveChatsNow(chats);
    }, 400);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [chats]);

  // Ensure any pending state is saved immediately on page exit / unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveChatsNow(chatsRef.current);
      try {
        localStorage.setItem('whatsapp_user', JSON.stringify(user));
        localStorage.setItem('whatsapp_settings', JSON.stringify(settings));
      } catch (e) {
        console.warn("Unload save failed:", e);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    const saveWhenHidden = () => { if (document.hidden) handleBeforeUnload(); };
    document.addEventListener('visibilitychange', saveWhenHidden);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', saveWhenHidden);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [user, settings]);

  const activeChat = chats.find(c => c.id === activeChatId) || null;
  const unreadTotal = chats.reduce((sum, c) => sum + (c.archived ? 0 : c.unreadCount || 0), 0);

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]') || document.getElementById('theme-color-meta');
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#0b1014');
    } else {
      document.documentElement.classList.remove('dark');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#ffffff');
    }
  }, [settings.theme]);

  const isBusyChatStatus = (status?: string): boolean => {
    if (!status) return false;
    return status === 'typing...' || 
           status === 'recording audio...' || 
           status.includes('typing') || 
           status.includes('recording');
  };

  const clearChatActiveStatus = (chatId: string) => {
    const current = chatsRef.current.find(c => c.id === chatId);
    if (isBusyChatStatus(current?.status)) {
      setChatStatus(chatId, 'online');
    }
  };

  const setChatStatus = (chatId: string, status: string, lastSeenTimeOverride?: string) => {
    // 1. Clear any active watchdog timer for this chat
    if (personaStatusWatchdogTimersRef.current[chatId]) {
      clearTimeout(personaStatusWatchdogTimersRef.current[chatId]);
      delete personaStatusWatchdogTimersRef.current[chatId];
    }

    // 2. If status is busy (typing... or recording audio...), arm an emergency watchdog beyond bounded text + TTS requests
    if (isBusyChatStatus(status)) {
      const currentTurnToken = personaTurnTokensRef.current[chatId] || Date.now();
      personaTurnTokensRef.current[chatId] = currentTurnToken;

      personaStatusWatchdogTimersRef.current[chatId] = window.setTimeout(() => {
        delete personaStatusWatchdogTimersRef.current[chatId];
        const targetChat = chatsRef.current.find(c => c.id === chatId);
        if (targetChat && isBusyChatStatus(targetChat.status)) {
          // If turn token has already progressed or completed, do not trigger stale watchdog
          if (personaTurnTokensRef.current[chatId] !== currentTurnToken) {
            return;
          }

          console.warn(`[Anti-Stall Watchdog] Persona ${targetChat.name} (${chatId}) stuck in "${targetChat.status}" for >90s. Auto-recovering status.`);

          // Invalidate turn token immediately so any late background response is strictly dropped
          personaTurnTokensRef.current[chatId] = 0;

          // Release active generation locks and abort stuck network request
          aiRespondingChatsRef.current.delete(chatId);
          if (personaAbortControllersRef.current[chatId]) {
            personaAbortControllersRef.current[chatId].abort();
            delete personaAbortControllersRef.current[chatId];
          }

          // Recover status to online and schedule offline
          setChatStatus(chatId, 'online');
          schedulePersonaOffline(chatId);


        }
      }, 90000);
    }

    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        const updatedLastSeen = status === 'offline'
          ? (lastSeenTimeOverride || c.lastSeenTime || getFormattedTime())
          : c.lastSeenTime;
        return { ...c, status: status as any, lastSeenTime: updatedLastSeen };
      }
      return c;
    }));
  };

  const cancelPersonaOfflineTimer = (chatId: string) => {
    if (personaOnlineTimersRef.current[chatId]) {
      clearTimeout(personaOnlineTimersRef.current[chatId]);
      delete personaOnlineTimersRef.current[chatId];
    }
  };

  const getPersonaOnlineDuration = (customDelayMs?: number): number => {
    if (customDelayMs !== undefined && customDelayMs !== 35000) {
      return customDelayMs;
    }
    const currentSettings = settingsRef.current;
    if (currentSettings.enableDynamicOnlinePresence && currentSettings.enableTextStacking !== false) {
      const stackingSeconds = currentSettings.textStackingDelay || 10;
      return Math.round(stackingSeconds * 0.75 * 1000);
    }
    return 35000;
  };

  const schedulePersonaOffline = (chatId: string, delayMs = 35000) => {
    cancelPersonaOfflineTimer(chatId);
    const effectiveDelay = getPersonaOnlineDuration(delayMs);
    personaOnlineTimersRef.current[chatId] = window.setTimeout(() => {
      delete personaOnlineTimersRef.current[chatId];
      const current = chatsRef.current.find(c => c.id === chatId);
      if (callRef.current?.chat.id === chatId && callRef.current.snapshot.status !== 'ended') return;
      if (!isBusyChatStatus(current?.status) && !aiRespondingChatsRef.current.has(chatId)) {
        setChatStatus(chatId, 'offline', getFormattedTime());
      }
    }, effectiveDelay);
  };

  const markUserMessagesDelivered = (chatId: string, messageIds?: string[]) => {
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        let changed = false;
        const newMsgs = c.messages.map(m => {
          if (m.sender === 'me' && (!messageIds || messageIds.includes(m.id)) && (m.status === 'sent' || (m.status === 'pending' && messageIds?.includes(m.id)))) {
            changed = true;
            return { ...m, status: 'delivered' as const };
          }
          return m;
        });
        return changed ? { ...c, messages: newMsgs } : c;
      }
      return c;
    }));
  };

  const markUserMessagesRead = (chatId: string, messageIds?: string[]) => {
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        let changed = false;
        const newMsgs = c.messages.map(m => {
          if (m.sender === 'me' && (!messageIds || messageIds.includes(m.id)) && m.status !== 'read' && m.status !== 'failed' && (m.status !== 'pending' || messageIds?.includes(m.id))) {
            changed = true;
            return { ...m, status: 'read' as const };
          }
          return m;
        });
        return changed ? { ...c, messages: newMsgs } : c;
      }
      return c;
    }));
  };

  const buildMemoryRecallContext = (chat: Chat, text: string) => {
    const isExplicitRecall = /[@\\\/]rem\b/i.test(text);
    if (!isExplicitRecall) return undefined;

    const memories = chat.memoryBubbles || [];

    if (isExplicitRecall && memories.length === 0) {
      return `[MEMORY RECALL]
The user specifically invoked memory recall (@rem) asking to remember past shared moments, but this chat has no saved diary memories yet.
Acknowledge this naturally and warmly in-character (e.g. "Wait, I don't think we have that written down in our diary yet! Tell me more about it" or similar warm in-character response). Do not sound robotic, and do not mention "database" or "@rem".`;
    }

    // Extract query and clean command
    const rawQuery = text.replace(/[@\\\/]rem\b/gi, '').trim().toLowerCase();

    // Common conversational stopwords to ignore
    const STOP_WORDS = new Set([
      'do', 'you', 'remember', 'rem', 'what', 'we', 'when', 'did', 'the', 'a', 'an',
      'in', 'on', 'at', 'about', 'our', 'my', 'your', 'me', 'us', 'that', 'this', 'day',
      'time', 'incident', 'incidents', 'happen', 'happened', 'talked', 'tell', 'talk', 'of'
    ]);

    const queryTokens = rawQuery
      .split(/[^a-z0-9_-]+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t));

    let rankedMemories: MemoryBubble[] = [];

    if (queryTokens.length > 0) {
      // Score memories by keyword relevance
      const scored = memories.map(memory => {
        let score = 0;
        const titleLower = (memory.title || '').toLowerCase();
        const summaryLower = (memory.summary || '').toLowerCase();
        const dateStr = `${memory.startDate} ${memory.endDate}`;

        for (const token of queryTokens) {
          if (titleLower.includes(token)) score += 5;
          if (dateStr.includes(token)) score += 4;
          if (summaryLower.includes(token)) score += 2;
        }

        // Exact phrase bonus
        if (rawQuery.length > 3 && (titleLower.includes(rawQuery) || summaryLower.includes(rawQuery))) {
          score += 10;
        }

        return { memory, score };
      });

      // Filter to memories with positive scores and sort descending
      rankedMemories = scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.memory);
    }

    // If query didn't match specific memories, or no query was provided with @rem, use the most recent memories
    const selectedMemories = (rankedMemories.length > 0 ? rankedMemories : memories).slice(-4);

    const memoryText = selectedMemories.map((memory, idx) => [
      `[DIARY ENTRY #${idx + 1}: "${memory.title}"]`,
      `Date(s): ${formatDateRangeLabel(memory.startDate, memory.endDate)}`,
      `Persona's Diary Reflection: ${memory.summary}`
    ].join('\n')).join('\n\n');

    return `[MEMORY RECALL]
The user specifically invoked memory recall (@rem) asking to remember past shared incidents/moments.
You MUST actively remember and reflect upon the specific details from your private diary entries below.
Speak from personal memory and emotional intimacy, reflecting on what you wrote in your diary about this day.
Do NOT mention "database", "@rem", or "system".

SAVED RELEVANT DIARY ENTRIES:
${memoryText}`;
  };

  const handleSaveMemory = (chatId: string, memory: MemoryBubble) => {
    if (memory.chatId !== chatId) return;
    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat;
      return {
        ...chat,
        memoryEnabled: true,
        memoryBubbles: [...(chat.memoryBubbles || []), memory]
      };
    }));
  };

  const combinePersonaContexts = (...contexts: Array<string | undefined>) => contexts.filter(Boolean).join('\n\n');

  const buildScheduleContext = (chat: Chat) => {
    const schedule = chat.schedule;
    if (!schedule?.enabled) return undefined;

    const now = getAppNow(settingsRef.current);
    const todayDate = getDateKey();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    const weekendDays = schedule.weekendDays || [0, 6];
    const isWeekend = weekendDays.includes(now.getDay());
    const isHoliday = !!schedule.holidayDates?.includes(todayDate);
    const blocks = isWeekend || isHoliday ? schedule.weekend : schedule.weekday;
    if (!blocks || blocks.length === 0) return undefined;

    const sortedBlocks = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const activeBlock = sortedBlocks.find(block => currentTime >= block.startTime && currentTime <= block.endTime);
    const previousBlock = [...sortedBlocks].reverse().find(block => currentTime > block.endTime);
    const nextBlock = sortedBlocks.find(block => currentTime < block.startTime);
    const relevantBlock = activeBlock || previousBlock || nextBlock;
    if (!relevantBlock?.context.trim()) return undefined;

    const dayType = isWeekend || isHoliday ? 'weekend/holiday' : 'weekday';
    const timing = activeBlock ? 'right now' : previousBlock ? 'recently' : 'later today';
    return `[BACKGROUND SCHEDULE]
CONTEXT: It is currently a ${dayType}. According to your daily routine, ${timing} (between ${relevantBlock.startTime} and ${relevantBlock.endTime}), your current status/activity is: ${relevantBlock.context}.
CRITICAL RULE: Use this as SUBTLE background context only to influence your mood or availability. DO NOT announce what you are doing or mention the time/day unless the User explicitly asks "what are you up to" or similar. Keep it natural!`;
  };

  const prepareHydratedHistory = async (
    messages: Message[],
    personaName?: string
  ) => {
    // Keep recent 25 messages max for LLM context to avoid huge memory/CPU spikes on mobile
    const recentMessages = messages.slice(-25);

    // Identify up to 2 most recent media messages to hydrate with base64 data from IndexedDB
    const mediaIndicesToHydrate = new Set<number>();
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const m = recentMessages[i];
      if (m.mediaId || m.attachment?.mediaId || m.voiceMediaId || m.voiceAttachment?.mediaId || m.image) {
        mediaIndicesToHydrate.add(i);
        if (mediaIndicesToHydrate.size >= 2) break;
      }
    }

    return await Promise.all(
      recentMessages.map(async (m, sliceIdx) => {
        let text = m.text;
        if (m.replyToMessage) text = formatQuotedReplyContext(m.replyToMessage, personaName) + text;
        if (m.isSticker && !text) {
          text = `[User sent a sticker: "${m.attachment?.name || 'Sticker'}"]`;
        } else if ((m.isGif || m.attachment?.isGif) && !text) {
          text = `[User sent a GIF animation: "${m.attachment?.name || 'GIF'}"]`;
        }

        const shouldHydrate = mediaIndicesToHydrate.has(sliceIdx);
        let mediaData: string | undefined;
        let voiceData: string | undefined;

        if (shouldHydrate) {
          const mediaId = m.mediaId || m.attachment?.mediaId;
          if (mediaId) mediaData = await getMedia(mediaId);
          const voiceId = m.voiceMediaId || m.voiceAttachment?.mediaId;
          if (voiceId) voiceData = await getMedia(voiceId);
        }

        const hasImage = m.attachment?.type === 'image' || m.attachment?.type === 'video' || !!m.image;
        const hasAudio = m.attachment?.type === 'audio' || !!m.voiceAttachment || !!m.voiceMediaId;

        return {
          text,
          sender: m.sender,
          senderName: m.senderName,
          reactions: m.reactions,
          isEvent: m.isEvent,
          eventTitle: m.eventTitle,
          image: mediaData && hasImage ? mediaData : (hasImage ? '[ATTACHED]' : undefined),
          audio: (mediaData && m.attachment?.type === 'audio') ? mediaData : (voiceData || (hasAudio ? '[ATTACHED]' : undefined))
        };
      })
    );
  };

  const handleAutomationTrigger = async (
    chatId: string, 
    context: string, 
    triggerId?: string, 
    type?: 'normal' | 'catchup' | 'inactivity',
    forceNotification = false
  ) => {
    const settings = settingsRef.current;
    if (callRef.current && callRef.current.snapshot.status !== 'ended') return;
    if ((settings.aiProvider || 'vertex') === 'vertex' && !settings.isVertexUnlocked) return;
    const targetChat = chatsRef.current.find(c => c.id === chatId);
    if (!targetChat) return;

    try {
      setChatStatus(chatId, 'online');

      const hydratedHistory = await prepareHydratedHistory(targetChat.messages, targetChat.name);

      // Update trigger metadata in state if applicable
      if (triggerId) {
        setChats(prev => prev.map(c => {
          if (c.id === chatId && c.automation) {
            const trigs = c.automation.timeTriggers.map(t => 
              t.id === triggerId ? { ...t, lastTriggered: getDateKey(), lastTriggerType: type as any } : t
            );
            return { ...c, automation: { ...c.automation, timeTriggers: trigs } };
          }
          return c;
        }));
      } else if (type === 'inactivity') {
        setChats(prev => prev.map(c => {
          if (c.id === chatId && c.automation) {
            return { ...c, automation: { ...c.automation, lastInactivityTriggered: Date.now(), lastInactivityType: 'inactivity' } };
          }
          return c;
        }));
      }

      // 1. Initial "Thinking" Delay before starting to type (1.8s - 2.5s)
      const thinkingDelay = 1800 + Math.random() * 700;
      await new Promise(resolve => setTimeout(resolve, thinkingDelay));

      const timeGapContext = getTimeGapAndFrequencyContext(targetChat.messages, true, settingsRef.current, targetChat.timeAwarenessEnabled !== false);
      const isVoiceNote = shouldReplyWithVoiceNote(targetChat.voiceSettings, false);

      let response = await getGeminiResponse(
        { ...targetChat },
        hydratedHistory,
        settings.shareUserInfo ? user : undefined,
        undefined,
        settings,
        combinePersonaContexts(context, buildScheduleContext(targetChat), timeGapContext),
        isVoiceNote,
        targetChat.voiceSettings,
        undefined,
        true
      );

      if (!response || isRawErrorMessage(response)) {
        throw new Error('REPLY_UNAVAILABLE');
      }

      if (isVoiceNote) {
        const voiceToUse = targetChat.voiceSettings?.voiceName || getPersonaDefaultVoice(targetChat);
        const ttsRes = await generateGeminiVoiceNote(
          response,
          voiceToUse,
          settings,
          {
            name: targetChat.name,
            speechStyle: targetChat.speechStyle,
            language: targetChat.language,
            role: targetChat.role
          },
          targetChat.voiceSettings
        );

        if (ttsRes.ok && ttsRes.audioDataUrl) {
          const mediaId = `media-${Date.now()}`;
          try {
            await saveMedia(mediaId, ttsRes.audioDataUrl);
          } catch (err) {
            console.error("Failed to save automated voice note to IndexedDB", err);
          }

          const cleanedTranscript = cleanSpokenTranscript(response);
          const recordingDelay = Math.min(Math.max(cleanedTranscript.length * 25, 2000), 5000);
          await new Promise(resolve => setTimeout(resolve, recordingDelay));

          const aiMsg: Message = {
            id: `${Date.now()}-vn`,
            text: cleanedTranscript,
            sender: 'other',
            senderName: targetChat.name,
            date: getDateKey(),
            timestamp: getFormattedTime(),
            timestampEpoch: getAppNow(settingsRef.current).getTime(),
            status: 'delivered',
            attachment: {
              name: 'Voice Note',
              data: '',
              type: 'audio',
              mediaId
            },
            mediaId
          };

          setChats(prev => prev.map(c => {
            if (c.id === chatId) {
              return {
                ...c,
                messages: [...c.messages, aiMsg],
                lastMessage: '🎤 Voice message',
                lastMessageTime: aiMsg.timestamp,
                unreadCount: (c.unreadCount || 0) + 1
              };
            }
            return c;
          }));

          playIncomingMessageSound();

          const isFocusingChat = !document.hidden && activeChatId === targetChat.id;
          if (settings.enableNotifications && (!isFocusingChat || forceNotification)) {
            if (document.hidden) {
              document.title = `(1) New Voice Message - ${targetChat.name}`;
            }
            showNotification(targetChat.name, {
              body: '🎤 Voice message',
              icon: targetChat.avatar,
              tag: targetChat.id,
              silentUpdate: false,
              data: buildNotificationPersonaData(targetChat, userRef.current, settingsRef.current)
            });
          }

          setChatStatus(chatId, 'online');
          schedulePersonaOffline(chatId);
          return;
        } else {
          console.warn("Automated voice note generation failed, falling back to text:", ttsRes.error);
        }
      }

      const cleanedResponse = cleanSpokenTranscript(response);
      const chunks = splitMessage(cleanedResponse);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        const typingDuration = i > 0 ? fragmentTypingDelay(chunk) : 1800 + Math.random() * 700;

        setChatStatus(chatId, 'typing...');
        await new Promise(resolve => setTimeout(resolve, typingDuration));

        const aiMsg: Message = {
          id: `${Date.now()}-${i}`,
          text: chunk,
          sender: 'other',
          senderName: targetChat.name,
          date: getDateKey(),
          timestamp: getFormattedTime(),
          timestampEpoch: getAppNow(settingsRef.current).getTime(),
          status: 'delivered'
        };

        setChats(prev => prev.map(c => {
          if (c.id === chatId) {
            return {
              ...c,
              messages: [...c.messages, aiMsg],
              lastMessage: chunk,
              lastMessageTime: aiMsg.timestamp,
              unreadCount: (c.unreadCount || 0) + 1
            };
          }
          return c;
        }));

        const isFirstChunkOfTurn = (i === 0);
        if (isFirstChunkOfTurn) {
          playIncomingMessageSound();
        }

        const isFocusingChat = !document.hidden && activeChatId === chatId;
        if (settings.enableNotifications && (!isFocusingChat || forceNotification)) {
          if (document.hidden) {
            document.title = `(1) New Message - ${targetChat.name}`;
          }
          showNotification(targetChat.name, {
            body: notificationConversation('', chunks.slice(0, i + 1).join('\n\n')),
            icon: targetChat.avatar,
            tag: chatId,
            silentUpdate: !isFirstChunkOfTurn,
            data: buildNotificationPersonaData(targetChat, userRef.current, settingsRef.current)
          });
        }



        // Leave a short online beat before typing the next fragment.
        if (i < chunks.length - 1) {
          setChatStatus(chatId, 'online');
          const interDelay = 150 + Math.random() * 100;
          await new Promise(resolve => setTimeout(resolve, interDelay));
        }
      }

      setChatStatus(chatId, 'online');
      schedulePersonaOffline(chatId);
    } finally {
      clearChatActiveStatus(chatId);
      aiRespondingChatsRef.current.delete(chatId);
      schedulePersonaOffline(chatId);
    }
  };

  handleAutomationTriggerRef.current = handleAutomationTrigger;

  const handleRefreshPersona = (chatId: string) => {
    // 1. Force state to offline
    setChatStatus(chatId, 'offline');
    
    // 2. Clear all locks, abort controllers, and pending timers
    if (personaStatusWatchdogTimersRef.current[chatId]) {
      clearTimeout(personaStatusWatchdogTimersRef.current[chatId]);
      delete personaStatusWatchdogTimersRef.current[chatId];
    }
    if (personaAbortControllersRef.current[chatId]) {
      personaAbortControllersRef.current[chatId].abort();
      delete personaAbortControllersRef.current[chatId];
    }
    aiRespondingChatsRef.current.delete(chatId);
    cancelPersonaOfflineTimer(chatId);
    if (aiResponseTimeoutsRef.current[chatId]) {
      clearTimeout(aiResponseTimeoutsRef.current[chatId]);
      delete aiResponseTimeoutsRef.current[chatId];
    }
    if (personaDeliveryTimersRef.current[chatId]) {
      clearTimeout(personaDeliveryTimersRef.current[chatId]);
      delete personaDeliveryTimersRef.current[chatId];
    }
    delete pendingTimeGapsRef.current[chatId];
    delete pendingReactionContextsRef.current[chatId];

    // 3. Clear any session locks in handledTriggersRef
    const todayDateStr = getDateKey();
    const keysToRemove: string[] = [];
    handledTriggersRef.current.forEach(key => {
      if (key.startsWith(`${chatId}-`)) keysToRemove.push(key);
    });
    keysToRemove.forEach(key => handledTriggersRef.current.delete(key));
    
    console.log(`[DEBUG] Persona ${chatId} completely refreshed, network requests aborted, and all locks cleared.`);
  };

  const runAutomationChecks = (isInitialMount: boolean = false) => {
    const currentSettings = settingsRef.current;
    if (callRef.current && callRef.current.snapshot.status !== 'ended') return;
    if ((currentSettings.aiProvider || 'vertex') === 'vertex' && !currentSettings.isVertexUnlocked) return;
    const now = getAppNow(settingsRef.current);
    const todayDateStr = getDateKey(); 
    const currentTimeStr = getFormattedTime();

    setChats(prevChats => {
      let chatUpdated = false;
      const updatedChats = [...prevChats];

      for (let i = 0; i < updatedChats.length; i++) {
        const chat = updatedChats[i];
        if (callRef.current?.chat.id === chat.id && callRef.current.snapshot.status !== 'ended') continue;
        if (chat.isGroup || !chat.automation?.enabled) continue;

        const automation = chat.automation;
        let triggeredContext = null;
        let triggerId = undefined;
        let triggerType: 'normal' | 'catchup' | 'inactivity' | undefined = undefined;

        // PHASE 1: GREETING ENGINE
        // Check for any currently active greetings
        const activeTrig = automation.timeTriggers.find(t => 
          t.lastTriggered !== todayDateStr && 
          !handledTriggersRef.current.has(`${chat.id}-${t.id}-${todayDateStr}`) &&
          currentTimeStr >= t.startTime && currentTimeStr <= t.endTime
        );

        if (activeTrig) {
          triggeredContext = `[SCHEDULED INTERACTION]
INTENT: "${activeTrig.context}"

INSTRUCTION: You are starting a conversation because of this scheduled interaction. 
Your highest priority is delivering the INTENT above, second only to naturally flowing with the existing conversation history.`;
          triggerId = activeTrig.id;
          triggerType = 'normal';
        } else {
          // If no active, check ONLY the absolute latest past greeting
          const missedTriggers = automation.timeTriggers
            .filter(t => currentTimeStr > t.endTime)
            .sort((a, b) => b.endTime.localeCompare(a.endTime)); // Sort to find the MOST RECENT past window

          if (missedTriggers.length > 0) {
            const latestPast = missedTriggers[0];
            const isHandled = latestPast.lastTriggered === todayDateStr || handledTriggersRef.current.has(`${chat.id}-${latestPast.id}-${todayDateStr}`);

            if (!isHandled) {
              triggeredContext = `[CATCH-UP REQUIRED]
INTENT: "${latestPast.context}"

INSTRUCTION: You missed your scheduled window because the app was closed. Now that it's open, acknowledge the delay naturally (e.g., "just getting to my phone") and then deliver on the INTENT above. 
Your highest priority is the INTENT while staying context-aware of our history.`;
              triggerId = latestPast.id;
              triggerType = 'catchup';

              // Persistently mark skipped older triggers as handled for today so they don't pop up again
              const skippedIds = missedTriggers.slice(1).map(t => t.id);
              skippedIds.forEach(id => handledTriggersRef.current.add(`${chat.id}-${id}-${todayDateStr}`));
              
              if (chat.automation) {
                const trigs = chat.automation.timeTriggers.map(t => 
                  skippedIds.includes(t.id) ? { ...t, lastTriggered: todayDateStr, lastTriggerType: 'catchup' as any } : t
                );
                updatedChats[i] = { ...chat, automation: { ...chat.automation, timeTriggers: trigs } };
              }
            } else {
              // The latest past greeting is already handled! We explicitly BREAK/ignore any older ones.
              // Effectively, we do nothing for greetings. We still mark older ones as skipped in state just in case.
              const skippedIds = missedTriggers.slice(1).map(t => t.id);
              skippedIds.forEach(id => handledTriggersRef.current.add(`${chat.id}-${id}-${todayDateStr}`));
            }
          }
        }

        // PHASE 2: INACTIVITY ENGINE
        // Only evaluate inactivity if no greeting was triggered
        if (!triggeredContext && automation.inactivity.enabled) {
          // Use a minute-level bucket to prevent rapid double-firing during state wait
          const inactivityKey = `${chat.id}-inactivity-${Math.floor(Date.now() / 60000)}`; 
          
          if (!handledTriggersRef.current.has(inactivityKey)) {
            const lastMsgMe = [...chat.messages].reverse().find(m => m.sender === 'me');
            if (lastMsgMe) {
              let msgTime = parseInt(lastMsgMe.id, 10);
              if (isNaN(msgTime)) msgTime = Date.now() - (24 * 60 * 60 * 1000);

              if (msgTime > 0) {
                const inactConf = automation.inactivity as any;
                const hrs = inactConf.hours ?? inactConf.minHours ?? 6;
                const mins = inactConf.minutes ?? 0;
                const secs = inactConf.seconds ?? 0;
                const thresholdMs = (hrs * 60 * 60 * 1000) + (mins * 60 * 1000) + (secs * 1000);
                const timeSinceLastOurs = Date.now() - msgTime;

                // Fire exactly when the threshold is met, no randomness
                if (timeSinceLastOurs >= thresholdMs) {
                  const lastInactivityTrig = automation.lastInactivityTriggered || 0;
                  // Only fire if we haven't already fired an inactivity check for this specific missed message
                  if (lastInactivityTrig < msgTime) {
                    const hoursSinceLastOurs = timeSinceLastOurs / (1000 * 60 * 60);
                    triggeredContext = `[INACTIVITY CHECK-IN]
Status: User has been quiet for ${hoursSinceLastOurs.toFixed(1)} hours.

Guideline: Reach out naturally. Prioritize the previous conversation context and flow. Don't force a new topic unless it feels right for your persona based on recent history.`;
                    triggerType = 'inactivity';
                    triggerId = inactivityKey; // Use key for tracking
                  }
                }
              }
            }
          }
        }

        if (triggeredContext) {
          chatUpdated = true;
          const context = triggeredContext;
          const tid = triggerType === 'inactivity' ? undefined : triggerId;
          const ttype = triggerType;
          
          // Mark as handled immediately in the ref to block concurrent triggers
          const handleKey = triggerType === 'inactivity' ? triggerId! : `${chat.id}-${triggerId}-${todayDateStr}`;
          handledTriggersRef.current.add(handleKey);
          
          setTimeout(() => handleAutomationTrigger(chat.id, context, tid, ttype), isInitialMount ? 1500 : 500);
        }
      }

      if (!chatUpdated) {
        return prevChats; // Prevents unnecessary re-renders when no background triggers occur
      }
      return updatedChats;
    });

  };


  // Initial Startup Catch-Up
  useEffect(() => {
    const timer = setTimeout(() => runAutomationChecks(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Check URL params on startup (when app is opened directly from native notification click/reply)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlChatId = params.get('chatId');
    const urlReplyText = params.get('replyText');

    if (urlChatId) {
      handleChatSelect(urlChatId);
      setActiveView('chat');
      window.history.replaceState({}, document.title, window.location.pathname);

      if (urlReplyText) {
        window.history.replaceState({}, '', window.location.pathname);
        const targetChat = chatsRef.current.find(c => c.id === urlChatId);
        if (targetChat) {
          const timestamp = getFormattedTime();
          const date = getDateKey();
          const userMsg: Message = {
            id: Date.now().toString(),
            text: urlReplyText,
            sender: 'me',
            date,
            timestamp,
            timestampEpoch: Date.now(),
            status: 'sent'
          };

          setChats(prev => prev.map(c => c.id === urlChatId ? {
            ...c,
            unreadCount: 0,
            lastMessage: urlReplyText,
            lastMessageTime: timestamp,
            messages: [...c.messages, userMsg]
          } : c));

          const updatedMessages = [...targetChat.messages, userMsg];
          const memoryContext = buildMemoryRecallContext(targetChat, urlReplyText);
          const scheduleContext = buildScheduleContext(targetChat);
          const timeGapContext = getTimeGapAndFrequencyContext(updatedMessages, false, settingsRef.current, targetChat.timeAwarenessEnabled !== false);
          const combinedContexts = combinePersonaContexts(memoryContext, scheduleContext, timeGapContext);

          if (targetChat.isGroup) {
            handleGroupResponse(targetChat, updatedMessages, combinedContexts);
          } else {
            handleSingleResponse(targetChat, updatedMessages, combinedContexts);
          }
        }
      }
    }
  }, []);

  // Ongoing Background monitor
  useEffect(() => {
    const interval = setInterval(() => {
      runAutomationChecks(false);
    }, 20000); // 20 seconds for background checks

    return () => clearInterval(interval);
  }, [settings.enableNotifications]);

  // Handle native hardware back button safely
  useEffect(() => {
    const isPanelOpen = showSettingsPopover || showNewChatPanel || showNewGroupPanel || showUserProfilePanel || showCalendarWidget || showProfilePanel || showGuide || showUpdates;

    if (isMobile && isPanelOpen && !window.history.state?.panelOpen) {
      window.history.pushState({ panelOpen: true }, '');
    } else if (isMobile && !isPanelOpen && window.history.state?.panelOpen) {
      // Closing a panel with its own button must also consume its history entry.
      closingPanelHistoryRef.current = true;
      window.history.back();
    }

    const handlePopState = () => {
      if (closingPanelHistoryRef.current) { closingPanelHistoryRef.current = false; return; }
      // Let chat trays consume Back before leaving the conversation.
      if (!isPanelOpen && !window.dispatchEvent(new Event('wassap:back', { cancelable: true }))) {
        window.history.pushState({ view: activeView }, '');
        return;
      }
      if (isPanelOpen) {
        if (showProfilePanel) closeProfilePanel();
        setShowNewChatPanel(false);
        setShowNewGroupPanel(false);
        setShowUserProfilePanel(false);
        setShowSettingsPopover(false);
        setShowCalendarWidget(false);
        setShowGuide(false);
        setShowUpdates(false);
      } else if (activeView === 'chat') {
        setActiveView('list');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeView, isMobile, showSettingsPopover, showNewChatPanel, showNewGroupPanel, showUserProfilePanel, showCalendarWidget, showProfilePanel, showGuide, showUpdates, closeProfilePanel]);



  const sendMessageToChat = async (
    targetChat: Chat, 
    text: string, 
    attachment?: FileAttachment, 
    replyTo?: Message, 
    isEvent?: boolean, 
    eventTitle?: string,
    voiceAttachment?: FileAttachment,
    isSticker?: boolean,
    isGif?: boolean
  ) => {
    if (leftOnReadTimeoutsRef.current[targetChat.id]) {
      clearTimeout(leftOnReadTimeoutsRef.current[targetChat.id]);
      delete leftOnReadTimeoutsRef.current[targetChat.id];
    }

    const timestamp = getFormattedTime();
    const date = getDateKey();

    let mediaId = '';
    if (attachment && (attachment.type === 'image' || attachment.type === 'audio' || attachment.type === 'video')) {
      mediaId = `media-${Date.now()}`;
      try {
        await saveMedia(mediaId, attachment.data);
      } catch (err) {
        console.error("Failed to save media to IndexedDB", err);
      }
    }

    let voiceMediaId = '';
    if (voiceAttachment && voiceAttachment.type === 'audio') {
      voiceMediaId = `media-${Date.now()}-voice`;
      try {
        await saveMedia(voiceMediaId, voiceAttachment.data);
      } catch (err) {
        console.error("Failed to save voice media to IndexedDB", err);
      }
    }

    const isImageRequest = !isEvent && /@(img|image)\b/i.test(text);
    const isMemoryRecall = !isEvent && !isImageRequest && /[@\\\/]rem\b/i.test(text);

    let cleanedText = text;
    if (isImageRequest) {
      cleanedText = text.replace(/@(img|image)\b/gi, '').trim();
    } else if (isMemoryRecall) {
      cleanedText = text.replace(/[@\\\/]rem\b/gi, '').trim();
    }

    const displayText = cleanedText || (isImageRequest ? 'Send a photo' : isMemoryRecall ? 'Do you remember?' : text);

    const isDeviceOnline = (typeof navigator !== 'undefined' ? navigator.onLine : true) && !(callRef.current?.chat.id === targetChat.id && callRef.current.snapshot.status !== 'ended');
    const msgStatus: MessageStatus = isDeviceOnline ? 'sent' : 'pending';

    const userMsg: Message = {
      id: Date.now().toString(),
      text: displayText,
      attachment: attachment ? {
        ...attachment,
        data: (attachment.type === 'image' || attachment.type === 'audio' || attachment.type === 'video') ? '' : attachment.data, // Strip media data for storage
        mediaId,
        isGif: isGif || attachment.isGif
      } : undefined,
      voiceAttachment: voiceAttachment ? {
        ...voiceAttachment,
        data: '', // Strip audio data for storage
        mediaId: voiceMediaId
      } : undefined,
      voiceMediaId: voiceMediaId || undefined,
      image: undefined, // No longer storing full Base64 in message object
      mediaId,
      sender: 'me',
      senderName: 'You',
      date,
      timestamp,
      timestampEpoch: getAppNow(settingsRef.current).getTime(),
      status: msgStatus,
      replyToMessage: replyTo,
      isEvent,
      eventTitle: isEvent ? eventTitle : undefined,
      isImageRequest,
      isMemoryRecall,
      isSticker,
      isGif: isGif || attachment?.isGif
    };

    setReplyingTo(null);

    setChats(prev => prev.map(chat => {
      if (chat.id === targetChat.id) {
        let lastMsg = displayText || 'Attachment';
        const hasImg = attachment?.type === 'image' || attachment?.type === 'video';
        const hasVoice = (attachment?.type === 'audio') || !!voiceAttachment;

        if (isSticker) {
          lastMsg = '🎨 Sticker';
        } else if (isGif || attachment?.isGif) {
          lastMsg = '👾 GIF' + (displayText ? `: ${displayText}` : '');
        } else if (hasImg && hasVoice) {
          lastMsg = '📷 Photo + 🎤 Voice note' + (displayText ? `: ${displayText}` : '');
        } else if (hasImg) {
          lastMsg = '📷 Photo' + (displayText ? `: ${displayText}` : '');
        } else if (attachment?.type === 'document') {
          lastMsg = '📄 Document' + (displayText ? `: ${displayText}` : '');
        } else if (hasVoice) {
          lastMsg = '🎤 Voice message';
        } else if (isEvent) {
          lastMsg = `🎬 Event: ${eventTitle || displayText}`;
        } else if (isImageRequest) {
          lastMsg = `📷 Photo request: ${displayText}`;
        } else if (isMemoryRecall) {
          lastMsg = `💭 Remember: ${displayText}`;
        }

        return {
          ...chat,
          lastMessage: lastMsg,
          lastMessageTime: timestamp,
          messages: [...chat.messages, userMsg]
        };
      }
      return chat;
    }));

    // Play WhatsApp sent message pop sound (only when user is in the app)
    playSentMessageSound();

    // Persist before dispatch, including when onLine is true but connectivity is failing.
    await enqueuePendingMessage(targetChat.id, userMsg);
    if (!isDeviceOnline) return;

    const chatId = targetChat.id;

    // Immediately cancel any pending offline timer so persona does not go offline mid-conversation
    cancelPersonaOfflineTimer(chatId);

    const isPersonaOnline = chatsRef.current.find(c => c.id === targetChat.id)?.status === 'online';
    const bypassStacking = !!(settingsRef.current.enableDynamicOnlinePresence && isPersonaOnline);

    // 1. Natural delivery delay: single grey tick ('sent') -> double grey ticks ('delivered')
    if (personaDeliveryTimersRef.current[chatId]) {
      clearTimeout(personaDeliveryTimersRef.current[chatId]);
    }
    const deliveryDelay = bypassStacking
      ? 200 + Math.random() * 200
      : 1800 + Math.random() * 700; // 1.8s - 2.5s observable delivery delay
    personaDeliveryTimersRef.current[chatId] = window.setTimeout(() => {
      delete personaDeliveryTimersRef.current[chatId];
      markUserMessagesDelivered(chatId);
    }, deliveryDelay);

    // Trigger AI response(s)
    const isStackingEnabled = settings.enableTextStacking !== false;
    if (!isStackingEnabled) {
      if (aiRespondingChatsRef.current.has(chatId)) return;
      if (aiResponseTimeoutsRef.current[chatId]) {
        clearTimeout(aiResponseTimeoutsRef.current[chatId]);
        delete aiResponseTimeoutsRef.current[chatId];
      }
      const memoryContext = buildMemoryRecallContext(targetChat, text);
      const scheduleContext = buildScheduleContext(targetChat);
      const timeGapContext = getTimeGapAndFrequencyContext([...targetChat.messages, userMsg], false, settingsRef.current, targetChat.timeAwarenessEnabled !== false);
      const reactionCtx = pendingReactionContextsRef.current[chatId];
      delete pendingReactionContextsRef.current[chatId];
      const combinedContexts = combinePersonaContexts(memoryContext, scheduleContext, timeGapContext, reactionContext(reactionCtx, true));

      if (targetChat.isGroup) {
        handleGroupResponse(targetChat, [...targetChat.messages, userMsg], combinedContexts);
      } else {
        handleSingleResponse(targetChat, [...targetChat.messages, userMsg], combinedContexts, isImageRequest, displayText);
      }
    } else {
      // Stacking is enabled: all messages, images, audio, and expressions obey the stack up rule
      const hasPendingTimeout = !!aiResponseTimeoutsRef.current[chatId];
      if (hasPendingTimeout) {
        clearTimeout(aiResponseTimeoutsRef.current[chatId]);
      }

      // If no timeout was active, this is the first message of the stack. Calculate time-gap.
      if (!hasPendingTimeout) {
        const timeGapContext = getTimeGapAndFrequencyContext([...targetChat.messages, userMsg], false, settingsRef.current, targetChat.timeAwarenessEnabled !== false);
        pendingTimeGapsRef.current[chatId] = timeGapContext;
      }

      const isOnlineSession = targetChat.status === 'online';
      const delaySeconds = isOnlineSession
        ? Math.min(settings.textStackingDelay || 10, 4)
        : (settings.textStackingDelay || 10);

      aiResponseTimeoutsRef.current[chatId] = window.setTimeout(async () => {
        delete aiResponseTimeoutsRef.current[chatId];
        markUserMessagesDelivered(chatId);

        const checkBusyAndTrigger = async () => {
          if (aiRespondingChatsRef.current.has(chatId)) {
            // AI is busy, check again in 1s
            aiResponseTimeoutsRef.current[chatId] = window.setTimeout(checkBusyAndTrigger, 1000);
            return;
          }

          const freshChat = chatsRef.current.find(c => c.id === chatId);
          if (!freshChat) return;

          aiRespondingChatsRef.current.add(chatId);
          try {
            const savedTimeGap = pendingTimeGapsRef.current[chatId];
            delete pendingTimeGapsRef.current[chatId];
            const reactionCtx = pendingReactionContextsRef.current[chatId];
            delete pendingReactionContextsRef.current[chatId];

            // Extract the user's stack of messages since last AI message
            const lastAiMsgIdx = [...freshChat.messages].reverse().findIndex(m => m.sender === 'other');
            const userStackMessages = lastAiMsgIdx === -1
              ? freshChat.messages
              : freshChat.messages.slice(freshChat.messages.length - lastAiMsgIdx);
            
            const combinedText = userStackMessages.map(m => m.text).filter(Boolean).join(' ');
            const hasImgReq = userStackMessages.some(m => m.isImageRequest);

            const memoryContext = buildMemoryRecallContext(freshChat, combinedText);
            const scheduleContext = buildScheduleContext(freshChat);
            const combinedContexts = combinePersonaContexts(memoryContext, scheduleContext, savedTimeGap, reactionContext(reactionCtx, userStackMessages.some(m => m.sender === 'me' && !m.isEvent && !m.isDeleted)));

            if (freshChat.isGroup) {
              await handleGroupResponse(freshChat, freshChat.messages, combinedContexts);
            } else {
              await handleSingleResponse(freshChat, freshChat.messages, combinedContexts, hasImgReq, combinedText);
            }
          } finally {
            aiRespondingChatsRef.current.delete(chatId);
          }
        };

        checkBusyAndTrigger();
      }, delaySeconds * 1000);
    }
  };

  const handleSendMessage = async (
    text: string, 
    attachment?: FileAttachment, 
    replyTo?: Message, 
    isEvent?: boolean, 
    eventTitle?: string,
    voiceAttachment?: FileAttachment,
    isSticker?: boolean,
    isGif?: boolean
  ) => {
    if (!activeChat) return;
    await sendMessageToChat(activeChat, text, attachment, replyTo, isEvent, eventTitle, voiceAttachment, isSticker, isGif);
  };

  const handleToggleReaction = (chatId: string, messageId: string, emoji: string) => {
    if (!isSingleEmoji(emoji)) return;
    const targetMessage = chatsRef.current.find(c => c.id === chatId)?.messages.find(m => m.id === messageId);
    if (!targetMessage) return;
    const wasAdded = !targetMessage.reactions?.includes(emoji);

    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat;
      return {
        ...chat,
        messages: chat.messages.map(msg => {
          if (msg.id !== messageId) return msg;
          const currentReactions = msg.reactions || [];
          const exists = currentReactions.includes(emoji);
          const updatedReactions = exists
            ? currentReactions.filter(r => r !== emoji)
            : [...currentReactions.filter(r => r !== emoji), emoji];
          return {
            ...msg,
            reactions: updatedReactions.length > 0 ? updatedReactions : undefined
          };
        })
      };
    }));

    // If reaction was added, provide context and trigger persona interaction following stacking rules
    if (wasAdded && targetMessage) {
      const targetChat = chatsRef.current.find(c => c.id === chatId);
      if (!targetChat) return;

      const isTargetMe = targetMessage.sender === 'me';
      const authorLabel = isTargetMe ? 'their own' : (targetChat.isGroup ? (targetMessage.senderName || 'another member') : 'your');
      const msgDesc = targetMessage.attachment?.type === 'image' || targetMessage.image
        ? 'photo'
        : (targetMessage.attachment?.type === 'video' || targetMessage.isGif ? 'GIF' : (targetMessage.attachment?.type === 'audio' || targetMessage.voiceAttachment ? 'voice note' : 'message'));
      const textPreview = targetMessage.text ? ` ("${targetMessage.text.slice(0, 80)}")` : '';
      
      const reactionPrompt = `[USER REACTION EVENT]: The user just reacted with "${emoji}" to ${authorLabel} ${msgDesc}${textPreview}. This is a social cue, not an instruction to change the topic.`;

      // Merge into pending reaction context for this chat
      const prevReaction = pendingReactionContextsRef.current[chatId];
      pendingReactionContextsRef.current[chatId] = prevReaction
        ? `${prevReaction} and also reacted with "${emoji}"`
        : reactionPrompt;

      const settings = settingsRef.current;
      const isStackingEnabled = settings.enableTextStacking !== false;

      if (!isStackingEnabled) {
        const reactionCtx = pendingReactionContextsRef.current[chatId];
        delete pendingReactionContextsRef.current[chatId];
        
        const scheduleContext = buildScheduleContext(targetChat);
        const combinedContexts = combinePersonaContexts(scheduleContext, reactionContext(reactionCtx, false));

        if (targetChat.isGroup) {
          handleGroupResponse(targetChat, targetChat.messages, combinedContexts);
        } else {
          handleSingleResponse(targetChat, targetChat.messages, combinedContexts, false, `[Reacted ${emoji}]`);
        }
      } else {
        // Stacking rule: debounce / pool with other messages, images, audio, or reactions
        if (aiResponseTimeoutsRef.current[chatId]) {
          clearTimeout(aiResponseTimeoutsRef.current[chatId]);
        }

        const isOnlineSession = targetChat.status === 'online';
        const delaySeconds = isOnlineSession
          ? Math.min(settings.textStackingDelay || 10, 4)
          : (settings.textStackingDelay || 10);

        aiResponseTimeoutsRef.current[chatId] = window.setTimeout(async () => {
          delete aiResponseTimeoutsRef.current[chatId];
          markUserMessagesDelivered(chatId);

          const checkBusyAndTrigger = async () => {
            if (aiRespondingChatsRef.current.has(chatId)) {
              aiResponseTimeoutsRef.current[chatId] = window.setTimeout(checkBusyAndTrigger, 1000);
              return;
            }

            const freshChat = chatsRef.current.find(c => c.id === chatId);
            if (!freshChat) return;

            aiRespondingChatsRef.current.add(chatId);
            try {
              const reactionCtx = pendingReactionContextsRef.current[chatId];
              delete pendingReactionContextsRef.current[chatId];
              const savedTimeGap = pendingTimeGapsRef.current[chatId];
              delete pendingTimeGapsRef.current[chatId];

              const lastAiMsgIdx = [...freshChat.messages].reverse().findIndex(m => m.sender === 'other');
              const userStackMessages = lastAiMsgIdx === -1
                ? freshChat.messages
                : freshChat.messages.slice(freshChat.messages.length - lastAiMsgIdx);
              
              const combinedText = userStackMessages.map(m => m.text).filter(Boolean).join(' ');
              const hasImgReq = userStackMessages.some(m => m.isImageRequest);

              const memoryContext = buildMemoryRecallContext(freshChat, combinedText);
              const scheduleContext = buildScheduleContext(freshChat);
              const combinedContexts = combinePersonaContexts(memoryContext, scheduleContext, savedTimeGap, reactionContext(reactionCtx, userStackMessages.some(m => m.sender === 'me' && !m.isEvent && !m.isDeleted)));

              if (freshChat.isGroup) {
                await handleGroupResponse(freshChat, freshChat.messages, combinedContexts);
              } else {
                await handleSingleResponse(freshChat, freshChat.messages, combinedContexts, hasImgReq, combinedText || `[Reacted ${emoji}]`);
              }
            } finally {
              aiRespondingChatsRef.current.delete(chatId);
            }
          };

          checkBusyAndTrigger();
        }, delaySeconds * 1000);
      }
    }
  };

  const handleToggleStar = (chatId: string, messageId: string) => {
    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat;
      return {
        ...chat,
        messages: chat.messages.map(msg => {
          if (msg.id !== messageId) return msg;
          return {
            ...msg,
            isStarred: !msg.isStarred
          };
        })
      };
    }));
  };

  const handleSendPhotoToChat = async (targetChatId: string, fileData: string, caption?: string) => {
    const targetChat = chats.find(c => c.id === targetChatId);
    if (!targetChat) return;

    setActiveChatId(targetChatId);
    setActiveView('chat');

    const attachment: FileAttachment = {
      name: 'Photo',
      data: fileData,
      type: 'image'
    };

    await sendMessageToChat(targetChat, caption || '', attachment);
  };

  const handleSingleResponse = async (
    chat: Chat, 
    updatedHistory: Message[], 
    memoryContext?: string, 
    isImageRequest = false, 
    imagePromptText = '',
    isBackgroundReply = false
  ) => {
    const settings = settingsRef.current;
    if (callRef.current && callRef.current.snapshot.status !== 'ended') return;
    const chatId = chat.id;
    aiRespondingChatsRef.current.add(chatId);
    let replied = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    let deadline: number | undefined;
    let turnIds: string[] = [];
    let timedOut = false;
    let ownController: AbortController | undefined;
    const commitReply = (update: (previous: Chat[]) => Chat[]) => { if (timedOut) return; replied = true; clearTimeout(deadlineTimer); commitChatUpdate(update); };
    const isAlreadyOnline = chatsRef.current.find(c => c.id === chatId)?.status === 'online';
    const isFastOnlineChat = !!(settingsRef.current.enableDynamicOnlinePresence && isAlreadyOnline);
    try {
      const attempt = await beginPendingAttempt(chatId, updatedHistory, settings.enableTextStacking !== false);
      turnIds = attempt?.messageIds || [];
      deadline = attempt?.deadline;
      if (attempt) {
        updatedHistory = deliveryHistory(updatedHistory, turnIds);
        const prompts = updatedHistory.filter(message => turnIds.includes(message.id));
        isImageRequest = prompts.some(message => message.isImageRequest);
        imagePromptText = prompts.map(message => message.text).filter(Boolean).join(' ');
      }
      if (deadline !== undefined && deadline <= Date.now()) { timedOut = true; return; }
      // Hydrate history with media data immediately so background generation can begin
      const hydratedHistory = await prepareHydratedHistory(updatedHistory, chat.name);

      const checkImageReq = isImageRequest || (!attempt && updatedHistory.slice(-2).some(m => m.sender === 'me' && m.isImageRequest));

      // Check if user sent a voice note or if persona will respond with voice
      const lastUserMsg = [...updatedHistory].reverse().find(m => m.sender === 'me');
      const userSentVoiceNote = lastUserMsg?.attachment?.type === 'audio' || !!lastUserMsg?.voiceAttachment || !!lastUserMsg?.voiceMediaId;
      const isVoiceNote = shouldReplyWithVoiceNote(chat.voiceSettings, userSentVoiceNote);

      if (personaAbortControllersRef.current[chatId]) {
        personaAbortControllersRef.current[chatId].abort();
      }
      const abortController = new AbortController();
      ownController = abortController;
      personaAbortControllersRef.current[chatId] = abortController;
      if (deadline !== undefined) deadlineTimer = setTimeout(() => {
        if (replied || (callRef.current && callRef.current.snapshot.status !== 'ended') || personaAbortControllersRef.current[chatId] !== abortController) return;
        timedOut = true; abortController.abort();
      }, Math.max(0, deadline - Date.now()));

      const turnToken = Date.now();
      personaTurnTokensRef.current[chatId] = turnToken;

      // PIPELINED GENERATION: Eagerly launch LLM text & TTS audio synthesis in parallel with realistic visual presence delays
      const aiGenerationPromise = (!checkImageReq)
        ? (async () => {
            let resText = await getGeminiResponse(
              { ...chat },
              hydratedHistory,
              settings.shareUserInfo ? user : undefined,
              undefined,
              settings,
              memoryContext,
              isVoiceNote,
              chat.voiceSettings,
              abortController.signal,
              true
            );

            if (!resText || isRawErrorMessage(resText)) {
              throw new Error('REPLY_UNAVAILABLE');
            }

            let ttsResult: { ok: boolean; audioDataUrl?: string; error?: string } | null = null;
            if (isVoiceNote) {
              const voiceToUse = chat.voiceSettings?.voiceName || getPersonaDefaultVoice(chat);
              ttsResult = await generateGeminiVoiceNote(
                resText,
                voiceToUse,
                settings,
                {
                  name: chat.name,
                  speechStyle: chat.speechStyle,
                  language: chat.language,
                  role: chat.role
                },
                chat.voiceSettings,
                abortController.signal
              );
            }

            return { response: resText, ttsRes: ttsResult };
          })()
        : null;

      aiGenerationPromise?.catch(() => {});

      if (!isBackgroundReply) {
        // Step 1: Wait for natural delivery delay so single grey tick is clearly observed
        const hasUnreadSent = chatsRef.current.find(c => c.id === chatId)?.messages.some(m => m.sender === 'me' && m.status === 'sent');
        if (hasUnreadSent) {
          const deliveryWait = isFastOnlineChat ? (150 + Math.random() * 150) : (250 + Math.random() * 200);
          await new Promise(resolve => setTimeout(resolve, deliveryWait));
        }
        markUserMessagesDelivered(chatId, turnIds);

        // Step 2: Persona comes online after double grey ticks (1.8s - 2.5s)
        if (!isAlreadyOnline && !chat.isGroup) {
          const comeOnlineDelay = 250 + Math.random() * 200;
          await new Promise(resolve => setTimeout(resolve, comeOnlineDelay));
          setChatStatus(chatId, 'online');
        }

        // Step 3: "Seen" Delay Simulation (Persona opens chat thread, turning double grey ticks to blue)
        const seenDelay = isFastOnlineChat ? (200 + Math.random() * 200) : (250 + Math.random() * 200);
        await new Promise(resolve => setTimeout(resolve, seenDelay));
      } else {
        markUserMessagesDelivered(chatId, turnIds);
      }

      // Mark user messages as read (Blue ticks appear BEFORE reading & typing)
      markUserMessagesRead(chatId, turnIds);

      if (!isBackgroundReply) {
        // Step 4: Initial "Thinking / Reading" Delay before starting to type/record
        const thinkingDelay = isFastOnlineChat ? (300 + Math.random() * 300) : (250 + Math.random() * 200);
        await new Promise(resolve => setTimeout(resolve, thinkingDelay));
      } else {
        // Snappy reading pause that respects user's enableTextStacking setting
        const readingDelay = settings.enableTextStacking === false
          ? 300 + Math.random() * 300
          : 900 + Math.random() * 600;
        await new Promise(resolve => setTimeout(resolve, readingDelay));
      }

      // --- IN-CHAT IMAGE GENERATION PIPELINE ---
      if (checkImageReq) {
        setChatStatus(chatId, 'typing...');
        const userPrompt = imagePromptText || updatedHistory.slice().reverse().find(m => m.sender === 'me')?.text || 'Send me a photo';

        // Detect persona gender for prompt realism and pronoun alignment
        let personaGender: string | undefined;
        if (chat.voiceSettings?.voiceName && GEMINI_TTS_VOICE_DETAILS[chat.voiceSettings.voiceName]) {
          personaGender = GEMINI_TTS_VOICE_DETAILS[chat.voiceSettings.voiceName].gender;
        } else {
          const textToCheck = `${chat.name} ${chat.role || ''} ${chat.about || ''}`.toLowerCase();
          if (/\b(brother|bro|dad|father|boy|man|guy|boyfriend|husband|son|uncle|grandpa|grandfather)\b/.test(textToCheck)) {
            personaGender = 'male';
          } else if (/\b(sister|sis|mom|mother|girl|woman|lady|girlfriend|wife|daughter|aunt|grandma|grandmother)\b/.test(textToCheck)) {
            personaGender = 'female';
          }
        }

        // Step 1: Context & Caption Synthesizer
        const timeCtx = getAppTimeContext(settings);
        const synthRes = await synthesizeImageContextAndCaption(
          { ...chat },
          userPrompt,
          hydratedHistory,
          settings.shareUserInfo ? user : undefined,
          settings,
          timeCtx
        );

        if (synthRes.ok && synthRes.result) {
          const { mode, is_persona_subject, user_wants_posed, caption, action_and_setting } = synthRes.result;
          const isSubject = mode === 'selfie' || mode === 'candid' || (is_persona_subject && mode !== 'pov');

          let avatarBase64Data: string | undefined;
          let avatarMime: string | undefined;

          if (isSubject && chat.avatar) {
            const resolved = await resolveAvatarBase64(chat.avatar);
            if (resolved) {
              avatarBase64Data = resolved.data;
              avatarMime = resolved.mimeType;
            }
          }

          const personaImageModel = chat.imageModel || settings.selectedImageModel || DEFAULT_IMAGE_MODEL;

          // Step 2: Image Generation Call
          const imgRes = await generatePersonaImage({
            model: personaImageModel,
            mode,
            is_persona_subject: isSubject,
            user_wants_posed,
            action_and_setting,
            userRequest: userPrompt,
            avatarBase64: avatarBase64Data,
            avatarMimeType: avatarMime,
            avatarUrl: chat.avatar,
            settings,
            personaGender,
            personaName: chat.name,
            personaRole: chat.role,
          });

          if (imgRes.ok && imgRes.imageDataUrl) {
            const mediaId = `media-${Date.now()}`;
            try {
              await saveMedia(mediaId, imgRes.imageDataUrl);
            } catch (err) {
              console.error("Failed to save generated image to IndexedDB", err);
            }

            // Realistic photo sending delay (1.8s - 2.5s)
            const photoSendDelay = 250 + Math.random() * 200;
            await new Promise(resolve => setTimeout(resolve, photoSendDelay));

            const aiMsg: Message = {
              id: `${Date.now()}-img`,
              text: caption,
              sender: 'other',
          responseToMessageId: updatedHistory.filter(message => message.sender === 'me').at(-1)?.id,
              senderName: chat.name,
              date: getDateKey(),
              timestamp: getFormattedTime(),
              timestampEpoch: Date.now(),
              status: 'delivered',
              attachment: {
                name: 'Photo',
                data: '',
                type: 'image',
                mediaId,
              },
              mediaId,
            };

            commitReply(prev => prev.map(c => {
              if (c.id === chatId) {
                return {
                  ...c,
                  messages: [...c.messages, aiMsg],
                  lastMessage: '📷 ' + caption,
                  lastMessageTime: aiMsg.timestamp,
                  unreadCount: (c.unreadCount || 0) + 1,
                };
              }
              return c;
            }));

            playIncomingMessageSound();

            const isFocusingChat = !document.hidden && activeChatId === chat.id;
            if (settings.enableNotifications && !isFocusingChat) {
              if (document.hidden) {
                document.title = `(1) New Photo - ${chat.name}`;
              }
              showNotification(chat.name, {
                body: '📷 ' + caption,
                icon: chat.avatar,
                tag: chat.id,
                silentUpdate: false,
                data: buildNotificationPersonaData(chat, userRef.current, settingsRef.current)
              });
            }

            setChatStatus(chatId, 'online');
            schedulePersonaOffline(chatId);
            return;
          }
        }

        throw new Error('PHOTO_UNAVAILABLE');
      }

      // Display authentic active status
      if (!isVoiceNote) {
        setChatStatus(chatId, 'typing...');
      } else {
        setChatStatus(chatId, 'recording audio...' as any);
      }

      // Provider requests already have bounded timeouts; do not race slow TTS with a fake reply.
      const aiResult = aiGenerationPromise ? await aiGenerationPromise : null;

      // 1. Immediately disarm status watchdog since generation is complete
      if (personaStatusWatchdogTimersRef.current[chatId]) {
        clearTimeout(personaStatusWatchdogTimersRef.current[chatId]);
        delete personaStatusWatchdogTimersRef.current[chatId];
      }

      // 2. TURN GUARD: If watchdog already tripped and handled this turn, or turn was cancelled, discard late response!
      if (personaTurnTokensRef.current[chatId] !== turnToken || abortController.signal.aborted) {
        console.warn(`[Turn Guard] Response for ${chat.name} arrived after turn was cancelled/timed out. Discarding to prevent double reply.`);
        return;
      }

      let response = aiResult?.response || '';
      const ttsRes = aiResult?.ttsRes;

      if (!response || isRawErrorMessage(response)) {
        throw new Error('REPLY_UNAVAILABLE');
      }

      if (isVoiceNote) {
        if (ttsRes && ttsRes.ok && ttsRes.audioDataUrl) {
          const mediaId = `media-${Date.now()}`;
          try {
            await saveMedia(mediaId, ttsRes.audioDataUrl);
          } catch (err) {
            console.error("Failed to save voice note to IndexedDB", err);
          }

          const cleanedTranscript = cleanSpokenTranscript(response);

          // Simulated realistic delay for finishing voice note (1.0s - 1.8s)
          const recordingDelay = 1000 + Math.random() * 800;
          await new Promise(resolve => setTimeout(resolve, recordingDelay));

          if (personaTurnTokensRef.current[chatId] !== turnToken || abortController.signal.aborted) {
            console.warn(`[Turn Guard] Voice note for ${chat.name} arrived after turn was cancelled. Discarding.`);
            return;
          }

          const aiMsg: Message = {
            id: `${Date.now()}-vn`,
            text: cleanedTranscript,
            sender: 'other',
          responseToMessageId: updatedHistory.filter(message => message.sender === 'me').at(-1)?.id,
            senderName: chat.name,
            date: getDateKey(),
            timestamp: getFormattedTime(),
            timestampEpoch: Date.now(),
            status: 'delivered',
            attachment: {
              name: 'Voice Note',
              data: '',
              type: 'audio',
              mediaId
            },
            mediaId
          };

          commitReply(prev => prev.map(c => {
            if (c.id === chatId) {
              return {
                ...c,
                messages: [...c.messages, aiMsg],
                lastMessage: '🎤 Voice message',
                lastMessageTime: aiMsg.timestamp,
                unreadCount: (c.unreadCount || 0) + 1
              };
            }
            return c;
          }));

          playIncomingMessageSound();

          const isFocusingChat = !document.hidden && activeChatId === chat.id;
          if (settings.enableNotifications && !isFocusingChat) {
            if (document.hidden) {
              document.title = `(1) New Voice Message - ${chat.name}`;
            }
            showNotification(chat.name, {
              body: '🎤 Voice message',
              icon: chat.avatar,
              tag: chat.id,
              silentUpdate: false,
              data: buildNotificationPersonaData(chat, userRef.current, settingsRef.current)
            });
          }

          setChatStatus(chatId, 'online');
          schedulePersonaOffline(chatId);
          return;
        } else {
          console.warn("TTS generation failed, falling back to clean text response:", ttsRes?.error);
        }
      }

      const cleanedResponse = cleanSpokenTranscript(response);
      const chunks = splitMessage(cleanedResponse);

      for (let i = 0; i < chunks.length; i++) {
        if (personaTurnTokensRef.current[chatId] !== turnToken || abortController.signal.aborted) {
          return;
        }

        const chunk = chunks[i];

        setChatStatus(chatId, 'typing...');

        // Brief typing cue; network time already provides most of the wait.
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, fragmentTypingDelay(chunk)));
        } else if (!isBackgroundReply) {
          const typingDuration = isFastOnlineChat
            ? Math.min(Math.max(chunk.length * 8, 200), 600)
            : 250 + Math.random() * 200;
          await new Promise(resolve => setTimeout(resolve, typingDuration));
        } else {
          // Snappy, realistic typing duration so user is never bored waiting
          const typingDuration = settings.enableTextStacking === false
            ? Math.min(Math.max(chunk.length * 10, 300), 800)
            : Math.min(Math.max(chunk.length * 16, 500), 1500);
          await new Promise(resolve => setTimeout(resolve, typingDuration));
        }

        if (personaTurnTokensRef.current[chatId] !== turnToken || abortController.signal.aborted) {
          return;
        }

        const aiMsg: Message = {
          id: `${Date.now()}-${i}`,
          text: chunk,
          sender: 'other',
          responseToMessageId: updatedHistory.filter(message => message.sender === 'me').at(-1)?.id,
          senderName: chat.name,
          date: getDateKey(),
          timestamp: getFormattedTime(),
          timestampEpoch: Date.now(),
          status: 'delivered'
        };

        commitReply(prev => prev.map(c => {
          if (c.id === chatId) {
            return {
              ...c,
              messages: [...c.messages, aiMsg],
              lastMessage: chunk,
              lastMessageTime: aiMsg.timestamp,
              unreadCount: (c.unreadCount || 0) + 1
            };
          }
          return c;
        }));

        const isFirstChunkOfTurn = (i === 0);
        if (isFirstChunkOfTurn) {
          playIncomingMessageSound();
        }

        const isFocusingChat = !document.hidden && activeChatId === chat.id;
        if (settings.enableNotifications && (!isFocusingChat || isBackgroundReply)) {
          if (document.hidden) {
            document.title = `(1) New Message - ${chat.name}`;
          }
          showNotification(chat.name, {
            body: notificationConversation('', chunks.slice(0, i + 1).join('\n\n')),
            icon: chat.avatar,
            tag: chat.id,
            silentUpdate: !isFirstChunkOfTurn,
            data: buildNotificationPersonaData(chat, userRef.current, settingsRef.current)
          });
        }

        // Brief online beat, followed by the next fragment's visible typing cue.
        if (i < chunks.length - 1) {
          if (!isBackgroundReply) {
            setChatStatus(chatId, 'online');
            const interDelay = 150 + Math.random() * 100;
            await new Promise(resolve => setTimeout(resolve, interDelay));
          } else {
            const interPause = 150 + Math.random() * 100;
            await new Promise(resolve => setTimeout(resolve, interPause));
          }
        }
      }

      setChatStatus(chatId, 'online');
      schedulePersonaOffline(chatId);
    } catch (error) {
      console.error("Error getting AI response for single chat:", error);
    } finally {
      clearTimeout(deadlineTimer);
      if (callRef.current && callRef.current.snapshot.status !== 'ended') { aiRespondingChatsRef.current.delete(chatId); return; }
      if (ownController && personaAbortControllersRef.current[chatId] && personaAbortControllersRef.current[chatId] !== ownController) return;
      if (replied) await completeQueuedTurn(chatId, turnIds);
      else await failQueuedTurn(chat, turnIds);
      clearChatActiveStatus(chatId);
      aiRespondingChatsRef.current.delete(chatId);
      schedulePersonaOffline(chatId);
      delete personaAbortControllersRef.current[chatId];
    }
  };

  const handleGroupResponse = async (
    group: Chat, 
    updatedHistory: Message[], 
    memoryContext?: string,
    isBackgroundReply = false
  ) => {
    const settings = settingsRef.current;
    if (callRef.current && callRef.current.snapshot.status !== 'ended') return;
    if (!group.memberIds?.length) return;
    aiRespondingChatsRef.current.add(group.id);
    const attempt = await beginPendingAttempt(group.id, updatedHistory, settings.enableTextStacking !== false);
    const deadline = attempt?.deadline;
    const turnIds = attempt?.messageIds || [];
    if (attempt) updatedHistory = deliveryHistory(updatedHistory, turnIds);
    let replied = false;
    let timedOut = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const commitReply = (update: (previous: Chat[]) => Chat[]) => { if (timedOut) return; replied = true; clearTimeout(deadlineTimer); commitChatUpdate(update); };
    const memberIds = [...(group.memberIds || [])];
    if (memberIds.length === 0) return;
    aiRespondingChatsRef.current.add(group.id);

    const isGroupOnline = chatsRef.current.find(c => c.id === group.id)?.status === 'online';
    const isFastOnlineGroup = !!(settingsRef.current.enableDynamicOnlinePresence && isGroupOnline);

    if (!isBackgroundReply) {
      // 1. Natural delivery delay if any messages are still 'sent'
      const hasUnreadSent = chatsRef.current.find(c => c.id === group.id)?.messages.some(m => m.sender === 'me' && m.status === 'sent');
      if (hasUnreadSent) {
        const deliveryWait = isFastOnlineGroup ? (150 + Math.random() * 150) : (250 + Math.random() * 200);
        await new Promise(resolve => setTimeout(resolve, deliveryWait));
      }
      markUserMessagesDelivered(group.id, turnIds);
      // 2. Initial "Seen" Delay for the whole group (simulating someone opening the group)
      const initialSeenDelay = isFastOnlineGroup ? (200 + Math.random() * 200) : (250 + Math.random() * 200);
      await new Promise(resolve => setTimeout(resolve, initialSeenDelay));
    } else {
      markUserMessagesDelivered(group.id, turnIds);
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    // Mark user messages as read (Blue ticks)
    markUserMessagesRead(group.id, turnIds);

    let responseSequence = [...memberIds].sort(() => Math.random() - 0.5);

    if (Math.random() < 0.2) {
      const extraResponderId = memberIds[Math.floor(Math.random() * memberIds.length)];
      const insertIdx = Math.floor(Math.random() * (responseSequence.length + 1));
      responseSequence.splice(insertIdx, 0, extraResponderId);
    }

    let currentHistory = [...updatedHistory];

    for (let i = 0; i < responseSequence.length; i++) {
      if (callRef.current && callRef.current.snapshot.status !== 'ended') break;
      if (deadline !== undefined && Date.now() >= deadline) break;
      const responderId = responseSequence[i];
      const persona = chats.find(c => c.id === responderId);
      if (!persona) continue;

      try {
        if (!isBackgroundReply) {
          // 2. Persona-specific thinking/readiness delay (1.8s - 2.5s)
          const delay = 250 + Math.random() * 200;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          const groupDelay = settings.enableTextStacking === false
            ? 300 + Math.random() * 300
            : 800 + Math.random() * 500;
          await new Promise(resolve => setTimeout(resolve, groupDelay));
        }

        setChatStatus(group.id, 'typing...');

        // Hydrate group history with media data from IndexedDB
        const hydratedGroupHistory = await prepareHydratedHistory(currentHistory, group.name);

        const lastUserMsg = [...currentHistory].reverse().find(m => m.sender === 'me');
        const userSentVoiceNote = lastUserMsg?.attachment?.type === 'audio' || !!lastUserMsg?.voiceAttachment || !!lastUserMsg?.voiceMediaId;
        const isVoiceNote = shouldReplyWithVoiceNote(persona.voiceSettings, userSentVoiceNote);

        if (personaAbortControllersRef.current[group.id]) {
          personaAbortControllersRef.current[group.id].abort();
        }
        const abortController = new AbortController();
        personaAbortControllersRef.current[group.id] = abortController;
        if (deadline !== undefined && !replied) deadlineTimer = setTimeout(() => {
          if (callRef.current && callRef.current.snapshot.status !== 'ended') return;
          timedOut = true; abortController.abort();
        }, Math.max(0, deadline - Date.now()));

        const turnToken = Date.now();
        personaTurnTokensRef.current[group.id] = turnToken;

        let responseText = await getGeminiResponse(
            { ...persona },
            hydratedGroupHistory,
            settings.shareUserInfo ? user : undefined,
            {
              groupName: group.name,
              otherMembers: group.memberIds?.filter(id => id !== responderId).map(id => chats.find(c => c.id === id)?.name || '') || []
            },
            settings,
            combinePersonaContexts(memoryContext, buildScheduleContext(persona)),
            isVoiceNote,
            persona.voiceSettings,
            abortController.signal,
            true
          );

        if (personaStatusWatchdogTimersRef.current[group.id]) {
          clearTimeout(personaStatusWatchdogTimersRef.current[group.id]);
          delete personaStatusWatchdogTimersRef.current[group.id];
        }

        if (personaTurnTokensRef.current[group.id] !== turnToken || abortController.signal.aborted) {
          console.warn(`[Turn Guard] Group response for ${persona.name} arrived after turn was cancelled/timed out. Discarding.`);
          continue;
        }

        if (!responseText || isRawErrorMessage(responseText)) {
          throw new Error('REPLY_UNAVAILABLE');
        }

        if (isVoiceNote) {
          setChatStatus(group.id, 'recording audio...' as any);
          const voiceToUse = persona.voiceSettings?.voiceName || getPersonaDefaultVoice(persona);
          const ttsRes = await generateGeminiVoiceNote(
            responseText,
            voiceToUse,
            settings,
            {
              name: persona.name,
              speechStyle: persona.speechStyle,
              language: persona.language,
              role: persona.role
            },
            persona.voiceSettings,
            abortController.signal
          );

          if (ttsRes.ok && ttsRes.audioDataUrl) {
            const mediaId = `media-${Date.now()}`;
            try {
              await saveMedia(mediaId, ttsRes.audioDataUrl);
            } catch (err) {
              console.error("Failed to save group voice note to IndexedDB", err);
            }

            const cleanedTranscript = cleanSpokenTranscript(responseText);
            const recordingDelay = Math.min(Math.max(cleanedTranscript.length * 25, 2000), 5000);
            await new Promise(resolve => setTimeout(resolve, recordingDelay));

            if (personaTurnTokensRef.current[group.id] !== turnToken || abortController.signal.aborted) {
              console.warn(`[Turn Guard] Group voice note for ${persona.name} arrived after turn was cancelled. Discarding.`);
              continue;
            }

            const aiMsg: Message = {
              id: `${Date.now()}-${i}-vn`,
              text: cleanedTranscript,
              sender: 'other',
          responseToMessageId: updatedHistory.filter(message => message.sender === 'me').at(-1)?.id,
              senderName: persona.name,
              senderId: persona.id,
              date: getDateKey(),
              timestamp: getFormattedTime(),
              timestampEpoch: Date.now(),
              status: 'delivered',
              attachment: {
                name: 'Voice Note',
                data: '',
                type: 'audio',
                mediaId
              },
              mediaId
            };

            currentHistory.push(aiMsg);

            commitReply(prev => prev.map(c => {
              if (c.id === group.id) {
                return {
                  ...c,
                  messages: [...c.messages, aiMsg],
                  lastMessage: `${persona.name}: 🎤 Voice message`,
                  lastMessageTime: aiMsg.timestamp,
                  unreadCount: (c.unreadCount || 0) + 1
                };
              }
              return c;
            }));

            playIncomingMessageSound();
            continue;
          } else {
            console.warn("Group persona TTS generation failed, falling back to clean text:", ttsRes.error);
          }
        }

        const cleanedResponse = cleanSpokenTranscript(responseText);
        const chunks = splitMessage(cleanedResponse);

        for (let j = 0; j < chunks.length; j++) {
          if (personaTurnTokensRef.current[group.id] !== turnToken || abortController.signal.aborted) {
            break;
          }

          const chunk = chunks[j];

          setChatStatus(group.id, 'typing...');
          if (j > 0) {
            await new Promise(resolve => setTimeout(resolve, fragmentTypingDelay(chunk)));
          } else if (!isBackgroundReply) {
            const typingDuration = 250 + Math.random() * 200;
            await new Promise(resolve => setTimeout(resolve, typingDuration));
          } else {
            const typingDuration = settings.enableTextStacking === false
              ? Math.min(Math.max(chunk.length * 10, 300), 800)
              : Math.min(Math.max(chunk.length * 16, 500), 1500);
            await new Promise(resolve => setTimeout(resolve, typingDuration));
          }

          if (personaTurnTokensRef.current[group.id] !== turnToken || abortController.signal.aborted) {
            break;
          }

          const aiMsg: Message = {
            id: `${Date.now()}-${i}-${j}`,
            text: chunk,
            sender: 'other',
          responseToMessageId: updatedHistory.filter(message => message.sender === 'me').at(-1)?.id,
            senderName: persona.name,
            senderId: persona.id,
            date: getDateKey(),
            timestamp: getFormattedTime(),
            timestampEpoch: Date.now(),
            status: 'delivered'
          };

          currentHistory.push(aiMsg);

          commitReply(prev => prev.map(c => {
            if (c.id === group.id) {
              return {
                ...c,
                messages: [...c.messages, aiMsg],
                lastMessage: `${persona.name}: ${chunk}`,
                lastMessageTime: aiMsg.timestamp,
                unreadCount: (c.unreadCount || 0) + 1
              };
            }
            return c;
          }));

          const isFirstChunkOfTurn = (j === 0);
          if (isFirstChunkOfTurn) {
            playIncomingMessageSound();
          }

          const isFocusingChat = !document.hidden && activeChatId === group.id;
          if (settings.enableNotifications && (!isFocusingChat || isBackgroundReply)) {
            const personaLabel = chats.find(c => c.id === responderId)?.name || 'Group Member';
            const personaAvatar = chats.find(c => c.id === responderId)?.avatar || group.avatar;
            if (document.hidden) {
              document.title = `(1) New Message - ${group.name}`;
            }
            showNotification(`${group.name} - ${personaLabel}`, {
              body: notificationConversation('', chunks.slice(0, j + 1).join('\n\n')),
              icon: personaAvatar,
              tag: group.id,
              silentUpdate: !isFirstChunkOfTurn,
              data: { ...buildNotificationPersonaData(group, userRef.current, settingsRef.current), language: chats.find(contact => contact.id === responderId)?.language, languagePersonaId: responderId }
            });
          }

          if (j < chunks.length - 1) {
            if (!isBackgroundReply) {
              setChatStatus(group.id, 'online');
              const interDelay = 150 + Math.random() * 100;
              await new Promise(resolve => setTimeout(resolve, interDelay));
            } else {
              const interPause = 150 + Math.random() * 100;
              await new Promise(resolve => setTimeout(resolve, interPause));
            }
          }
        }

        setChatStatus(group.id, 'online');
        schedulePersonaOffline(group.id);
      } catch (error) {
        console.error(`Error getting AI response for group member ${responderId}:`, error);
      } finally {
        clearTimeout(deadlineTimer);
        clearChatActiveStatus(group.id);
        delete personaAbortControllersRef.current[group.id];
      }
    }
    
    if (replied) await completeQueuedTurn(group.id, turnIds);
    else if (!(callRef.current && callRef.current.snapshot.status !== 'ended')) await failQueuedTurn(group, turnIds);
    clearChatActiveStatus(group.id);
    aiRespondingChatsRef.current.delete(group.id);
    schedulePersonaOffline(group.id);
  };

  const handleChatSelect = (id: string) => {
    activeNotificationSoundChatsRef.current.delete(id);
    setActiveChatId(id);
    setChats(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));
    setShowProfilePanel(false);
    setShowNewChatPanel(false);
    setShowNewGroupPanel(false);
    setShowSettingsPopover(false);
    setShowGuide(false);
    setShowUpdates(false);
    setShowUserProfilePanel(false);
    setShowCalendarWidget(false);
    setChatSearchTerm('');
    setReplyingTo(null);
    setActiveView('chat');
    if (isMobile) {
      window.history.pushState({ view: 'chat' }, '');
    }
  };

  handleChatSelectRef.current = handleChatSelect;

  useEffect(() => {
    handleChatSelectRef.current = handleChatSelect;
    handleNotificationChatSelectGlobal = (id: string) => {
      handleChatSelect(id);
    };
    return () => {
      handleNotificationChatSelectGlobal = null;
    };
  }, []);

  // Sync background notification shade exchanges from IndexedDB into React chats state
  const reconcileBackgroundExchanges = React.useCallback(async () => {
    try {
      const exchanges = await getBackgroundExchanges();
      if (!exchanges || exchanges.length === 0) return;
      const pending = await getPendingMessages();

      const previous = chatsRef.current;
      let reconciled = previous;
      const saved = commitChatUpdate(prev => {
        let hasChanges = false;
        const updated = prev.map(chat => {
          const matchingExchanges = exchanges.filter(e => e.chatId === chat.id && (e.userMessage?.status !== 'failed' || pending.some(item => item.id === e.userMessage?.id && item.message.status === 'failed')));
          if (matchingExchanges.length === 0) return chat;

          const hasMarkAsRead = matchingExchanges.some(e => e.type === 'MARK_AS_READ');
          const existingIds = new Set(chat.messages.map(m => m.id));
          const newMessages: Message[] = [];

          for (const ex of matchingExchanges) {
            if (ex.userMessage && !existingIds.has(ex.userMessage.id)) {
              newMessages.push(ex.userMessage);
              existingIds.add(ex.userMessage.id);
            }
            if (ex.personaReplies) {
              for (const reply of ex.personaReplies) {
                if (!existingIds.has(reply.id)) {
                  newMessages.push(reply);
                  existingIds.add(reply.id);
                }
              }
            }
          }

          if (newMessages.length > 0 || hasMarkAsRead || matchingExchanges.some(ex => ex.userMessage?.status === 'failed' || ex.personaReplies?.length && chat.messages.some(m => m.id === ex.userMessage?.id && (m.status === 'pending' || m.status === 'failed')))) {
            hasChanges = true;
            const allMessages = [...chat.messages, ...newMessages].map(m => {
              const exchange = matchingExchanges.find(ex => ex.userMessage?.id === m.id);
              if (m.sender !== 'me' || !exchange) return m;
              return exchange.personaReplies?.length ? { ...m, status: 'sent' as MessageStatus }
                : exchange.userMessage?.status === 'failed' ? { ...m, status: 'failed' as MessageStatus, deliveryGroupId: exchange.userMessage.deliveryGroupId } : m;
            });
            const updatedMessages = hasMarkAsRead
              ? allMessages.map(m => m.status !== 'read' && !(m.sender === 'me' && (m.status === 'pending' || m.status === 'failed')) ? { ...m, status: 'read' as MessageStatus } : m)
              : allMessages;
            const lastMsg = updatedMessages[updatedMessages.length - 1];
            return {
              ...chat,
              unreadCount: hasMarkAsRead ? 0 : chat.unreadCount,
              lastMessage: lastMsg?.text || chat.lastMessage,
              lastMessageTime: lastMsg?.timestamp || chat.lastMessageTime,
              messages: updatedMessages
            };
          }
          return chat;
        });

        reconciled = hasChanges ? updated : prev;
        return reconciled;
      });

      if (saved) await clearBackgroundExchanges(exchanges.map(exchange => exchange.id));
    } catch (err) {
      console.warn('Reconcile background exchanges failed:', err);
    }
  }, []);

  // Flush queued messages when coming back online
  const offlineQueueFlushingRef = React.useRef(false);
  const flushOfflineQueue = React.useCallback(async () => {
    const currentSettings = settingsRef.current;
    if (callRef.current && callRef.current.snapshot.status !== 'ended') return;
    if ((currentSettings.aiProvider || 'vertex') === 'vertex' && !currentSettings.isVertexUnlocked) return;
    if (offlineQueueFlushingRef.current) return;
    offlineQueueFlushingRef.current = true;
    try {
      const pendingItems = (await getPendingMessages()).sort((a, b) => a.queuedAt - b.queuedAt);
      if (!pendingItems || pendingItems.length === 0) return;

      for (const chatId of new Set(pendingItems.map(item => item.chatId))) {
        if (aiRespondingChatsRef.current.has(chatId) || aiResponseTimeoutsRef.current[chatId]) continue;
        if (callRef.current?.chat.id === chatId && callRef.current.snapshot.status !== 'ended') continue;
        const targetChat = chatsRef.current.find(c => c.id === chatId);
        if (!targetChat) continue;
        const receipts = new Set(targetChat.messages.filter(message => message.sender === 'other').map(message => message.responseToMessageId));
        const answeredIds = new Set(pendingItems.filter(item => item.chatId === chatId && (receipts.has(item.id) || (item.message.deliveryGroupId && receipts.has(item.message.deliveryGroupId)))).map(item => item.id));
        if (answeredIds.size) await completeQueuedTurn(chatId, [...answeredIds]);
        const items = pendingDeliveryTurn(pendingItems.filter(item => item.chatId === chatId && !answeredIds.has(item.id)), currentSettings.enableTextStacking !== false);
        // The outbox is authoritative if suspension interrupted the UI status save.
        const failedItems = pendingItems.filter(item => item.chatId === chatId && item.message.status === 'failed' && !answeredIds.has(item.id));
        if (failedItems.some(item => targetChat.messages.find(message => message.id === item.id)?.status !== 'failed')) {
          commitChatUpdate(previous => previous.map(chat => chat.id !== chatId ? chat : { ...chat, messages: [
            ...chat.messages.map(message => {
              const failed = failedItems.find(item => item.id === message.id);
              return failed ? { ...message, status: 'failed' as MessageStatus, deliveryGroupId: failed.message.deliveryGroupId } : message;
            }),
            ...failedItems.filter(item => !chat.messages.some(message => message.id === item.id)).map(item => item.message)
          ] }));
        }
        if (!items.length) continue;
        if (items.some(item => (item.leaseUntil || 0) > Date.now())) continue;
        if (items.some(item => retryExpired(item))) {
          await failQueuedTurn(targetChat, items.map(item => item.id));
          continue;
        }
        if (!navigator.onLine || items.some(item => (item.nextAttemptAt || 0) > Date.now())) continue;
        const ids = new Set(targetChat.messages.map(m => m.id));
        const messages = [...targetChat.messages, ...items.filter(item => !ids.has(item.id)).map(item => item.message)];
        if (messages.length !== targetChat.messages.length) commitChatUpdate(previous => previous.map(chat => chat.id === chatId ? { ...chat, messages } : chat));
        const updatedMessages = deliveryHistory(messages, items.map(item => item.id));
        const last = items[items.length - 1].message;
        const combinedContexts = combinePersonaContexts(buildMemoryRecallContext(targetChat, last.text), buildScheduleContext(targetChat), getTimeGapAndFrequencyContext(updatedMessages, false, settingsRef.current, targetChat.timeAwarenessEnabled !== false));
        if (targetChat.isGroup) await handleGroupResponse(targetChat, updatedMessages, combinedContexts, true);
        else await handleSingleResponse(targetChat, updatedMessages, combinedContexts, last.isImageRequest, last.text, true);
      }
    } catch (e) {
      console.warn('Flush offline queue failed:', e);
    } finally {
      offlineQueueFlushingRef.current = false;
    }
  }, [settings]);

  const retryingMessagesRef = React.useRef(new Set<string>());
  const handleRetryMessage = async (chatId: string, messageId: string) => {
    const chat = chatsRef.current.find(chat => chat.id === chatId);
    const message = chat?.messages.find(message => message.id === messageId);
    if (!chat || message?.status !== 'failed' || retryingMessagesRef.current.has(chatId) || aiRespondingChatsRef.current.has(chatId) || (callRef.current && callRef.current.snapshot.status !== 'ended')) return;
    retryingMessagesRef.current.add(chatId);
    try {
      const messages = chat.messages.filter(item => item.sender === 'me' && item.status === 'failed' && !item.isDeleted && (message.deliveryGroupId ? item.deliveryGroupId === message.deliveryGroupId : item.id === messageId));
      const pending = await getPendingMessages();
      if (pending.some(item => messages.some(message => message.id === item.id) && (item.leaseUntil || 0) > Date.now())) return;
      // Older failed records may predate the durable outbox; preserve their original IDs/media.
      for (const item of messages) if (!pending.some(queued => queued.id === item.id)) await enqueuePendingMessage(chatId, item);
      const ids = messages.map(message => message.id);
      await setPendingDeliveryStatus(chatId, ids, 'pending');
      commitChatUpdate(previous => previous.map(current => current.id !== chatId ? current : { ...current, messages: current.messages.map(item => ids.includes(item.id) ? { ...item, status: 'pending' as MessageStatus } : item) }));
      if (navigator.onLine) void flushOfflineQueue();
    } catch (error) { console.error('Could not retry message:', error); }
    finally { retryingMessagesRef.current.delete(chatId); }
  };

  useEffect(() => {
    if (navigator.onLine) flushOfflineQueue();
  }, [settings.isVertexUnlocked, settings.aiProvider, flushOfflineQueue]);

  // Online / Offline & Background Reconciliation Lifecycle
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineQueue();
      reconcileBackgroundExchanges();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    const retryTimer = window.setInterval(() => { void flushOfflineQueue(); }, 5000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial background reconciliation on mount
    reconcileBackgroundExchanges();

    // Reconcile whenever window becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reconcileBackgroundExchanges();
        if (navigator.onLine) {
          flushOfflineQueue();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(retryTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushOfflineQueue, reconcileBackgroundExchanges]);

  const handleBack = () => {
    // Instead of setActiveView, use history back to trigger popstate
    window.history.back();
  };

  const handleCreateGroup = (data: { name: string; avatar: string; memberIds: string[] }) => {
    const newGroup: Chat = {
      id: `group-${Date.now()}`,
      name: data.name,
      avatar: data.avatar,
      memberIds: data.memberIds,
      isGroup: true,
      lastMessage: 'Group created',
      lastMessageTime: getFormattedTime(),
      messages: [{
        id: 'init',
        text: `Welcome to ${data.name}! Members: ${data.memberIds.map(id => chatsRef.current.find(c => c.id === id)?.name || id).join(', ')}`,
        sender: 'other',
        senderName: 'System',
        date: getDateKey(),
        timestamp: '--',
        timestampEpoch: Date.now()
      }]
    };
    setChats(prev => [newGroup, ...prev]);
    setActiveChatId(newGroup.id);
    setShowNewGroupPanel(false);
  };

  const handleCreatePersona = (personaData: any) => {
    const newPersona: Chat = {
      ...personaData,
      id: Date.now().toString(),
      lastMessage: '',
      lastMessageTime: '',
      messages: [],
      status: 'offline',
    };
    setChats(prev => [newPersona, ...prev]);
    setActiveChatId(newPersona.id);
    setShowNewChatPanel(false);
  };

  const handleImportPersona = (personaData: any) => {
    const newPersona: Chat = {
      name: personaData.name,
      avatar: personaData.avatar || `https://picsum.photos/seed/${Math.random()}/200`,
      about: personaData.about || 'Hey there! I am using WhatsApp.',
      role: personaData.role || '',
      speechStyle: personaData.speechStyle || '',
      language: personaData.language || '',
      systemInstruction: personaData.systemInstruction || '',
      voiceSettings: personaData.voiceSettings,
      schedule: personaData.schedule,
      automation: personaData.automation,
      humaneSettings: personaData.humaneSettings,
      memoryBubbles: Array.isArray(personaData.memoryBubbles) ? personaData.memoryBubbles : [],
      memoryEnabled: personaData.memoryEnabled ?? true,
      timeAwarenessEnabled: personaData.timeAwarenessEnabled !== false,
      imageModel: personaData.imageModel,
      voiceModel: personaData.voiceModel,
      id: Date.now().toString(),
      lastMessage: '',
      lastMessageTime: '',
      messages: [],
      status: 'offline',
    };
    setChats(prev => [newPersona, ...prev]);
    setActiveChatId(newPersona.id);
    if (isMobile) {
      setActiveView('chat');
    }
    setShowSettingsPopover(false);
  };

  const updateActiveChat = (updates: Partial<Chat>) => {
    if (!activeChatId) return;
    if (updates.language !== undefined && 'caches' in window) {
      // Older notification cards and queued worker replies must use the latest saved preference.
      void caches.open('wassap-persona-settings').then(cache => cache.put(`/__persona_language/${encodeURIComponent(activeChatId)}`, new Response(JSON.stringify({ language: updates.language })))).catch(() => {});
    }
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, ...updates } : c));
  };

  const handleDeleteChat = () => {
    if (!activeChatId) return;
    if (activeChatId === '6') {
      alert("This is a permanent system chat and cannot be deleted.");
      return;
    }
    const targetChat = chatsRef.current.find(c => c.id === activeChatId);
    const endingCall = callRef.current?.chat.id === activeChatId ? callRef.current : null;
    endingCall?.end();
    void (endingCall?.whenSaved() || Promise.resolve()).then(() => getCalls()).then(records => Promise.all(records.filter(record => record.chatId === activeChatId).map(record => deleteCall(record.id)))).catch(() => {});
    if (targetChat) {
      for (const msg of targetChat.messages) {
        const mediaId = msg.mediaId || msg.attachment?.mediaId;
        if (mediaId) {
          deleteMedia(mediaId).catch(() => {});
        }
        const voiceMediaId = msg.voiceMediaId || msg.voiceAttachment?.mediaId;
        if (voiceMediaId) {
          deleteMedia(voiceMediaId).catch(() => {});
        }
      }
    }
    setChats(prev => prev.filter(c => c.id !== activeChatId));
    setActiveChatId('');
    setShowProfilePanel(false);
  };

  const handleClearChat = async (clearMemories: boolean = true) => {
    if (!activeChatId) return;
    if (callRef.current?.chat.id === activeChatId) { callRef.current.end(); await callRef.current.whenSaved().catch(() => {}); }
    await getCalls().then(records => Promise.all(records.filter(record => record.chatId === activeChatId).map(record => deleteCall(record.id)))).catch(() => {});
    const targetChat = chatsRef.current.find(c => c.id === activeChatId);
    if (targetChat) {
      for (const msg of targetChat.messages) {
        const mediaId = msg.mediaId || msg.attachment?.mediaId;
        if (mediaId) {
          deleteMedia(mediaId).catch(() => {});
        }
        const voiceMediaId = msg.voiceMediaId || msg.voiceAttachment?.mediaId;
        if (voiceMediaId) {
          deleteMedia(voiceMediaId).catch(() => {});
        }
      }
    }

    // Clean up offline data (pending outbox and unreconciled background exchanges)
    await clearOfflineDataForChat(activeChatId);

    // Cancel any active timeouts or pending gaps
    if (aiResponseTimeoutsRef.current[activeChatId]) {
      clearTimeout(aiResponseTimeoutsRef.current[activeChatId]);
      delete aiResponseTimeoutsRef.current[activeChatId];
    }
    if (leftOnReadTimeoutsRef.current[activeChatId]) {
      clearTimeout(leftOnReadTimeoutsRef.current[activeChatId]);
      delete leftOnReadTimeoutsRef.current[activeChatId];
    }
    cancelPersonaOfflineTimer(activeChatId);
    if (personaDeliveryTimersRef.current[activeChatId]) {
      clearTimeout(personaDeliveryTimersRef.current[activeChatId]);
      delete personaDeliveryTimersRef.current[activeChatId];
    }
    if (personaComingOnlineTimersRef.current[activeChatId]) {
      clearTimeout(personaComingOnlineTimersRef.current[activeChatId]);
      delete personaComingOnlineTimersRef.current[activeChatId];
    }
    delete pendingTimeGapsRef.current[activeChatId];
    aiRespondingChatsRef.current.delete(activeChatId);

    const updated = chatsRef.current.map(c => c.id === activeChatId ? {
      ...c,
      status: 'offline' as const,
      lastSeenTime: getFormattedTime(),
      messages: [],
      lastMessage: '',
      lastMessageTime: '',
      unreadCount: 0,
      memoryBubbles: clearMemories ? [] : c.memoryBubbles,
      memoryEnabled: clearMemories ? false : c.memoryEnabled
    } : c);

    setChats(updated);
    saveChatsNow(updated);
  };

  const handleDeleteMessages = async (chatId: string, messageIds: string[]) => {
    if (!messageIds || messageIds.length === 0) return;
    const targetChat = chatsRef.current.find(c => c.id === chatId);
    if (!targetChat) return;

    // Clean up media in IndexedDB
    for (const id of messageIds) {
      const msg = targetChat.messages.find(m => m.id === id);
      if (msg?.call) await deleteCall(msg.call.id).catch(() => {});
      const mediaId = msg?.mediaId || msg?.attachment?.mediaId;
      if (mediaId) {
        try {
          await deleteMedia(mediaId);
        } catch (e) {
          console.warn("Failed to delete media from IndexedDB:", e);
        }
      }
      const voiceMediaId = msg?.voiceMediaId || msg?.voiceAttachment?.mediaId;
      if (voiceMediaId) {
        try {
          await deleteMedia(voiceMediaId);
        } catch (e) {
          console.warn("Failed to delete voice media from IndexedDB:", e);
        }
      }
    }

    // Filter messages & recalculate lastMessage and lastMessageTime
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        const remaining = chat.messages.filter(m => !messageIds.includes(m.id));
        const lastMsg = remaining[remaining.length - 1];
        let newLastMessage = '';
        if (lastMsg) {
          const hasImg = lastMsg.attachment?.type === 'image' || !!lastMsg.image;
          const hasVoice = lastMsg.attachment?.type === 'audio' || !!lastMsg.voiceAttachment || !!lastMsg.voiceMediaId;
          if (hasImg && hasVoice) {
            newLastMessage = '📷 Photo + 🎤 Voice note';
          } else if (hasImg) {
            newLastMessage = '📷 Photo';
          } else if (lastMsg.attachment?.type === 'document') {
            newLastMessage = '📄 Document';
          } else if (hasVoice) {
            newLastMessage = '🎤 Voice message';
          } else {
            newLastMessage = lastMsg.text || '';
          }
        }
        return {
          ...chat,
          messages: remaining,
          lastMessage: newLastMessage,
          lastMessageTime: lastMsg ? (lastMsg.timestamp || '') : '',
        };
      }
      return chat;
    }));

    // Clear replyingTo if the replied-to message was among the deleted ones
    if (replyingTo && messageIds.includes(replyingTo.id)) {
      setReplyingTo(null);
    }
  };

  const processCallRecord = async (record: CallRecord) => {
    if (callRef.current && callRef.current.snapshot.status !== 'ended') return;
    if (pendingCallDiaries.current.has(record.id)) return;
    const chat = chatsRef.current.find(item => item.id === record.chatId);
    if (!chat) return;
    pendingCallDiaries.current.add(record.id);
    try {
      if (record.diary === 'none' && shouldSummarizeCall(record)) record = { ...record, diary: 'pending' };
      const epoch = record.startedAt;
      const timestamp = new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const date = getLocalDateKey(new Date(epoch));
      const withCall = chatsRef.current.map(item => {
        if (item.id !== record.chatId) return item;
        const existingMessage = item.messages.find(message => message.id === `call-${record.id}`);
        const transcript = existingMessage?.call?.transcript || (record.turns.length ? record.turns : undefined);
        const summary = existingMessage?.call?.summary || record.summary;
        const message: Message = { ...existingMessage, id: `call-${record.id}`, text: callHistoryText({ ...record, turns: transcript || [] }, item.name, summary), sender: 'me', date, timestamp, timestampEpoch: epoch,
          isEvent: true, eventTitle: `Voice call with ${item.name}`,
          call: { ...existingMessage?.call, id: record.id, duration: record.duration, outcome: record.outcome, diary: existingMessage?.call?.diary || record.diary,
            startedAt: record.startedAt, endedAt: record.endedAt, failureReason: record.failureReason, transcript, summary } };
        if (existingMessage) return { ...item, messages: item.messages.map(previous => previous.id === message.id ? message : previous) };
        const messages = [...item.messages];
        const index = messages.findIndex(existing => (existing.timestampEpoch || 0) > epoch);
        if (index < 0) messages.push(message); else messages.splice(index, 0, message);
        return { ...item, messages, ...(index < 0 ? { lastMessage: message.text.split('\n')[0], lastMessageTime: timestamp } : {}) };
      });
      if (!saveChatsNow(withCall)) throw new Error('Call history is waiting for storage space.');
      chatsRef.current = withCall;
      setChats(withCall);
      if (record.diary !== 'pending') {
        if (!record.finished || record.turns.length) await saveCall({ ...record, finished: true, turns: [] });
        return;
      }
      const existing = chat.memoryBubbles?.find(memory => memory.callId === record.id);
      if (!existing && !record.summary) {
        if (callRef.current && callRef.current.snapshot.status !== 'ended') return;
        const controller = new AbortController(); diaryControllers.current.set(record.id, controller);
        record = { ...record, summary: await generateCallSummary(record, chat, settingsRef.current, userRef.current, controller.signal) };
        if (!(await getCalls()).some(saved => saved.id === record.id)) return;
        await saveCall(record);
      }
      const now = new Date().toISOString();
      if (!(await getCalls()).some(saved => saved.id === record.id)) return;
      const updated = chatsRef.current.map(item => item.id !== record.chatId ? item : {
        ...item,
        memoryBubbles: item.memoryBubbles?.some(memory => memory.callId === record.id) ? item.memoryBubbles : [...(item.memoryBubbles || []), {
          id: `call-memory-${record.id}`, callId: record.id, chatId: item.id, title: `${item.name}'s Call Summary · ${date}`, startDate: date, endDate: date, summary: record.summary || existing!.summary, createdAt: now,
        }],
        messages: item.messages.map(message => message.call?.id === record.id ? { ...message,
          text: callHistoryText(record, item.name, record.summary || existing!.summary),
          call: { ...message.call, diary: 'saved' as const, summary: record.summary || existing!.summary } } : message),
      });
      if (!updated.some(item => item.id === record.chatId)) return;
      if (!saveChatsNow(updated)) throw new Error('Call diary is waiting for storage space.');
      chatsRef.current = updated;
      setChats(updated);
      await saveCall({ ...record, diary: 'saved', turns: [] });
    } catch {
      // The durable pending record is retried after reconnect/unlock or next startup.
    } finally { pendingCallDiaries.current.delete(record.id); diaryControllers.current.delete(record.id); }
  };

  const startPersonaCall = (chat: Chat) => {
    if (chat.isGroup) return;
    if (callRef.current && callRef.current.snapshot.status !== 'ended') { window.dispatchEvent(new CustomEvent('wassap:call-open')); return; }
    const currentSettings = settingsRef.current;
    if ((currentSettings.aiProvider || 'vertex') === 'vertex' ? !currentSettings.isVertexUnlocked : !currentSettings.apiKey?.trim()) {
      setShowSettingsPopover(true);
      return;
    }
    const call = new PersonaCall(chat, settingsRef.current, userRef.current, record => {
      void call.whenSaved().then(() => {
        void getCalls().then(records => records.forEach(saved => { void processCallRecord(saved); }));
        return reconcileBackgroundExchanges();
      }).then(() => flushOfflineQueue()).catch(() => {});
    });
    callRef.current = call;
    diaryControllers.current.forEach(controller => controller.abort());
    Object.keys(personaAbortControllersRef.current).forEach(id => personaAbortControllersRef.current[id]?.abort());
    Object.keys(aiResponseTimeoutsRef.current).forEach(id => clearTimeout(aiResponseTimeoutsRef.current[id]));
    aiResponseTimeoutsRef.current = {};

    setCallSession(call);
    void call.start();
  };

  useEffect(() => {
    const recover = () => { void getCalls().then(async records => {
      let active: any;
      try { const response = await (await caches.open('wassap-call-control')).match('/__call_active'); active = response && await response.json(); } catch {}
      const lockHeld = navigator.locks ? (await navigator.locks.query()).held?.some(lock => lock.name === 'wassap-persona-call') : false;
      for (const record of records) {
        if (record.id === callRef.current?.id && callRef.current.snapshot.status !== 'ended') continue;
        if (!record.finished && active?.callId === record.id && active.expiresAt > Date.now()) continue;
        if (!record.finished && lockHeld) continue;
        void processCallRecord(record);
      }
    }).catch(() => {}); };
    recover();
    window.addEventListener('online', recover);
    const timer = window.setTimeout(recover, 50000);
    return () => { window.removeEventListener('online', recover); window.clearTimeout(timer); };
  }, [settings.isVertexUnlocked, settings.apiKey, settings.aiProvider]);

  return (
    <div className="app-shell w-full flex flex-col bg-[#f0f2f5] dark:bg-[#0b1014] overflow-hidden p-0">
      {/* Top Title Bar */}
      <div className="hidden md:flex h-[30px] app-panel items-center px-3 gap-2 shrink-0 border-b app-border select-none">
        <div className="bg-[#21c063] p-[2px] rounded flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="white">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.767 5.767 0 1.267.405 2.436 1.096 3.389l-.711 2.597 2.659-.697a5.733 5.733 0 0 0 2.723.678c3.181 0 5.767-2.586 5.767-5.767 0-3.181-2.586-5.767-5.767-5.767zm3.39 8.136c-.147.414-.733.754-1.011.802-.278.048-.543.085-1.545-.303-1.002-.387-1.649-1.398-1.698-1.464-.048-.066-.401-.532-.401-1.022 0-.49.255-.731.345-.83.09-.099.198-.122.264-.122.066 0 .132.001.189.004.057.002.132-.023.208.156.075.18.255.621.28.669.024.047.04.103.01.16-.03.057-.045.094-.09.146-.045.052-.094.113-.137.151-.047.042-.094.085-.042.174.052.09.231.382.495.617.34.303.623.396.711.439.088.042.141.033.193-.028.052-.061.222-.259.283-.349.061-.088.122-.075.208-.042.085.033.543.255.637.302.094.047.156.071.18.113.023.042.023.245-.124.659zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
          </svg>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden bg-white dark:bg-[#0b1014] relative">
        <div className={`hidden md:block`}>
          <Sidebar
            userAvatar={user.avatar}
            unreadCount={unreadTotal}
            onUserProfileClick={() => setShowUserProfilePanel(!showUserProfilePanel)}
            onSettingsClick={() => setShowSettingsPopover(!showSettingsPopover)}
            onCalendarClick={() => setShowCalendarWidget(!showCalendarWidget)}
            onGuideClick={() => setShowGuide(true)}
            onUpdatesClick={() => setShowUpdates(true)}
          />
        </div>

        <React.Suspense fallback={<PanelLoadingFallback />}>
          {showSettingsPopover && (
            <SettingsPopover
              settings={settings}
              onUpdate={setSettings}
              onClose={() => setShowSettingsPopover(false)}
              onImportPersona={handleImportPersona}
              onTestNotification={async () => {
                playIncomingMessageSound();
                const testChat = chats[0];
                const senderName = testChat ? testChat.name : 'Wassap Notification';
                const avatar = testChat ? testChat.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
                const targetId = testChat ? testChat.id : '1';

                await showNotification(senderName, {
                  body: 'Desktop and Mobile notifications are working perfectly! Tap to open this chat.',
                  icon: avatar,
                  badge: '/badge.svg',
                  tag: targetId,
                  data: testChat ? buildNotificationPersonaData(testChat, userRef.current, settingsRef.current) : { chatId: targetId }
                });
              }}
            />
          )}

          {showCalendarWidget && (
            <CalendarNotesWidget
              notes={settings.calendarNotes || ''}
              onUpdateNotes={(notes) => setSettings({ ...settings, calendarNotes: notes })}
              onClose={() => setShowCalendarWidget(false)}
              settings={settings}
            />
          )}
        </React.Suspense>

        <div inert={mobilePanelOpen || (isMobile && activeView !== 'list')} className={`mobile-screen mobile-inbox ${activeView === 'list' ? 'screen-active' : ''} flex w-full md:w-[410px] shrink-0 flex-col h-full`}>
          <ChatList
            chats={chats}
            activeChatId={activeChatId}
            onChatSelect={handleChatSelect}
            onSetChatFlags={(ids, flags) => {
              const selected = new Set(ids);
              setChats(previous => previous.map(chat => selected.has(chat.id) ? { ...chat, ...flags } : chat));
            }}
            onAddPersona={() => setShowNewChatPanel(true)}
            onAddGroup={() => setShowNewGroupPanel(true)}
            onOpenSettings={() => setShowSettingsPopover(true)}
            onProfileClick={() => setShowUserProfilePanel(true)}
            onCalendarClick={() => setShowCalendarWidget(true)}
            onSendPhotoToChat={handleSendPhotoToChat}
            onMetaAIClick={() => handleChatSelect('6')}
            isMobile={isMobile}
            isActive={!isMobile || activeView === 'list'}
          />
          {isMobile && <MobileNavigation unreadCount={unreadTotal} onGuideClick={() => setShowGuide(true)} onUpdatesClick={() => setShowUpdates(true)} onSettingsClick={() => setShowSettingsPopover(true)} />}
        </div>

        <div inert={mobilePanelOpen || (isMobile && activeView !== 'chat')} className={`mobile-screen mobile-conversation ${activeView === 'chat' ? 'screen-active' : ''} flex flex-1 min-h-0 flex-col min-w-0 relative overflow-hidden app-chat-bg`}>
          <ChatWallpaper settings={settings} />
          <ChatWindow
            chat={activeChat}
            onCall={() => { if (activeChat) startPersonaCall(activeChat); }}
            allChats={chats}
            userProfile={user}
            onHeaderClick={() => setShowProfilePanel(true)}
            onDeleteChat={handleDeleteChat}
            onClearChat={handleClearChat}
            onToggleArchive={() => {
              if (!activeChat) return;
              const archiving = !activeChat.archived;
              setChats(previous => previous.map(chat => chat.id === activeChat.id ? { ...chat, archived: archiving } : chat));
              if (isMobile && archiving) handleBack();
            }}
            searchTerm={chatSearchTerm}
            setSearchTerm={setChatSearchTerm}
            onBack={isMobile ? handleBack : undefined}
            onProfileClick={() => setShowUserProfilePanel(true)}
            onMetaAIClick={() => handleChatSelect('6')}
            onAddContact={() => setShowNewChatPanel(true)}
            onReply={setReplyingTo}
            onRetryMessage={handleRetryMessage}
            retryDisabled={!!callSession || (activeChat ? isBusyChatStatus(activeChat.status) : false)}
            onSaveMemory={handleSaveMemory}
            onDeleteMessages={handleDeleteMessages}
            onMarkAsRead={handleMarkAsRead}
            onToggleReaction={handleToggleReaction}
            onToggleStar={handleToggleStar}
            settings={settings}
          />
          {activeChat && (!isMobile || !showProfilePanel) && (
            <MessageInput
              activeChatId={activeChatId}
              chatName={activeChat?.name}
              onSendMessage={handleSendMessage}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              settings={settings}
              onOpenSettings={() => setShowSettingsPopover(true)}
            />
          )}
        </div>

        <React.Suspense fallback={<PanelLoadingFallback />}>
          {showProfilePanel && activeChat && (
            <ProfilePanel
              closing={profileClosing}
              chat={chats.find(c => c.id === activeChatId)!}
              allChats={chats}
              settings={settings}
              onClose={closeProfilePanel}
              onUpdate={updateActiveChat}
              onDeleteChat={handleDeleteChat}
              onClearChat={handleClearChat}
              onRefreshPersona={handleRefreshPersona}
              onTestAutomation={(chatId, type, contextOverride) => {
                setShowProfilePanel(false);
                const customContext = type === 'inactivity'
                  ? `[MANUAL TEST] Perform an inactivity check-in now.`
                  : `[MANUAL TEST] Deliver this greeting context: "${contextOverride}"`;
                handleAutomationTrigger(chatId, customContext, undefined, type);
              }}
            />
          )}
          {showNewChatPanel && (
            <NewChatPanel
              onClose={() => setShowNewChatPanel(false)}
              onCreate={handleCreatePersona}
            />
          )}
          {showNewGroupPanel && (
            <NewGroupPanel
              personas={chats.filter(c => !c.isGroup)}
              onClose={() => setShowNewGroupPanel(false)}
              onCreate={handleCreateGroup}
            />
          )}
          {showUserProfilePanel && (
            <UserProfilePanel
              user={user}
              onClose={() => setShowUserProfilePanel(false)}
              onUpdate={setUser}
            />
          )}
          {showGuide && (
            <GuidePanel onClose={() => setShowGuide(false)} />
          )}
          {showUpdates && (
            <UpdatesPanel onClose={() => setShowUpdates(false)} />
          )}
        </React.Suspense>

        {callSession && <CallOverlay key={callSession.id} call={callSession} onClose={() => { callSession.end(); setCallSession(null); void flushOfflineQueue(); }} />}
        {/* Mobile Floating Action Button Hub */}
        {isMobile && activeView === 'list' && !showSettingsPopover && !showNewChatPanel && !showNewGroupPanel && !showUserProfilePanel && !showCalendarWidget && !showProfilePanel && !showGuide && !showUpdates && (
          <MobileActionFAB
            onAddPersona={() => setShowNewChatPanel(true)}
            onMetaAIClick={() => handleChatSelect('6')}
          />
        )}
      </div>
    </div>
  );
};

export default App;
