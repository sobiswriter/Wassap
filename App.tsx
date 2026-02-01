
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { MessageInput } from './components/MessageInput';
import { ProfilePanel } from './components/ProfilePanel';
import { NewChatPanel } from './components/NewChatPanel';
import { NewGroupPanel } from './components/NewGroupPanel';
import { UserProfilePanel } from './components/UserProfilePanel';
import { SettingsPopover } from './components/SettingsPopover';
import { INITIAL_CHATS } from './constants';
import { Chat, Message, UserProfile, AppSettings, FileAttachment } from './types';
import { getGeminiResponse } from './services/geminiService';

const App: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showNewChatPanel, setShowNewChatPanel] = useState(false);
  const [showNewGroupPanel, setShowNewGroupPanel] = useState(false);
  const [showUserProfilePanel, setShowUserProfilePanel] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState('');

  // User and Settings State
  const [user, setUser] = useState<UserProfile>({
    name: 'You',
    about: 'Hey there! I am using WhatsApp.',
    status: 'Available',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop'
  });

  const [settings, setSettings] = useState<AppSettings>({
    theme: 'light',
    shareUserInfo: true
  });

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [settings.theme]);

  const handleSendMessage = async (text: string, attachment?: FileAttachment) => {
    if (!activeChat) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
    
    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      attachment,
      image: attachment?.type === 'image' ? attachment.data : undefined,
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
    setTimeout(async () => {
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, status: 'typing...' } : c));
      
      const response = await getGeminiResponse(
        { ...chat }, 
        updatedHistory.map(m => ({ text: m.text, sender: m.sender, image: m.image || m.attachment?.data })),
        settings.shareUserInfo ? user : undefined
      );

      const aiMsg: Message = {
        id: Date.now().toString(),
        text: response,
        sender: 'other',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase(),
      };

      setChats(prev => prev.map(c => c.id === chat.id ? {
        ...c,
        status: 'online',
        lastMessage: response,
        lastMessageTime: aiMsg.timestamp,
        messages: [...c.messages, aiMsg]
      } : c));
    }, 1500);
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

      const delay = 1500 + (Math.random() * 2500);
      await new Promise(resolve => setTimeout(resolve, delay));

      setChats(prev => prev.map(c => c.id === group.id ? { ...c, status: 'typing...' } : c));

      const responseText = await getGeminiResponse(
        { ...persona },
        currentHistory.map(m => ({ 
          text: m.text, 
          sender: m.sender, 
          senderName: m.senderName, 
          image: m.image || m.attachment?.data 
        })),
        settings.shareUserInfo ? user : undefined,
        { 
          groupName: group.name, 
          otherMembers: group.memberIds?.filter(id => id !== responderId).map(id => chats.find(c => id === id)?.name || '') || [] 
        }
      );

      const aiMsg: Message = {
        id: `${Date.now()}-${i}`,
        text: responseText,
        sender: 'other',
        senderName: persona.name,
        senderId: persona.id,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase(),
      };

      currentHistory.push(aiMsg);

      setChats(prev => prev.map(c => c.id === group.id ? {
        ...c,
        status: 'online',
        lastMessage: `${persona.name}: ${responseText}`,
        lastMessageTime: aiMsg.timestamp,
        messages: [...c.messages, aiMsg]
      } : c));
    }
  };

  const handleChatSelect = (id: string) => {
    setActiveChatId(id);
    setChats(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));
    setShowProfilePanel(false);
    setShowNewChatPanel(false);
    setShowNewGroupPanel(false);
    setChatSearchTerm('');
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
    setChats(prev => prev.filter(c => c.id !== activeChatId));
    setActiveChatId('');
    setShowProfilePanel(false);
  };

  const handleClearChat = () => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [] } : c));
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden p-0">
      {/* Top Title Bar */}
      <div className="h-[30px] app-panel flex items-center px-3 gap-2 shrink-0 border-b app-border select-none">
        <div className="bg-[#25d366] p-[2px] rounded flex items-center justify-center">
           <svg viewBox="0 0 24 24" width="14" height="14" fill="white">
             <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.767 5.767 0 1.267.405 2.436 1.096 3.389l-.711 2.597 2.659-.697a5.733 5.733 0 0 0 2.723.678c3.181 0 5.767-2.586 5.767-5.767 0-3.181-2.586-5.767-5.767-5.767zm3.39 8.136c-.147.414-.733.754-1.011.802-.278.048-.543.085-1.545-.303-1.002-.387-1.649-1.398-1.698-1.464-.048-.066-.401-.532-.401-1.022 0-.49.255-.731.345-.83.09-.099.198-.122.264-.122.066 0 .132.001.189.004.057.002.132-.023.208.156.075.18.255.621.28.669.024.047.04.103.01.16-.03.057-.045.094-.09.146-.045.052-.094.113-.137.151-.047.042-.094.085-.042.174.052.09.231.382.495.617.34.303.623.396.711.439.088.042.141.033.193-.028.052-.061.222-.259.283-.349.061-.088.122-.075.208-.042.085.033.543.255.637.302.094.047.156.071.18.113.023.042.023.245-.124.659zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
           </svg>
        </div>
        <span className="text-[12px] font-semibold text-[#54656f]">WhatsApp</span>
      </div>

      <div className="flex-1 flex overflow-hidden bg-white relative">
        <Sidebar 
          userAvatar={user.avatar}
          onUserProfileClick={() => setShowUserProfilePanel(!showUserProfilePanel)} 
          onSettingsClick={() => setShowSettingsPopover(!showSettingsPopover)} 
        />
        
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

        <ChatList 
          chats={chats} 
          activeChatId={activeChatId} 
          onChatSelect={handleChatSelect} 
          onAddPersona={() => setShowNewChatPanel(true)}
          onAddGroup={() => setShowNewGroupPanel(true)}
        />
        
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <ChatWindow 
            chat={activeChat} 
            allChats={chats}
            onHeaderClick={() => setShowProfilePanel(!showProfilePanel)}
            onDeleteChat={handleDeleteChat}
            onClearChat={handleClearChat}
            searchTerm={chatSearchTerm}
            setSearchTerm={setChatSearchTerm}
            onAddContact={() => setShowNewChatPanel(true)}
          />
          {activeChat && <MessageInput activeChatId={activeChatId} onSendMessage={handleSendMessage} />}
        </div>

        {showProfilePanel && activeChat && (
          <ProfilePanel 
            chat={activeChat} 
            allChats={chats}
            onClose={() => setShowProfilePanel(false)}
            onUpdate={updateActiveChat}
          />
        )}
      </div>
    </div>
  );
};

export default App;
