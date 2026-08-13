import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { MessageInput } from './components/MessageInput';
import { ProfilePanel } from './components/ProfilePanel';
import { NewChatPanel } from './components/NewChatPanel';
import { NewGroupPanel } from './components/NewGroupPanel';
import { UserProfilePanel } from './components/UserProfilePanel';
import { CalendarNotesWidget } from './components/CalendarNotesWidget';
import { SettingsPopover } from './components/SettingsPopover';
import { MobileNavigation } from './components/MobileNavigation';
import { GuidePanel } from './components/GuidePanel';
import { UpdatesPanel } from './components/UpdatesPanel';
import { INITIAL_CHATS } from './constants';
import { Chat, Message, UserProfile, AppSettings, FileAttachment, MemoryBubble, MessageStatus } from './types';
import { getGeminiResponse } from './services/geminiService';
import { saveMedia, getMedia } from './utils/storage';
import { formatDateRangeLabel, getLocalDateKey, getTimeGapAndFrequencyContext } from './utils/dates';
import { MobileActionFAB } from './components/MobileActionFAB';

// Helper for consistent 24-hour time global formatting
const getFormattedTime = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
const getDateKey = getLocalDateKey;

const avatarCache = new Map<string, string>();

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
const showNotification = async (title: string, options: NotificationOptions & { silentUpdate?: boolean }) => {
  if (!('Notification' in window)) return;

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
  const squareIcon = options.icon ? await getSquareNotificationIcon(options.icon as string) : '/favicon.svg';

  const notificationOptions: any = {
    ...options,
    icon: squareIcon,
    badge: options.badge || '/favicon.svg',
    renotify: !isSilent,
    silent: isSilent,
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
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);
        return;
      }
    }
  } catch (e) {
    console.warn("SW notification failed, falling back to standard Notification", e);
  }

  // 2. Direct Native OS Desktop Notification Fallback
  try {
    const n = new Notification(title, notificationOptions);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    setTimeout(() => n.close(), 10000);
  } catch (e) {
    console.warn("Standard Notification API failed", e);
  }
};




const playIncomingMessageSound = () => {
  if (!document.hidden) {
    const audio = new Audio('/whatapp.wav');
    audio.play().catch(e => console.warn("Audio play failed:", e));
  }
};

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
    } else if (wordCount <= 15) {
      targetChunksCount = 2;
    } else if (wordCount <= 24) {
      targetChunksCount = 3;
    } else {
      targetChunksCount = Math.random() > 0.5 ? 4 : 5; // 4-5 randomly
    }

    if (targetChunksCount === 1) {
      finalChunks.push(rawChunk);
    } else {
      let currentSegment: string[] = [];
      const segmentList: string[] = [];
      
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        currentSegment.push(w);
        
        const isPunctuationEnd = /[.!?,\;:\-]+$/.test(w) || w.endsWith("...");
        const nextW = words[i+1] ? words[i+1].toLowerCase() : "";
        const isNextConjunction = ["and", "but", "so", "because", "then", "or"].includes(nextW);
        
        if (isPunctuationEnd || isNextConjunction) {
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
    if (totalWords <= 25) maxAllowed = 4;
    else if (totalWords <= 50) maxAllowed = 5;
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

const App: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('whatsapp_chats');
    if (saved) {
      try {
        const parsedChats = JSON.parse(saved);
        if (Array.isArray(parsedChats) && parsedChats.length > 0) {
          return parsedChats.map(chat => ({
            ...chat,
            lastMessageTime: convertTo24Hour(chat?.lastMessageTime || ''),
            messages: (Array.isArray(chat?.messages) ? chat.messages : []).map(msg => {
              const cleanMsg = {
                ...msg,
                timestamp: convertTo24Hour(msg?.timestamp || '')
              };
              // Strip heavy legacy Base64 image data from localStorage to keep state light and prevent startup freezes
              if (cleanMsg.image && cleanMsg.image.length > 500) {
                delete (cleanMsg as any).image;
              }
              return cleanMsg;
            })
          }));
        }
      } catch (e) {
        console.error("Failed to parse chats safely", e);
      }
    }
    return INITIAL_CHATS;
  });

  const [activeChatId, setActiveChatId] = useState<string>('');
  const [activeView, setActiveView] = useState<'list' | 'chat'>('list');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showNewChatPanel, setShowNewChatPanel] = useState(false);
  const [showNewGroupPanel, setShowNewGroupPanel] = useState(false);
  const [showUserProfilePanel, setShowUserProfilePanel] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showCalendarWidget, setShowCalendarWidget] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const chatsRef = React.useRef<Chat[]>(chats);
  const handledTriggersRef = React.useRef<Set<string>>(new Set());
  const activeNotificationSoundChatsRef = React.useRef<Set<string>>(new Set());

  const sendNotificationWithChimeRule = (chatId: string, title: string, avatar: string, bodyText: string) => {
    const isFirstInChain = !activeNotificationSoundChatsRef.current.has(chatId);
    
    if (isFirstInChain) {
      playIncomingMessageSound();
      activeNotificationSoundChatsRef.current.add(chatId);
    }

    showNotification(title, {
      body: bodyText,
      icon: avatar,
      tag: chatId,
      silentUpdate: !isFirstInChain
    });
  };

  // Service Worker Notification Actions Listener (REPLY & MARK AS READ from phone / OS tray)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleServiceWorkerMessage = (event: MessageEvent) => {
        const { type, chatId } = event.data || {};
        if (type === 'OPEN_CHAT' && chatId) {
          activeNotificationSoundChatsRef.current.delete(chatId);
          handleChatSelect(chatId);
          setActiveView('chat');
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
            const userMsg: Message = {
              id: Date.now().toString(),
              text,
              sender: 'me',
              date,
              timestamp,
              timestampEpoch: Date.now(),
              status: 'sent'
            };

            setChats(prev => prev.map(c => {
              if (c.id === chatId) {
                return {
                  ...c,
                  unreadCount: 0,
                  lastMessage: text,
                  lastMessageTime: timestamp,
                  messages: [...c.messages, userMsg]
                };
              }
              return c;
            }));

            const updatedMessages = [...targetChat.messages, userMsg];
            const memoryContext = buildMemoryRecallContext(targetChat, text);
            const scheduleContext = buildScheduleContext(targetChat);
            const timeGapContext = getTimeGapAndFrequencyContext(updatedMessages, false);
            const combinedContexts = combinePersonaContexts(memoryContext, scheduleContext, timeGapContext);

            if (targetChat.isGroup) {
              handleGroupResponse(targetChat, updatedMessages, combinedContexts);
            } else {
              handleSingleResponse(targetChat, updatedMessages, combinedContexts);
            }
          }
        } else if (type === 'MARK_AS_READ' && chatId) {
          activeNotificationSoundChatsRef.current.delete(chatId);
          // Mark as read & trigger left on read persona reaction
          setChats(prev => prev.map(c => {
            if (c.id === chatId) {
              return {
                ...c,
                unreadCount: 0,
                messages: c.messages.map(m => ({ ...m, status: 'read' as MessageStatus }))
              };
            }
            return c;
          }));

          if (leftOnReadTimeoutsRef.current[chatId]) {
            clearTimeout(leftOnReadTimeoutsRef.current[chatId]);
            delete leftOnReadTimeoutsRef.current[chatId];
          }

          const targetChat = chatsRef.current.find(c => c.id === chatId);
          if (targetChat && !targetChat.isGroup) {
            leftOnReadTimeoutsRef.current[chatId] = window.setTimeout(async () => {
              delete leftOnReadTimeoutsRef.current[chatId];
              const currentChat = chatsRef.current.find(c => c.id === chatId);
              if (!currentChat) return;

              const lastMsg = currentChat.messages[currentChat.messages.length - 1];
              if (lastMsg && lastMsg.sender === 'other') {
                handleAutomationTrigger(
                  chatId,
                  `[LEFT ON READ] The user just saw your last message ("${lastMsg.text.slice(0, 50)}") and marked it as read (blue ticks) but did NOT send a reply back. React naturally in character to being left on read in 1 short message.`,
                  undefined,
                  'inactivity'
                );
              }
            }, 6000 + Math.random() * 5000);
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    }
  }, []);

  // User and Settings State
  const [user, setUser] = useState<UserProfile>({
    name: 'You',
    about: 'Hey there! I am using WhatsApp.',
    status: 'Available',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop'
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clear title notification when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        document.title = 'Wassap';
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
          return {
            theme: 'light',
            shareUserInfo: true,
            fontSize: 14.5,
            ...parsed
          };
        }
      } catch (e) {
        console.error("Failed to parse settings safely", e);
      }
    }
    return {
      theme: 'light',
      shareUserInfo: true,
      fontSize: 14.5
    };
  });

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
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        const sanitizedChats = chats.map(c => ({
          ...c,
          messages: (c.messages || []).map(m => {
            if (m.image && m.image.length > 500) {
              const { image, ...rest } = m;
              return rest as Message;
            }
            return m;
          })
        }));
        localStorage.setItem('whatsapp_chats', JSON.stringify(sanitizedChats));
      } catch (e) {
        console.warn("Throttled localStorage save failed safely:", e);
      }
    }, 400);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [chats]);

  const activeChat = chats.find(c => c.id === activeChatId) || null;
  const unreadTotal = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const setChatStatus = (chatId: string, status: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, status } : c));
  };

  const buildMemoryRecallContext = (chat: Chat, text: string) => {
    if (!chat.memoryEnabled || !/[\\\/]rem\b/i.test(text)) return undefined;

    const memories = chat.memoryBubbles || [];
    if (memories.length === 0) {
      return `[MEMORY RECALL]
The user invoked \\rem, but this chat has no saved memory bubbles yet. Acknowledge that naturally and continue the conversation without pretending to remember a saved day.`;
    }

    const query = text.replace(/[\\\/]rem\b/i, '').trim().toLowerCase();
    const matchedMemories = query
      ? memories.filter(memory =>
          memory.title.toLowerCase().includes(query) ||
          memory.summary.toLowerCase().includes(query) ||
          memory.startDate.includes(query) ||
          memory.endDate.includes(query)
        )
      : memories;

    const selectedMemories = (matchedMemories.length > 0 ? matchedMemories : memories).slice(-4);
    const memoryText = selectedMemories.map(memory => [
      `Title: ${memory.title}`,
      `When: ${formatDateRangeLabel(memory.startDate, memory.endDate)}`,
      `Memory: ${memory.summary}`
    ].join('\n')).join('\n\n');

    return `[MEMORY RECALL]
The user invoked a recall command (/rem). Use the saved memory context below as emotional and factual background, then reply in-character like this is something you naturally remember. Do not mention databases or settings unless the user asks.

${memoryText}`;
  };

  const handleSaveMemory = (chatId: string, memory: MemoryBubble) => {
    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat;
      return {
        ...chat,
        memoryBubbles: [...(chat.memoryBubbles || []), memory]
      };
    }));
  };

  const combinePersonaContexts = (...contexts: Array<string | undefined>) => contexts.filter(Boolean).join('\n\n');

  const buildScheduleContext = (chat: Chat) => {
    const schedule = chat.schedule;
    if (!schedule?.enabled) return undefined;

    const now = new Date();
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

  const handleAutomationTrigger = async (chatId: string, context: string, triggerId?: string, type?: 'normal' | 'catchup' | 'inactivity') => {
    const targetChat = chatsRef.current.find(c => c.id === chatId);
    if (!targetChat) return;

    try {
      setChatStatus(chatId, 'online');

      const hydratedHistory = await Promise.all(targetChat.messages.map(async m => {
        const mediaId = m.mediaId || m.attachment?.mediaId;
        const mediaData = mediaId ? await getMedia(mediaId) : undefined;
        let text = m.text;
        if (m.replyToMessage) text = `[Replying to: "${m.replyToMessage.text}"] ` + text;
        return {
          text,
          sender: m.sender,
          image: mediaData && (m.attachment?.type === 'image' || m.image) ? mediaData : undefined,
          audio: mediaData && m.attachment?.type === 'audio' ? mediaData : undefined
        };
      }));

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

      // 1. Initial "Thinking" Delay before starting to type
      const thinkingDelay = 1000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, thinkingDelay));

      const timeGapContext = getTimeGapAndFrequencyContext(targetChat.messages, true);

      const response = await getGeminiResponse(
        { ...targetChat },
        hydratedHistory,
        settings.shareUserInfo ? user : undefined,
        undefined,
        settings,
        combinePersonaContexts(context, buildScheduleContext(targetChat), timeGapContext)
      );

      const chunks = splitMessage(response);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // 2. Randomized Typing Duration
        const charEfficiency = 35 + Math.random() * 20; 
        const typingDuration = Math.min(Math.max(chunk.length * charEfficiency, 1500), 5000);

        setChatStatus(chatId, 'typing...');
        await new Promise(resolve => setTimeout(resolve, typingDuration));

        const aiMsg: Message = {
          id: `${Date.now()}-${i}`,
          text: chunk,
          sender: 'other',
          date: getDateKey(),
          timestamp: getFormattedTime(),
          timestampEpoch: Date.now(),
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

        const isFocusingChat = !document.hidden && activeChatId === chatId;
        if (settings.enableNotifications && !isFocusingChat) {
          if (document.hidden) {
            document.title = `(1) New Message - ${targetChat.name}`;
          }
          const stackedTurnText = chunks.slice(0, i + 1).join('\n');
          sendNotificationWithChimeRule(chatId, targetChat.name, targetChat.avatar, stackedTurnText);
        }

        // 3. Randomized Inter-message Delay
        if (i < chunks.length - 1) {
          setChatStatus(chatId, 'online');
          const interDelay = 1200 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, interDelay));
        }
      }

      setChatStatus(chatId, 'online');
      setTimeout(() => setChatStatus(chatId, 'offline'), 15000);
    } finally {
      const isStillTyping = chatsRef.current.find(c => c.id === chatId)?.status === 'typing...';
      if (isStillTyping) setChatStatus(chatId, 'online');
      setTimeout(() => {
        const current = chatsRef.current.find(c => c.id === chatId);
        if (current?.status === 'online') setChatStatus(chatId, 'offline');
      }, 15000);
    }
  };

  const handleRefreshPersona = (chatId: string) => {
    // 1. Force state to offline
    setChatStatus(chatId, 'offline');
    
    // 2. Clear any session locks in handledTriggersRef
    const todayDateStr = getDateKey();
    const keysToRemove: string[] = [];
    handledTriggersRef.current.forEach(key => {
      if (key.startsWith(`${chatId}-`)) keysToRemove.push(key);
    });
    keysToRemove.forEach(key => handledTriggersRef.current.delete(key));
    
    console.log(`[DEBUG] Persona ${chatId} refreshed and locks cleared.`);
  };

  const runAutomationChecks = (isInitialMount: boolean = false) => {
    const now = new Date();
    const todayDateStr = getDateKey(); 
    const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    setChats(prevChats => {
      let chatUpdated = false;
      const updatedChats = [...prevChats];

      for (let i = 0; i < updatedChats.length; i++) {
        const chat = updatedChats[i];
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
          const timeGapContext = getTimeGapAndFrequencyContext(updatedMessages, false);
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
    const isPanelOpen = showSettingsPopover || showNewChatPanel || showNewGroupPanel || showUserProfilePanel || showCalendarWidget || showProfilePanel;

    if (isMobile && isPanelOpen) {
      window.history.pushState({ panelOpen: true }, '');
    }

    const handlePopState = () => {
      if (isPanelOpen) {
        setShowProfilePanel(false);
        setShowNewChatPanel(false);
        setShowNewGroupPanel(false);
        setShowUserProfilePanel(false);
        setShowSettingsPopover(false);
        setShowCalendarWidget(false);
      } else if (activeView === 'chat') {
        setActiveView('list');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeView, isMobile, showSettingsPopover, showNewChatPanel, showNewGroupPanel, showUserProfilePanel, showCalendarWidget, showProfilePanel]);



  const handleSendMessage = async (text: string, attachment?: FileAttachment, replyTo?: Message, isEvent?: boolean) => {
    if (!activeChat) return;

    if (leftOnReadTimeoutsRef.current[activeChat.id]) {
      clearTimeout(leftOnReadTimeoutsRef.current[activeChat.id]);
      delete leftOnReadTimeoutsRef.current[activeChat.id];
    }

    const timestamp = getFormattedTime();
    const date = getDateKey();

    let mediaId = '';
    if (attachment && (attachment.type === 'image' || attachment.type === 'audio')) {
      mediaId = `media-${Date.now()}`;
      try {
        await saveMedia(mediaId, attachment.data);
      } catch (err) {
        console.error("Failed to save media to IndexedDB", err);
      }
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      attachment: attachment ? {
        ...attachment,
        data: (attachment.type === 'image' || attachment.type === 'audio') ? '' : attachment.data, // Strip media data for storage
        mediaId
      } : undefined,
      image: undefined, // No longer storing full Base64 in message object
      mediaId,
      sender: 'me',
      date,
      timestamp,
      timestampEpoch: Date.now(),
      status: 'sent',
      replyToMessage: replyTo,
      isEvent
    };

    setReplyingTo(null);

    setChats(prev => prev.map(chat => {
      if (chat.id === activeChat.id) {
        let lastMsg = text || 'Attachment';
        if (attachment?.type === 'image') lastMsg = '📷 Photo' + (text ? `: ${text}` : '');
        if (attachment?.type === 'document') lastMsg = '📄 Document' + (text ? `: ${text}` : '');
        if (isEvent) lastMsg = `🎬 Event: ${text}`;

        return {
          ...chat,
          lastMessage: lastMsg,
          lastMessageTime: timestamp,
          messages: [...chat.messages, userMsg]
        };
      }
      return chat;
    }));

    // Trigger AI response(s)
    if (settings.enableTextStacking === false) {
      const memoryContext = buildMemoryRecallContext(activeChat, text);
      const scheduleContext = buildScheduleContext(activeChat);
      const timeGapContext = getTimeGapAndFrequencyContext([...activeChat.messages, userMsg], false);
      const combinedContexts = combinePersonaContexts(memoryContext, scheduleContext, timeGapContext);

      if (activeChat.isGroup) {
        handleGroupResponse(activeChat, [...activeChat.messages, userMsg], combinedContexts);
      } else {
        handleSingleResponse(activeChat, [...activeChat.messages, userMsg], combinedContexts);
      }
    } else {
      const chatId = activeChat.id;
      const hasPendingTimeout = !!aiResponseTimeoutsRef.current[chatId];
      if (hasPendingTimeout) {
        clearTimeout(aiResponseTimeoutsRef.current[chatId]);
      }

      // If no timeout was active, this is the first message of the stack. Calculate time-gap.
      if (!hasPendingTimeout) {
        const timeGapContext = getTimeGapAndFrequencyContext([...activeChat.messages, userMsg], false);
        pendingTimeGapsRef.current[chatId] = timeGapContext;
      }

      const delaySeconds = settings.textStackingDelay || 10;
      aiResponseTimeoutsRef.current[chatId] = window.setTimeout(async () => {
        delete aiResponseTimeoutsRef.current[chatId];

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

            // Extract the user's stack of messages since last AI message
            const lastAiMsgIdx = [...freshChat.messages].reverse().findIndex(m => m.sender === 'other');
            const userStackMessages = lastAiMsgIdx === -1
              ? freshChat.messages
              : freshChat.messages.slice(freshChat.messages.length - lastAiMsgIdx);
            
            const combinedText = userStackMessages.map(m => m.text).join(' ');

            const memoryContext = buildMemoryRecallContext(freshChat, combinedText);
            const scheduleContext = buildScheduleContext(freshChat);
            const combinedContexts = combinePersonaContexts(memoryContext, scheduleContext, savedTimeGap);

            if (freshChat.isGroup) {
              await handleGroupResponse(freshChat, freshChat.messages, combinedContexts);
            } else {
              await handleSingleResponse(freshChat, freshChat.messages, combinedContexts);
            }
          } finally {
            aiRespondingChatsRef.current.delete(chatId);
          }
        };

        checkBusyAndTrigger();
      }, delaySeconds * 1000);
    }
  };

  const handleSingleResponse = async (chat: Chat, updatedHistory: Message[], memoryContext?: string) => {
    const chatId = chat.id;
    try {
      // 1. "Seen" Delay Simulation (Persona opens the app)
      const seenDelay = 1000 + Math.random() * 1500;
      await new Promise(resolve => setTimeout(resolve, seenDelay));

      // Mark user messages as read (Blue ticks appear BEFORE typing)
      setChats(prev => prev.map(c => {
        if (c.id === chatId) {
          const newMsgs = c.messages.map(m => {
            if (m.sender === 'me' && m.status !== 'read') {
              return { ...m, status: 'read' as const };
            }
            return m;
          });
          return { ...c, messages: newMsgs };
        }
        return c;
      }));

      // 2. Initial "Thinking" Delay
      const thinkingDelay = 500 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, thinkingDelay));

      // Hydrate history with media data
      const hydratedHistory = await Promise.all(updatedHistory.map(async m => {
        const mediaId = m.mediaId || m.attachment?.mediaId;
        const mediaData = mediaId ? await getMedia(mediaId) : undefined;
        let text = m.text;
        if (m.replyToMessage) text = `[Replying to: "${m.replyToMessage.text}"] ` + text;
        return {
          text,
          sender: m.sender,
          image: mediaData && (m.attachment?.type === 'image' || m.image) ? mediaData : undefined,
          audio: mediaData && m.attachment?.type === 'audio' ? mediaData : undefined
        };
      }));

      const response = await getGeminiResponse(
        { ...chat },
        hydratedHistory,
        settings.shareUserInfo ? user : undefined,
        undefined,
        settings,
        memoryContext
      );

      const chunks = splitMessage(response);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // 3. Randomized Typing Duration
        // Human typing: ~35ms to 55ms per character
        const charEfficiency = 35 + Math.random() * 20; 
        const typingDuration = Math.min(Math.max(chunk.length * charEfficiency, 1500), 5000);

        setChatStatus(chatId, 'typing...');
        await new Promise(resolve => setTimeout(resolve, typingDuration));

        const aiMsg: Message = {
          id: `${Date.now()}-${i}`,
          text: chunk,
          sender: 'other',
          date: getDateKey(),
          timestamp: getFormattedTime(),
          timestampEpoch: Date.now(),
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

        const isFocusingChat = !document.hidden && activeChatId === chat.id;
        if (settings.enableNotifications && !isFocusingChat) {
          if (document.hidden) {
            document.title = `(1) New Message - ${chat.name}`;
          }
          const stackedTurnText = chunks.slice(0, i + 1).join('\n');
          sendNotificationWithChimeRule(chat.id, chat.name, chat.avatar, stackedTurnText);
        }

        // 4. Randomized Inter-message Delay (simulating hitting 'send' and starting to type next)
        if (i < chunks.length - 1) {
          setChatStatus(chatId, 'online');
          const interDelay = 1200 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, interDelay));
        }
      }

      setChatStatus(chatId, 'online');
      setTimeout(() => setChatStatus(chatId, 'offline'), 15000);
    } catch (error) {
      console.error("Error getting AI response for single chat:", error);
    } finally {
      const isStillTyping = chatsRef.current.find(c => c.id === chatId)?.status === 'typing...';
      if (isStillTyping) setChatStatus(chatId, 'online');
      setTimeout(() => {
        const current = chatsRef.current.find(c => c.id === chatId);
        if (current?.status === 'online') setChatStatus(chatId, 'offline');
      }, 15000);
    }
  };

  const handleGroupResponse = async (group: Chat, updatedHistory: Message[], memoryContext?: string) => {
    const memberIds = [...(group.memberIds || [])];
    if (memberIds.length === 0) return;

    // 1. Initial "Seen" Delay for the whole group (simulating someone opening the group)
    const initialSeenDelay = 1200 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, initialSeenDelay));

    // Mark user messages as read
    setChats(prev => prev.map(c => {
      if (c.id === group.id) {
        const newMsgs = c.messages.map(m => {
          if (m.sender === 'me' && m.status !== 'read') {
            return { ...m, status: 'read' as const };
          }
          return m;
        });
        return { ...c, messages: newMsgs };
      }
      return c;
    }));

    let responseSequence = [...memberIds].sort(() => Math.random() - 0.5);

    if (Math.random() < 0.2) {
      const extraResponderId = memberIds[Math.floor(Math.random() * memberIds.length)];
      const insertIdx = Math.floor(Math.random() * (responseSequence.length + 1));
      responseSequence.splice(insertIdx, 0, extraResponderId);
    }

    let currentHistory = [...updatedHistory];

    for (let i = 0; i < responseSequence.length; i++) {
      const responderId = responseSequence[i];
      const persona = chats.find(c => c.id === responderId);
      if (!persona) continue;

      try {
        // 2. Persona-specific thinking/readiness delay
        const delay = 1000 + (Math.random() * 3000);
        await new Promise(resolve => setTimeout(resolve, delay));

        setChatStatus(group.id, 'typing...');

        // Hydrate group history with media data from IndexedDB
        const hydratedGroupHistory = await Promise.all(currentHistory.map(async m => {
          const mediaId = m.mediaId || m.attachment?.mediaId;
          const mediaData = mediaId ? await getMedia(mediaId) : undefined;
          let text = m.text;
          if (m.replyToMessage) text = `[Replying to: "${m.replyToMessage.text}"] ` + text;
          return {
            text,
            sender: m.sender,
            senderName: m.senderName,
            image: mediaData && (m.attachment?.type === 'image' || m.image) ? mediaData : undefined,
            audio: mediaData && m.attachment?.type === 'audio' ? mediaData : undefined
          };
        }));

        const responseText = await getGeminiResponse(
          { ...persona },
          hydratedGroupHistory,
          settings.shareUserInfo ? user : undefined,
          {
            groupName: group.name,
            otherMembers: group.memberIds?.filter(id => id !== responderId).map(id => chats.find(c => c.id === id)?.name || '') || []
          },
          settings,
          combinePersonaContexts(memoryContext, buildScheduleContext(persona))
        );

        const chunks = splitMessage(responseText);

        for (let j = 0; j < chunks.length; j++) {
          const chunk = chunks[j];

          // 3. Randomized Typing Duration for group personas
          const charEfficiency = 35 + Math.random() * 25; 
          const typingDuration = Math.min(Math.max(chunk.length * charEfficiency, 1500), 5000);

          setChatStatus(group.id, 'typing...');
          await new Promise(resolve => setTimeout(resolve, typingDuration));

          const aiMsg: Message = {
            id: `${Date.now()}-${i}-${j}`,
            text: chunk,
            sender: 'other',
            senderName: persona.name,
            senderId: persona.id,
            date: getDateKey(),
            timestamp: getFormattedTime(),
            timestampEpoch: Date.now(),
            status: 'delivered'
          };

          currentHistory.push(aiMsg);

          setChats(prev => prev.map(c => {
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

          const isFocusingChat = !document.hidden && activeChatId === group.id;
          if (settings.enableNotifications && !isFocusingChat) {
            const personaLabel = chats.find(c => c.id === responderId)?.name || 'Group Member';
            const personaAvatar = chats.find(c => c.id === responderId)?.avatar || group.avatar;
            if (document.hidden) {
              document.title = `(1) New Message - ${group.name}`;
            }
            const stackedTurnText = chunks.slice(0, j + 1).join('\n');
            sendNotificationWithChimeRule(group.id, `${group.name} - ${personaLabel}`, personaAvatar, stackedTurnText);
          }

          if (j < chunks.length - 1) {
            setChatStatus(group.id, 'online');
            const interDelay = 1000 + Math.random() * 1200;
            await new Promise(resolve => setTimeout(resolve, interDelay));
          }
        }

        setChatStatus(group.id, 'online');
        setTimeout(() => setChatStatus(group.id, 'offline'), 15000);
      } catch (error) {
        console.error(`Error getting AI response for group member ${responderId}:`, error);
      } finally {
        const isStillTyping = chatsRef.current.find(c => c.id === group.id)?.status === 'typing...';
        if (isStillTyping) setChatStatus(group.id, 'online');
      }
    }
    
    setTimeout(() => {
      const current = chatsRef.current.find(c => c.id === group.id);
      if (current?.status === 'online') setChatStatus(group.id, 'offline');
    }, 15000);
  };

  const handleChatSelect = (id: string) => {
    activeNotificationSoundChatsRef.current.delete(id);
    setActiveChatId(id);
    setChats(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));
    setShowProfilePanel(false);
    setShowNewChatPanel(false);
    setShowNewGroupPanel(false);
    setChatSearchTerm('');
    setReplyingTo(null);
    if (isMobile) {
      window.history.pushState({ view: 'chat' }, '');
      setActiveView('chat');
    }
  };

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
        text: `Welcome to ${data.name}! Members: ${data.memberIds.map(id => chats.find(c => c.id === id)?.name).join(', ')}`,
        sender: 'other',
        senderName: 'System',
        date: getDateKey(),
        timestamp: '--',
        timestampEpoch: Date.now()
      }]
    };
    setChats([newGroup, ...chats]);
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
    setChats([newPersona, ...chats]);
    setActiveChatId(newPersona.id);
    setShowNewChatPanel(false);
  };

  const updateActiveChat = (updates: Partial<Chat>) => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, ...updates } : c));
  };

  const handleDeleteChat = () => {
    if (!activeChatId) return;
    if (activeChatId === '6') {
      alert("This is a permanent system chat and cannot be deleted.");
      return;
    }
    setChats(prev => prev.filter(c => c.id !== activeChatId));
    setActiveChatId('');
    setShowProfilePanel(false);
  };

  const handleClearChat = () => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => c.id === activeChatId ? {
      ...c,
      messages: [],
      lastMessage: '',
      lastMessageTime: ''
    } : c));
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white overflow-hidden p-0">
      {/* Top Title Bar */}
      <div className="hidden md:flex h-[30px] app-panel items-center px-3 gap-2 shrink-0 border-b app-border select-none">
        <div className="bg-[#25d366] p-[2px] rounded flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="white">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.767 5.767 0 1.267.405 2.436 1.096 3.389l-.711 2.597 2.659-.697a5.733 5.733 0 0 0 2.723.678c3.181 0 5.767-2.586 5.767-5.767 0-3.181-2.586-5.767-5.767-5.767zm3.39 8.136c-.147.414-.733.754-1.011.802-.278.048-.543.085-1.545-.303-1.002-.387-1.649-1.398-1.698-1.464-.048-.066-.401-.532-.401-1.022 0-.49.255-.731.345-.83.09-.099.198-.122.264-.122.066 0 .132.001.189.004.057.002.132-.023.208.156.075.18.255.621.28.669.024.047.04.103.01.16-.03.057-.045.094-.09.146-.045.052-.094.113-.137.151-.047.042-.094.085-.042.174.052.09.231.382.495.617.34.303.623.396.711.439.088.042.141.033.193-.028.052-.061.222-.259.283-.349.061-.088.122-.075.208-.042.085.033.543.255.637.302.094.047.156.071.18.113.023.042.023.245-.124.659zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
          </svg>
        </div>
        <span className="text-[calc(var(--msg-font-size)-2.5px)] font-semibold text-secondary">WhatsApp</span>
      </div>

      <div className="flex-1 flex overflow-hidden bg-white relative">
        <div className={`hidden md:block`}>
          <Sidebar
            userAvatar={user.avatar}
            onUserProfileClick={() => setShowUserProfilePanel(!showUserProfilePanel)}
            onSettingsClick={() => setShowSettingsPopover(!showSettingsPopover)}
            onCalendarClick={() => setShowCalendarWidget(!showCalendarWidget)}
            onGuideClick={() => setShowGuide(true)}
            onUpdatesClick={() => setShowUpdates(true)}
          />
        </div>

        {showSettingsPopover && (
          <SettingsPopover
            settings={settings}
            onUpdate={setSettings}
            onClose={() => setShowSettingsPopover(false)}
            onTestNotification={async () => {
              playIncomingMessageSound();
              const testChat = chats[0];
              const senderName = testChat ? testChat.name : 'Wassap Notification';
              const avatar = testChat ? testChat.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';

              await showNotification(senderName, {
                body: 'Desktop and Mobile notifications are working perfectly!',
                icon: avatar,
                badge: '/favicon.svg',
                tag: 'test-notification'
              });
            }}
          />
        )}

        {showCalendarWidget && (
          <CalendarNotesWidget
            notes={settings.calendarNotes || ''}
            onUpdateNotes={(notes) => setSettings({ ...settings, calendarNotes: notes })}
            onClose={() => setShowCalendarWidget(false)}
          />
        )}

        <div className={`${isMobile && activeView === 'chat' ? 'hidden' : 'flex'} w-full md:w-[410px] md:flex shrink-0 flex-col h-full`}>
          <ChatList
            chats={chats}
            activeChatId={activeChatId}
            onChatSelect={handleChatSelect}
            onAddPersona={() => setShowNewChatPanel(true)}
            onAddGroup={() => setShowNewGroupPanel(true)}
            onMetaAIClick={() => handleChatSelect('6')}
            isMobile={isMobile}
          />
          {isMobile && <MobileNavigation unreadCount={unreadTotal} onGuideClick={() => setShowGuide(true)} onUpdatesClick={() => setShowUpdates(true)} />}
        </div>

        <div className={`${isMobile && activeView === 'list' ? 'hidden' : 'flex'} flex-1 flex-col min-w-0 bg-[#efeae2] dark:bg-[#0b141a]`}>
          <ChatWindow
            chat={activeChat}
            allChats={chats}
            onHeaderClick={() => setShowProfilePanel(!showProfilePanel)}
            onDeleteChat={handleDeleteChat}
            onClearChat={handleClearChat}
            searchTerm={chatSearchTerm}
            setSearchTerm={setChatSearchTerm}
            onBack={isMobile ? handleBack : undefined}
            onProfileClick={() => setShowUserProfilePanel(true)}
            onMetaAIClick={() => handleChatSelect('6')}
            onAddContact={() => setShowNewChatPanel(true)}
            onReply={setReplyingTo}
            onSaveMemory={handleSaveMemory}
            settings={settings}
          />
          {activeChat && (!isMobile || !showProfilePanel) && (
            <MessageInput
              activeChatId={activeChatId}
              onSendMessage={handleSendMessage}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
          )}
        </div>

        {showProfilePanel && activeChat && (
          <ProfilePanel
            chat={chats.find(c => c.id === activeChatId)!}
            allChats={chats}
            onClose={() => setShowProfilePanel(false)}
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
        {/* Mobile Floating Action Button Hub */}
        {isMobile && activeView === 'list' && !showSettingsPopover && !showNewChatPanel && !showNewGroupPanel && !showUserProfilePanel && !showCalendarWidget && !showProfilePanel && (
          <MobileActionFAB
            onAddPersona={() => setShowNewChatPanel(true)}
            onAddGroup={() => setShowNewGroupPanel(true)}
            onProfileClick={() => setShowUserProfilePanel(true)}
            onSettingsClick={() => setShowSettingsPopover(true)}
            onCalendarClick={() => setShowCalendarWidget(true)}
            onMetaAIClick={() => handleChatSelect('6')}
          />
        )}
        {showGuide && (
          <GuidePanel onClose={() => setShowGuide(false)} />
        )}
        {showUpdates && (
          <UpdatesPanel onClose={() => setShowUpdates(false)} />
        )}
      </div>
    </div>
  );
};

export default App;
