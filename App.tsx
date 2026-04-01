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
import { supabase } from './services/supabaseClient';
import { PostgrestError } from '@supabase/supabase-js';

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
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  let chunks: string[] = [];
  for (const p of paragraphs) {
    if (p.length < 100) {
      chunks.push(p.trim());
    } else {
      const sentences = p.split(/(?<=[.!?])[\s\n]+/).filter(s => s.trim());
      let currentChunk = "";
      for (const s of sentences) {
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
  const [isSyncing, setIsSyncing] = useState(true);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showNewChatPanel, setShowNewChatPanel] = useState(false);
  const [showNewGroupPanel, setShowNewGroupPanel] = useState(false);
  const [showUserProfilePanel, setShowUserProfilePanel] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showCalendarWidget, setShowCalendarWidget] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const [user, setUser] = useState<UserProfile>({
    name: 'You',
    about: 'Hey there! I am using WhatsApp.',
    status: 'Available',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop'
  });

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

  // --- SUPABASE MIGRATION & REALTIME LOGIC ---
  useEffect(() => {
    const initializeCloud = async () => {
      const isMigrated = localStorage.getItem('supabase_migrated');
      const savedChatsRaw = localStorage.getItem('whatsapp_chats');
      const savedChats = JSON.parse(savedChatsRaw || '[]');
      
      // Safety Check: If cloud is empty, perform a rescue migration
      if (!isMigrated || savedChats.length > 0) {
        const { count } = await supabase.from('chats').select('*', { count: 'exact', head: true });
        if (!count || count === 0) {
           console.log("Cloud is empty. Performing safety migration...");
           try {
             for (const chat of savedChats) {
                await supabase.from('chats').upsert({
                    id: chat.id,
                    name: chat.name,
                    avatar: chat.avatar,
                    is_group: !!chat.isGroup,
                    member_ids: chat.memberIds,
                    automation: chat.automation,
                    last_message: chat.lastMessage,
                    last_message_time: chat.lastMessageTime
                });
                
                if (chat.messages?.length > 0) {
                    const msgsToMigrate = chat.messages.map((m: any) => ({
                        id: m.id,
                        chat_id: chat.id,
                        text: m.text,
                        sender: m.sender,
                        sender_name: m.senderName,
                        sender_id: m.senderId,
                        timestamp: m.timestamp,
                        status: m.status,
                        reply_to_json: m.replyToMessage
                    }));
                    await supabase.from('messages').upsert(msgsToMigrate);
                }
             }
             localStorage.setItem('supabase_migrated', 'true');
           } catch (e) { console.error("Rescue migration failed", e); }
        }
      }

      // Sync local state with Cloud (initial load)
      const { data: cloudChats } = await supabase.from('chats').select('*');
      if (cloudChats && cloudChats.length > 0) {
        const fullChats = await Promise.all(cloudChats.map(async c => {
          const { data: msgs } = await supabase.from('messages').select('*').eq('chat_id', c.id).order('created_at', { ascending: true });
          const localChat = savedChats.find((lc: any) => lc.id === c.id);
          return {
            id: c.id,
            name: c.name,
            avatar: c.avatar,
            isGroup: c.is_group,
            memberIds: c.member_ids,
            automation: c.automation || localChat?.automation,
            lastMessage: c.last_message,
            lastMessageTime: c.last_message_time,
            unreadCount: c.unread_count,
            messages: (msgs || []).map(m => ({
              id: m.id,
              text: m.text,
              sender: m.sender,
              senderName: m.sender_name,
              senderId: m.sender_id,
              timestamp: m.timestamp,
              status: m.status,
              replyToMessage: m.reply_to_json
            }))
          };
        }));
        setChats(fullChats as Chat[]);
      }

      const channel = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const newMsg = payload.new as any;
          setChats(current => current.map(c => {
            if (c.id === newMsg.chat_id) {
              if (c.messages.some(m => m.id === newMsg.id)) return c;
              return {
                ...c,
                messages: [...c.messages, {
                  id: newMsg.id,
                  text: newMsg.text,
                  sender: newMsg.sender,
                  senderName: newMsg.sender_name,
                  senderId: newMsg.sender_id,
                  timestamp: newMsg.timestamp,
                  status: newMsg.status,
                  replyToMessage: newMsg.reply_to_json
                }],
                lastMessage: newMsg.sender === 'other' ? `${newMsg.sender_name || 'AI'}: ${newMsg.text}` : newMsg.text,
                lastMessageTime: newMsg.timestamp,
                unreadCount: (activeChatId !== c.id && newMsg.sender === 'other') ? (c.unreadCount || 0) + 1 : c.unreadCount
              };
            }
            return c;
          }));
        })
        .subscribe();

      setIsSyncing(false);
      return () => { supabase.removeChannel(channel); };
    };
    initializeCloud();
  }, []);

  useEffect(() => {
    localStorage.setItem('whatsapp_settings', JSON.stringify(settings));
    
    // Sync Gemini Key to Cloud for 24/7 Heartbeat
    if (settings.apiKey) {
      supabase.from('config').upsert({
        id: 'gemini_api_key',
        value: { key: settings.apiKey }
      }).then();
    }
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('whatsapp_chats', JSON.stringify(chats));
  }, [chats]);

  // --- WEB PUSH REGISTRATION ---
  useEffect(() => {
    if (settings.enableNotifications && 'serviceWorker' in navigator && 'PushManager' in window) {
      const registerPush = async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'BFOAoBwVZcK6EosPk4JLzDvT9g8bxmWQi9zdWsA075NzDIHT79bR5qfQXcNTjymmqdWvNIcZUc-sGbSnyX--Dl4'
          });
          
          await supabase.from('config').upsert({
            id: 'push_subscription',
            value: subscription
          });
          console.log("Push registered:", subscription);
        } catch (err) {
          console.error("Push registration failed:", err);
        }
      };
      registerPush();
    }
  }, [settings.enableNotifications]);

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

  const handleAutomationTrigger = async (chatId: string, context: string) => {
    const targetChat = chats.find(c => c.id === chatId);
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

      const response = await getGeminiResponse({ ...targetChat }, hydratedHistory, settings.shareUserInfo ? user : undefined, undefined, settings, context);
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

        // Cloud Write
        await supabase.from('messages').insert({
          id: aiMsg.id,
          chat_id: chatId,
          text: aiMsg.text,
          sender: aiMsg.sender,
          timestamp: aiMsg.timestamp,
          status: aiMsg.status
        });
        await supabase.from('chats').update({ last_message: chunk, last_message_time: aiMsg.timestamp }).eq('id', chatId);

        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, aiMsg], lastMessage: chunk, lastMessageTime: aiMsg.timestamp, unreadCount: (c.unreadCount || 0) + 1 } : c));

        const isFocusingChat = !document.hidden && activeChatId === chatId;
        if (settings.enableNotifications && !isFocusingChat && document.hidden) {
          document.title = `(1) New Message - ${targetChat.name}`;
          showNotification(targetChat.name, { body: chunk, icon: targetChat.avatar, tag: chatId });
        }
        if (i < chunks.length - 1) {
          setChatStatus(chatId, 'online');
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      setChatStatus(chatId, 'offline');
    } catch (error) {
      console.error("Error in automation:", error);
      setChatStatus(chatId, 'offline');
    }
  };

  const handleSendMessage = async (text: string, attachment?: FileAttachment, replyTo?: Message) => {
    if (!activeChat) return;
    const timestamp = getFormattedTime();
    let mediaId = '';
    if (attachment && (attachment.type === 'image' || attachment.type === 'audio')) {
      mediaId = `media-${Date.now()}`;
      try { await saveMedia(mediaId, attachment.data); } catch (err) { console.error(err); }
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      attachment: attachment ? { ...attachment, data: (attachment.type === 'image' || attachment.type === 'audio') ? '' : attachment.data, mediaId } : undefined,
      mediaId,
      sender: 'me',
      timestamp,
      status: 'sent',
      replyToMessage: replyTo
    };

    setReplyingTo(null);

    // Cloud Write
    let lastMsgStr = text || 'Attachment';
    if (attachment?.type === 'image') lastMsgStr = '📷 Photo' + (text ? `: ${text}` : '');
    if (attachment?.type === 'document') lastMsgStr = '📄 Document' + (text ? `: ${text}` : '');

    try {
      await supabase.from('messages').insert({
        id: userMsg.id,
        chat_id: activeChat.id,
        text: userMsg.text,
        sender: userMsg.sender,
        timestamp: userMsg.timestamp,
        status: userMsg.status,
        reply_to_json: userMsg.replyToMessage
      });
      await supabase.from('chats').update({ last_message: lastMsgStr, last_message_time: timestamp }).eq('id', activeChat.id);
    } catch (err) { console.error("Cloud send failed:", err); }

    // Local state update silenced here - relying on Supabase Realtime for display
    // setChats(prev => prev.map(chat => chat.id === activeChat.id ? { ...chat, lastMessage: lastMsgStr, lastMessageTime: timestamp, messages: [...chat.messages, userMsg] } : chat));

    if (activeChat.isGroup) {
      handleGroupResponse(activeChat, [...activeChat.messages, userMsg]);
    } else {
      handleSingleResponse(activeChat, [...activeChat.messages, userMsg]);
    }
  };

  const handleSingleResponse = async (chat: Chat, updatedHistory: Message[]) => {
    const chatId = chat.id;
    try {
      setChatStatus(chatId, 'typing...');
      const hydratedHistory = await Promise.all(updatedHistory.map(async m => {
        const mediaId = m.mediaId || m.attachment?.mediaId;
        const mediaData = mediaId ? await getMedia(mediaId) : undefined;
        let text = m.text;
        if (m.replyToMessage) text = `[Replying to: "${m.replyToMessage.text}"] ` + text;
        return { text, sender: m.sender, image: mediaData && (m.attachment?.type === 'image' || m.image) ? mediaData : undefined, audio: mediaData && m.attachment?.type === 'audio' ? mediaData : undefined };
      }));

      const response = await getGeminiResponse({ ...chat }, hydratedHistory, settings.shareUserInfo ? user : undefined, undefined, settings);
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

        // Cloud Write
        await supabase.from('messages').insert({ id: aiMsg.id, chat_id: chatId, text: aiMsg.text, sender: aiMsg.sender, timestamp: aiMsg.timestamp, status: aiMsg.status });
        await supabase.from('chats').update({ last_message: chunk, last_message_time: aiMsg.timestamp }).eq('id', chatId);

        // Local state update silenced here - relying on Supabase Realtime for display
        // setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, aiMsg], lastMessage: chunk, lastMessageTime: aiMsg.timestamp, unreadCount: (c.unreadCount || 0) + 1 } : c));

        const isFocusingChat = !document.hidden && activeChatId === chatId;
        if (settings.enableNotifications && !isFocusingChat && document.hidden) {
          document.title = `(1) New Message - ${chat.name}`;
          showNotification(chat.name, { body: chunk, icon: chat.avatar, tag: chat.id });
        }
        if (i < chunks.length - 1) {
          setChatStatus(chatId, 'online');
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      setChatStatus(chatId, 'offline');
    } catch (error) {
      console.error(error);
      setChatStatus(chatId, 'offline');
    }
  };

  const handleGroupResponse = async (group: Chat, updatedHistory: Message[]) => {
    const memberIds = group.memberIds || [];
    if (memberIds.length === 0) return;
    let responseSequence = [...memberIds].sort(() => Math.random() - 0.5);
    let currentHistory = [...updatedHistory];

    for (let i = 0; i < responseSequence.length; i++) {
      const responderId = responseSequence[i];
      const persona = chats.find(c => c.id === responderId);
      if (!persona) continue;
      try {
        const delay = 1500 + (Math.random() * 2500);
        await new Promise(resolve => setTimeout(resolve, delay));
        setChatStatus(group.id, 'typing...');

        const hydratedGroupHistory = await Promise.all(currentHistory.map(async m => {
          const mediaId = m.mediaId || m.attachment?.mediaId;
          const mediaData = mediaId ? await getMedia(mediaId) : undefined;
          let text = m.text;
          if (m.replyToMessage) text = `[Replying to: "${m.replyToMessage.text}"] ` + text;
          return { text, sender: m.sender, senderName: m.senderName, image: mediaData && (m.attachment?.type === 'image' || m.image) ? mediaData : undefined, audio: mediaData && m.attachment?.type === 'audio' ? mediaData : undefined };
        }));

        const responseText = await getGeminiResponse({ ...persona }, hydratedGroupHistory, settings.shareUserInfo ? user : undefined, { groupName: group.name, otherMembers: group.memberIds?.filter(id => id !== responderId).map(id => chats.find(c => c.id === id)?.name || '') || [] }, settings);
        const chunks = splitMessage(responseText);

        for (let j = 0; j < chunks.length; j++) {
          const chunk = chunks[j];
          const typingDuration = Math.min(Math.max(chunk.length * 40, 1500), 4000);
          setChatStatus(group.id, 'typing...');
          await new Promise(resolve => setTimeout(resolve, typingDuration));

          const aiMsg: Message = { id: `${Date.now()}-${i}-${j}`, text: chunk, sender: 'other', senderName: persona.name, senderId: persona.id, timestamp: getFormattedTime(), status: 'delivered' };
          currentHistory.push(aiMsg);

          // Cloud Write
          await supabase.from('messages').insert({ id: aiMsg.id, chat_id: group.id, text: aiMsg.text, sender: aiMsg.sender, sender_name: persona.name, sender_id: persona.id, timestamp: aiMsg.timestamp });
          await supabase.from('chats').update({ last_message: `${persona.name}: ${chunk}`, last_message_time: aiMsg.timestamp }).eq('id', group.id);

          // Local state update silenced here - relying on Supabase Realtime for display
          // setChats(prev => prev.map(c => c.id === group.id ? { ...c, messages: [...c.messages, aiMsg], lastMessage: `${persona.name}: ${chunk}`, lastMessageTime: aiMsg.timestamp, unreadCount: (c.unreadCount || 0) + 1 } : c));

          const isFocusingChat = !document.hidden && activeChatId === group.id;
          if (settings.enableNotifications && !isFocusingChat && document.hidden) {
            document.title = `(1) New Message - ${group.name}`;
            showNotification(`${group.name} - ${persona.name}`, { body: chunk, icon: persona.avatar, tag: group.id });
          }
        }
        setChatStatus(group.id, 'offline');
      } catch (error) { console.error(error); setChatStatus(group.id, 'offline'); }
    }
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

  const handleBack = () => window.history.back();

  const handleCreateGroup = async (data: { name: string; avatar: string; memberIds: string[] }) => {
    const newGroup: Chat = {
      id: `group-${Date.now()}`,
      name: data.name,
      avatar: data.avatar,
      memberIds: data.memberIds,
      isGroup: true,
      lastMessage: 'Group created',
      lastMessageTime: getFormattedTime(),
      messages: [{ id: 'init', text: `Welcome to ${data.name}!`, sender: 'other', senderName: 'System', timestamp: '--' }]
    };
    
    await supabase.from('chats').insert({ id: newGroup.id, name: newGroup.name, avatar: newGroup.avatar, is_group: true, member_ids: newGroup.memberIds });
    await supabase.from('messages').insert({ id: 'init', chat_id: newGroup.id, text: newGroup.messages[0].text, sender: 'other', sender_name: 'System', timestamp: '--' });

    setChats([newGroup, ...chats]);
    setActiveChatId(newGroup.id);
    setShowNewGroupPanel(false);
  };

  const handleCreatePersona = async (personaData: any) => {
    const newPersona: Chat = { ...personaData, id: Date.now().toString(), lastMessage: '', lastMessageTime: '', messages: [], status: 'offline' };
    await supabase.from('chats').insert({ id: newPersona.id, name: newPersona.name, avatar: newPersona.avatar, automation: newPersona.automation });
    setChats([newPersona, ...chats]);
    setActiveChatId(newPersona.id);
    setShowNewChatPanel(false);
  };

  const updateActiveChat = async (updates: Partial<Chat>) => {
    if (!activeChatId) return;
    await supabase.from('chats').update({ name: updates.name, avatar: updates.avatar, automation: updates.automation }).eq('id', activeChatId);
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, ...updates } : c));
  };

  const handleDeleteChat = async () => {
    if (!activeChatId) return;
    await supabase.from('chats').delete().eq('id', activeChatId);
    setChats(prev => prev.filter(c => c.id !== activeChatId));
    setActiveChatId('');
    setShowProfilePanel(false);
  };

  const handleClearChat = async () => {
    if (!activeChatId) return;
    await supabase.from('messages').delete().eq('chat_id', activeChatId);
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [], lastMessage: '', lastMessageTime: '' } : c));
  };

  // Local Automation Loop (Fallback)
  useEffect(() => {
    const interval = setInterval(() => {
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

          for (let j = 0; j < automation.timeTriggers.length; j++) {
            const trigger = automation.timeTriggers[j];
            if (trigger.lastTriggered === todayDateStr) continue;
            if (currentTimeStr >= trigger.startTime && currentTimeStr <= trigger.endTime) {
              if (Math.random() < 0.6) { trigger.lastTriggered = todayDateStr; triggeredContext = trigger.context; chatUpdated = true; break; }
            }
          }
          if (!triggeredContext && automation.inactivity.enabled) {
             const lastMsgMe = [...chat.messages].reverse().find(m => m.sender === 'me');
             if (lastMsgMe) {
               let msgTime = parseInt(lastMsgMe.id, 10);
               if (isNaN(msgTime) || msgTime <= 0) msgTime = Date.now() - (24 * 60 * 60 * 1000);
               const hoursSinceLastOurs = (Date.now() - msgTime) / (1000 * 60 * 60);
               if (hoursSinceLastOurs >= automation.inactivity.minHours) {
                  if ((automation.lastInactivityTriggered || 0) < msgTime) {
                    if (hoursSinceLastOurs >= automation.inactivity.maxHours || Math.random() < 0.3) {
                      automation.lastInactivityTriggered = Date.now();
                      triggeredContext = "The user has been inactive for several hours. Send a friendly natural check-in message based on the last conversation context.";
                      chatUpdated = true;
                    }
                  }
               }
             }
          }
          if (triggeredContext) {
            const idToTrig = chat.id;
            const ctxToTrig = triggeredContext;
            setTimeout(() => handleAutomationTrigger(idToTrig, ctxToTrig), 500);
          }
        }
        return chatUpdated ? updatedChats : prevChats;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [settings.enableNotifications]);

  // Handle mobile navigation back safely
  useEffect(() => {
    const isPanelOpen = showSettingsPopover || showNewChatPanel || showNewGroupPanel || showUserProfilePanel || showCalendarWidget || showProfilePanel;
    if (isMobile && isPanelOpen) window.history.pushState({ panelOpen: true }, '');
    const handlePopState = () => {
      if (isPanelOpen) {
        setShowProfilePanel(false); setShowNewChatPanel(false); setShowNewGroupPanel(false); setShowUserProfilePanel(false); setShowSettingsPopover(false); setShowCalendarWidget(false);
      } else if (activeView === 'chat') { setActiveView('list'); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeView, isMobile, showSettingsPopover, showNewChatPanel, showNewGroupPanel, showUserProfilePanel, showCalendarWidget, showProfilePanel]);

  return (
    <div className="h-screen w-full flex flex-col bg-white overflow-hidden p-0">
      <div className="hidden md:flex h-[30px] app-panel items-center px-3 gap-2 shrink-0 border-b app-border select-none bg-[#f0f2f5] dark:bg-[#202c33]">
        <div className="bg-[#25d366] p-[2px] rounded flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="white"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.767 5.767 0 1.267.405 2.436 1.096 3.389l-.711 2.597 2.659-.697a5.733 5.733 0 0 0 2.723.678c3.181 0 5.767-2.586 5.767-5.767 0-3.181-2.586-5.767-5.767-5.767zm3.39 8.136c-.147.414-.733.754-1.011.802-.278.048-.543.085-1.545-.303-1.002-.387-1.649-1.398-1.698-1.464-.048-.066-.401-.532-.401-1.022 0-.49.255-.731.345-.83.09-.099.198-.122.264-.122.066 0 .132.001.189.004.057.002.132-.023.208.156.075.18.255.621.28.669.024.047.04.103.01.16-.03.057-.045.094-.09.146-.045.052-.094.113-.137.151-.047.042-.094.085-.042.174.052.09.231.382.495.617.34.303.623.396.711.439.088.042.141.033.193-.028.052-.061.222-.259.283-.349.061-.088.122-.075.208-.042.085.033.543.255.637.302.094.047.156.071.18.113.023.042.023.245-.124.659zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" /></svg>
        </div>
        <span className="text-[12px] font-semibold text-secondary">WhatsApp</span>
      </div>

      <div className="flex-1 flex overflow-hidden bg-white relative">
        <div className={`hidden md:block`}>
          <Sidebar userAvatar={user.avatar} onUserProfileClick={() => setShowUserProfilePanel(!showUserProfilePanel)} onSettingsClick={() => setShowSettingsPopover(!showSettingsPopover)} onCalendarClick={() => setShowCalendarWidget(!showCalendarWidget)} />
        </div>

        {showNewChatPanel && <NewChatPanel onClose={() => setShowNewChatPanel(false)} onCreate={handleCreatePersona} />}
        {showNewGroupPanel && <NewGroupPanel personas={chats.filter(c => !c.isGroup)} onClose={() => setShowNewGroupPanel(false)} onCreate={handleCreateGroup} />}
        {showUserProfilePanel && <UserProfilePanel user={user} onClose={() => setShowUserProfilePanel(false)} onUpdate={setUser} />}
        {showSettingsPopover && <SettingsPopover settings={settings} onUpdate={setSettings} onClose={() => setShowSettingsPopover(false)} />}
        {showCalendarWidget && <CalendarNotesWidget notes={settings.calendarNotes || ''} onUpdateNotes={(notes) => setSettings({ ...settings, calendarNotes: notes })} onClose={() => setShowCalendarWidget(false)} />}

        <div className={`${isMobile && activeView === 'chat' ? 'hidden' : 'flex'} w-full md:w-[410px] md:flex shrink-0 flex-col h-full border-r app-border`}>
          <ChatList chats={chats} activeChatId={activeChatId} onChatSelect={handleChatSelect} onAddPersona={() => setShowNewChatPanel(true)} onAddGroup={() => setShowNewGroupPanel(true)} onMetaAIClick={() => handleChatSelect('6')} isMobile={isMobile} />
          {isMobile && <MobileNavigation unreadCount={unreadTotal} />}
        </div>

        <div className={`${isMobile && activeView === 'list' ? 'hidden' : 'flex'} flex-1 flex-col min-w-0 bg-[#efeae2] dark:bg-[#0b141a]`}>
          <ChatWindow chat={activeChat} allChats={chats} onHeaderClick={() => setShowProfilePanel(!showProfilePanel)} onDeleteChat={handleDeleteChat} onClearChat={handleClearChat} searchTerm={chatSearchTerm} setSearchTerm={setChatSearchTerm} onBack={isMobile ? handleBack : undefined} onProfileClick={() => setShowUserProfilePanel(true)} onMetaAIClick={() => handleChatSelect('6')} onAddContact={() => setShowNewChatPanel(true)} onReply={setReplyingTo} />
          {activeChat && (!isMobile || !showProfilePanel) && (
            <MessageInput activeChatId={activeChatId} onSendMessage={handleSendMessage} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} />
          )}
        </div>

        {showProfilePanel && activeChat && (
          <ProfilePanel chat={activeChat} allChats={chats} onClose={() => setShowProfilePanel(false)} onUpdate={updateActiveChat} onDeleteChat={handleDeleteChat} onClearChat={handleClearChat} onTestAutomation={(chatId, type, contextOverride) => {
              setShowProfilePanel(false);
              const customContext = type === 'inactivity' ? "Sent check-in." : `Trigger unique greeting: "${contextOverride}"`;
              handleAutomationTrigger(chatId, customContext);
            }}
          />
        )}
        {isMobile && activeView === 'list' && !showSettingsPopover && !showNewChatPanel && !showNewGroupPanel && !showUserProfilePanel && !showCalendarWidget && !showProfilePanel && (
          <MobileActionFAB onAddPersona={() => setShowNewChatPanel(true)} onAddGroup={() => setShowNewGroupPanel(true)} onProfileClick={() => setShowUserProfilePanel(true)} onSettingsClick={() => setShowSettingsPopover(true)} onCalendarClick={() => setShowCalendarWidget(true)} onMetaAIClick={() => handleChatSelect('6')} />
        )}
      </div>
    </div>
  );
};

export default App;
