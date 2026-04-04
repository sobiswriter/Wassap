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
import { INITIAL_CHATS } from './constants';
import { Chat, Message, UserProfile, AppSettings, FileAttachment } from './types';
import { getGeminiResponse } from './services/geminiService';
import { saveMedia, getMedia } from './utils/storage';
import { MobileActionFAB } from './components/MobileActionFAB';

// Helper for consistent 12-hour AM/PM time global formatting
const getFormattedTime = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

// Robust Notification Helper for Desktop & Mobile Tray
const showNotification = async (title: string, options: NotificationOptions) => {
  // 1. Try Service Worker (Required for mobile drawer)
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        return reg.showNotification(title, options);
      }
    }
  } catch (e) { console.warn("SW notification failed, falling back", e); }

  // 2. Fallback to standard Notification API (Desktop)
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(title, options);
      setTimeout(() => n.close(), 5000);
      return n;
    }
  } catch (e) { console.error("Standard notification failed", e); }
};

// Utility to split AI responses into human-like chunks
const splitMessage = (text: string): string[] => {
  if (!text) return [];

  // 1. Split by multiple newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  let chunks: string[] = [];

  for (const p of paragraphs) {
    if (p.length < 100) {
      chunks.push(p.trim());
    } else {
      // 2. Split long paragraphs into sentences
      // Looking for . ! ? followed by space or newline
      const sentences = p.split(/(?<=[.!?])[\s\n]+/).filter(s => s.trim());
      let currentChunk = "";

      for (const s of sentences) {
        // If adding this sentence stays within a reasonable "chat message" size
        if ((currentChunk + s).length < 120) {
          currentChunk += (currentChunk ? " " : "") + s;
        } else {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = s;
        }
      }
      if (currentChunk) chunks.push(currentChunk.trim());
    }
  }

  return chunks.length > 0 ? chunks : [text];
};

const App: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('whatsapp_chats');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chats", e);
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
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const chatsRef = React.useRef<Chat[]>(chats);
  const handledTriggersRef = React.useRef<Set<string>>(new Set());
  useEffect(() => { chatsRef.current = chats; }, [chats]);

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
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    return {
      theme: 'light',
      shareUserInfo: true
    };
  });

  useEffect(() => {
    localStorage.setItem('whatsapp_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('whatsapp_chats', JSON.stringify(chats));
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
              t.id === triggerId ? { ...t, lastTriggered: new Date().toLocaleDateString('en-CA'), lastTriggerType: type as any } : t
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

      const response = await getGeminiResponse(
        { ...targetChat },
        hydratedHistory,
        settings.shareUserInfo ? user : undefined,
        undefined,
        settings,
        context
      );

      const chunks = splitMessage(response);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const typingDuration = Math.min(Math.max(chunk.length * 40, 1500), 4000);

        setChatStatus(chatId, 'typing...');
        await new Promise(resolve => setTimeout(resolve, typingDuration));

        const aiMsg: Message = {
          id: `${Date.now()}-${i}`,
          text: chunk,
          sender: 'other',
          timestamp: getFormattedTime(),
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
            showNotification(targetChat.name, { body: chunk, icon: targetChat.avatar, tag: chatId });
          }
        }

        if (i < chunks.length - 1) {
          setChatStatus(chatId, 'online');
          await new Promise(resolve => setTimeout(resolve, 800));
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
    const todayDateStr = new Date().toLocaleDateString('en-CA');
    const keysToRemove: string[] = [];
    handledTriggersRef.current.forEach(key => {
      if (key.startsWith(`${chatId}-`)) keysToRemove.push(key);
    });
    keysToRemove.forEach(key => handledTriggersRef.current.delete(key));
    
    console.log(`[DEBUG] Persona ${chatId} refreshed and locks cleared.`);
  };

  const runAutomationChecks = (isInitialMount: boolean = false) => {
    const now = new Date();
    const todayDateStr = now.toLocaleDateString('en-CA'); 
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

        // 1. PRIORITY: Current Timely Greetings
        const activeTrig = automation.timeTriggers.find(t => 
          t.lastTriggered !== todayDateStr && 
          !handledTriggersRef.current.has(`${chat.id}-${t.id}-${todayDateStr}`) &&
          currentTimeStr >= t.startTime && currentTimeStr <= t.endTime
        );

        if (activeTrig) {
          // If app just opened, trigger immediately. Otherwise, use a probability check to feel natural.
          if (isInitialMount || Math.random() < 0.6) {
            triggeredContext = `[SCHEDULED INTERACTION]
INTENT: "${activeTrig.context}"

INSTRUCTION: You are starting a conversation because of this scheduled interaction. 
Deliver the message based on this intent while still being context-aware of our history.`;
            triggerId = activeTrig.id;
            triggerType = 'normal';
          }
        }

        // 2. PRIORITY: Latest Catch-Up (if no active trigger)
        if (!triggeredContext) {
          // GUARD: If any trigger has already fired today (normal or catchup), stop all further catch-ups.
          // Includes a check against handledTriggersRef to prevent race conditions during state updates.
          const hasAlreadyTalkedToday = automation.timeTriggers.some(t => 
            t.lastTriggered === todayDateStr || handledTriggersRef.current.has(`${chat.id}-${t.id}-${todayDateStr}`)
          );
          
          if (!hasAlreadyTalkedToday) {
            const missedTriggers = automation.timeTriggers
              .filter(t => 
                t.lastTriggered !== todayDateStr && 
                currentTimeStr > t.endTime
              )
              .sort((a, b) => b.endTime.localeCompare(a.endTime)); // Sort to find the MOST RECENT missed one

            if (missedTriggers.length > 0) {
              const latestMissed = missedTriggers[0];
              triggeredContext = `[CATCH-UP REQUIRED]
INTENT: "${latestMissed.context}"

INSTRUCTION: You missed your scheduled window because the app was closed. Now that it's open, acknowledge the delay naturally (e.g., "just getting to my phone") and then deliver on the INTENT above. 
Your primary goal is the INTENT while staying context-aware of our history.`;
              triggerId = latestMissed.id;
              triggerType = 'catchup';
            }
          }
        }

        // 3. PRIORITY: Inactivity Pulse (if no timely or catch-up trigger)
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
          break; // Only one automation per chat per cycle to keep it clean
        }
      }

      return updatedChats; // triggerId/lastTriggered is handled inside handleAutomationTrigger to avoid loop sync issues
    });
  };

  // Initial Startup Catch-Up
  useEffect(() => {
    const timer = setTimeout(() => runAutomationChecks(true), 2000);
    return () => clearTimeout(timer);
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



  const handleSendMessage = async (text: string, attachment?: FileAttachment, replyTo?: Message) => {
    if (!activeChat) return;

    const timestamp = getFormattedTime();

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
      timestamp,
      status: 'sent',
      replyToMessage: replyTo
    };

    setReplyingTo(null);

    setChats(prev => prev.map(chat => {
      if (chat.id === activeChat.id) {
        let lastMsg = text || 'Attachment';
        if (attachment?.type === 'image') lastMsg = '📷 Photo' + (text ? `: ${text}` : '');
        if (attachment?.type === 'document') lastMsg = '📄 Document' + (text ? `: ${text}` : '');

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
    if (activeChat.isGroup) {
      handleGroupResponse(activeChat, [...activeChat.messages, userMsg]);
    } else {
      handleSingleResponse(activeChat, [...activeChat.messages, userMsg]);
    }
  };

  const handleSingleResponse = async (chat: Chat, updatedHistory: Message[]) => {
    const chatId = chat.id;
    try {
      // Mark user message as delivered immediately before AI processes
      setChats(prev => prev.map(c => {
        if (c.id === chatId) {
          const newMsgs = [...c.messages];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg && lastMsg.sender === 'me') lastMsg.status = 'delivered';
          return { ...c, messages: newMsgs };
        }
        return c;
      }));

      setChatStatus(chatId, 'typing...');

      // Hydrate history with image data from IndexedDB so AI can see it
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
        settings
      );

      // Split responses into multiple messages if they are long or have distinct thoughts
      const chunks = splitMessage(response);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Mark previous messages as read as soon as AI "starts typing"
        if (i === 0) {
          setChats(prev => prev.map(c => {
            if (c.id === chatId) {
              const newMsgs = [...c.messages];
              const lastMsg = newMsgs[updatedHistory.length - 1];
              if (lastMsg && lastMsg.sender === 'me') lastMsg.status = 'read';
              return { ...c, messages: newMsgs };
            }
            return c;
          }));
        }

        // Realistic typing speed simulation
        const typingDuration = Math.min(Math.max(chunk.length * 40, 1500), 4000);

        // Ensure status is typing...
        setChatStatus(chatId, 'typing...');
        await new Promise(resolve => setTimeout(resolve, typingDuration));

        const aiMsg: Message = {
          id: `${Date.now()}-${i}`, // Unique ID per chunk
          text: chunk,
          sender: 'other',
          timestamp: getFormattedTime(),
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
            document.title = `(1) New Message - ${chat.name}`;
            showNotification(chat.name, { body: chunk, icon: chat.avatar, tag: chat.id });
          }
        }

        // Small pause between messages to feel like the user is "hitting send"
        if (i < chunks.length - 1) {
          setChatStatus(chatId, 'online');
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      setChatStatus(chatId, 'online');
      setTimeout(() => setChatStatus(chatId, 'offline'), 15000); // realistic drop off
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

  const handleGroupResponse = async (group: Chat, updatedHistory: Message[]) => {
    const memberIds = [...(group.memberIds || [])];
    if (memberIds.length === 0) return;

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
        const delay = 1500 + (Math.random() * 2500);
        await new Promise(resolve => setTimeout(resolve, delay));

        setChatStatus(group.id, 'typing...'); // Status set by trigger check

        // Mark user message as read
        if (i === 0) {
          setChats(prev => prev.map(c => {
            if (c.id === group.id) {
              const newMsgs = [...c.messages];
              const lastMsg = newMsgs[updatedHistory.length - 1];
              if (lastMsg && lastMsg.sender === 'me') lastMsg.status = 'read';
              return { ...c, messages: newMsgs };
            }
            return c;
          }));
        }

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
          settings
        );

        const chunks = splitMessage(responseText);

        for (let j = 0; j < chunks.length; j++) {
          const chunk = chunks[j];

          // Typing duration for group personas
          const typingDuration = Math.min(Math.max(chunk.length * 40, 1500), 4000);

          setChatStatus(group.id, 'typing...');
          await new Promise(resolve => setTimeout(resolve, typingDuration));

          const aiMsg: Message = {
            id: `${Date.now()}-${i}-${j}`, // Unique ID per chunk
            text: chunk,
            sender: 'other',
            senderName: persona.name,
            senderId: persona.id,
            timestamp: getFormattedTime(),
            status: 'delivered'
          };

          currentHistory.push(aiMsg); // Add to history for subsequent responses

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
            if (document.hidden) {
              document.title = `(1) New Message - ${group.name}`;
              const personaLabel = chats.find(c => c.id === responderId)?.name || 'Group Member';
              const personaAvatar = chats.find(c => c.id === responderId)?.avatar;
              showNotification(`${group.name} - ${personaLabel}`, { body: chunk, icon: personaAvatar, tag: group.id });
            }
          }

          if (j < chunks.length - 1) {
            setChatStatus(group.id, 'online');
            await new Promise(resolve => setTimeout(resolve, 600));
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
        timestamp: '--'
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
        <span className="text-[12px] font-semibold text-secondary">WhatsApp</span>
      </div>

      <div className="flex-1 flex overflow-hidden bg-white relative">
        <div className={`hidden md:block`}>
          <Sidebar
            userAvatar={user.avatar}
            onUserProfileClick={() => setShowUserProfilePanel(!showUserProfilePanel)}
            onSettingsClick={() => setShowSettingsPopover(!showSettingsPopover)}
            onCalendarClick={() => setShowCalendarWidget(!showCalendarWidget)}
          />
        </div>

        {showNewChatPanel && (
          <NewChatPanel onClose={() => setShowNewChatPanel(false)} onCreate={handleCreatePersona} />
        )}

        {showNewGroupPanel && (
          <NewGroupPanel
            personas={chats.filter(c => !c.isGroup)}
            onClose={() => setShowNewGroupPanel(false)}
            onCreate={handleCreateGroup}
          />
        )}

        {showUserProfilePanel && (
          <UserProfilePanel user={user} onClose={() => setShowUserProfilePanel(false)} onUpdate={setUser} />
        )}

        {showSettingsPopover && (
          <SettingsPopover settings={settings} onUpdate={setSettings} onClose={() => setShowSettingsPopover(false)} />
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
          {isMobile && <MobileNavigation unreadCount={unreadTotal} />}
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
      </div>
    </div>
  );
};

export default App;
