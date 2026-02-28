
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
import { SettingsPopover } from './components/SettingsPopover';
import { INITIAL_CHATS } from './constants';
import { Chat, Message, UserProfile, AppSettings, FileAttachment } from './types';
import { getGeminiResponse } from './services/geminiService';
import { saveMedia, getMedia } from './utils/storage';
import { MobileActionFAB } from './components/MobileActionFAB';

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

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Handle native back button on mobile
  useEffect(() => {
    const handlePopState = () => {
      if (activeView === 'chat') {
        setActiveView('list');
      } else {
        setShowProfilePanel(false);
        setShowNewChatPanel(false);
        setShowNewGroupPanel(false);
        setShowUserProfilePanel(false);
        setShowSettingsPopover(false);
        setShowCalendarWidget(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeView]);

  const setChatStatus = (chatId: string, status: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, status } : c));
  };

  const handleSendMessage = async (text: string, attachment?: FileAttachment) => {
    if (!activeChat) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();

    let mediaId = '';
    if (attachment && attachment.type === 'image') {
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
        data: attachment.type === 'image' ? '' : attachment.data, // Strip image data for storage
        mediaId
      } : undefined,
      image: undefined, // No longer storing full Base64 in message object
      mediaId,
      sender: 'me',
      timestamp,
      status: 'read'
    };

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
      setChatStatus(chatId, 'typing...');

      // Hydrate history with image data from IndexedDB so AI can see it
      const hydratedHistory = await Promise.all(updatedHistory.map(async m => {
        const mediaId = m.mediaId || m.attachment?.mediaId;
        const image = mediaId ? await getMedia(mediaId) : (m.image || m.attachment?.data);
        return {
          text: m.text,
          sender: m.sender,
          image: image || undefined
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

        // Realistic typing speed simulation (roughly 30-50ms per character)
        const typingDuration = Math.min(Math.max(chunk.length * 25, 600), 2000);

        // Ensure status is typing...
        setChatStatus(chatId, 'typing...');
        await new Promise(resolve => setTimeout(resolve, typingDuration));

        const aiMsg: Message = {
          id: `${Date.now()}-${i}`, // Unique ID per chunk
          text: chunk,
          sender: 'other',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

        // Small pause between messages to feel like the user is "hitting send"
        if (i < chunks.length - 1) {
          setChatStatus(chatId, 'online');
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      setChatStatus(chatId, 'online');
    } catch (error) {
      console.error("Error getting AI response for single chat:", error);
      setChatStatus(chatId, 'online'); // Revert status even on error
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

        // Hydrate group history with image data from IndexedDB
        const hydratedGroupHistory = await Promise.all(currentHistory.map(async m => {
          const mediaId = m.mediaId || m.attachment?.mediaId;
          const image = mediaId ? await getMedia(mediaId) : (m.image || m.attachment?.data);
          return {
            text: m.text,
            sender: m.sender,
            senderName: m.senderName,
            image: image || undefined
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
          const typingDuration = Math.min(Math.max(chunk.length * 20, 500), 1500);

          setChatStatus(group.id, 'typing...');
          await new Promise(resolve => setTimeout(resolve, typingDuration));

          const aiMsg: Message = {
            id: `${Date.now()}-${i}-${j}`, // Unique ID per chunk
            text: chunk,
            sender: 'other',
            senderName: persona.name,
            senderId: persona.id,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

          if (j < chunks.length - 1) {
            setChatStatus(group.id, 'online');
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        }

        setChatStatus(group.id, 'online');
      } catch (error) {
        console.error(`Error getting AI response for group member ${responderId}:`, error);
        setChatStatus(group.id, 'online'); // Revert status even on error
      }
    }
  };

  const handleChatSelect = (id: string) => {
    setActiveChatId(id);
    setChats(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));
    setShowProfilePanel(false);
    setShowNewChatPanel(false);
    setShowNewGroupPanel(false);
    setChatSearchTerm('');
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
      lastMessageTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase(),
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
      status: 'online',
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
      <div className="h-[30px] app-panel flex items-center px-3 gap-2 shrink-0 border-b app-border select-none">
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

        <div className={`${isMobile && activeView === 'chat' ? 'hidden' : 'flex'} w-full md:w-[410px] md:flex shrink-0`}>
          <ChatList
            chats={chats}
            activeChatId={activeChatId}
            onChatSelect={handleChatSelect}
            onAddPersona={() => setShowNewChatPanel(true)}
            onAddGroup={() => setShowNewGroupPanel(true)}
            onMetaAIClick={() => handleChatSelect('6')}
          />
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
          />
          {activeChat && (!isMobile || !showProfilePanel) && (
            <MessageInput activeChatId={activeChatId} onSendMessage={handleSendMessage} />
          )}
        </div>

        {showProfilePanel && activeChat && (
          <ProfilePanel
            chat={activeChat}
            allChats={chats}
            onClose={() => setShowProfilePanel(false)}
            onUpdate={updateActiveChat}
            onDeleteChat={handleDeleteChat}
            onClearChat={handleClearChat}
          />
        )}
        {/* Mobile Floating Action Button Hub */}
        {isMobile && activeView === 'list' && (
          <MobileActionFAB
            onAddPersona={() => setShowNewChatPanel(true)}
            onAddGroup={() => setShowNewGroupPanel(true)}
            onProfileClick={() => setShowUserProfilePanel(true)}
            onSettingsClick={() => setShowSettingsPopover(true)}
            onCalendarClick={() => setShowCalendarWidget(true)}
          />
        )}
      </div>
    </div>
  );
};

export default App;
