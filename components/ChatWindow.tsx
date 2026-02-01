
import React, { useRef, useEffect, useState } from 'react';
import { Search, MoreVertical, CheckCheck, Lock, X, Trash2, Info, Eraser, FileText, UserPlus, File, Download } from 'lucide-react';
import { Chat, Message } from '../types';

interface ChatWindowProps {
  chat: Chat | null;
  allChats: Chat[];
  onHeaderClick: () => void;
  onDeleteChat: () => void;
  onClearChat: () => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  onAddContact?: () => void;
}

const MEMBER_COLORS = ['#35a62e', '#e542a3', '#9141ac', '#dfa633', '#1d88e5'];

const ConfirmationModal: React.FC<{
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  isDanger?: boolean;
}> = ({ onConfirm, onCancel, title, message, confirmLabel, isDanger = true }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-in fade-in duration-200 px-4">
      <div className="app-panel rounded-md shadow-2xl max-w-sm w-full p-6 animate-in zoom-in duration-200 border app-border">
        <h3 className="text-[19px] font-medium text-primary mb-4">{title}</h3>
        <p className="text-[14.5px] text-secondary leading-relaxed mb-8">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded border app-border text-[#00a884] font-medium text-[14px] hover:bg-black/5 transition-colors uppercase"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2 rounded text-white font-medium text-[14px] transition-colors shadow-sm uppercase ${isDanger ? 'bg-[#ea0038] hover:bg-[#c4002f]' : 'bg-[#00a884] hover:bg-[#008069]'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{ message: Message; highlight?: boolean; isGroup?: boolean }> = ({ message, highlight, isGroup }) => {
  const isMe = message.sender === 'me';
  const nameColor = isGroup && !isMe ? MEMBER_COLORS[Math.abs(message.senderName?.length || 0) % MEMBER_COLORS.length] : '';
  const hasAttachment = !!message.attachment || !!message.image || !!message.mediaId;
  const [mediaData, setMediaData] = useState<string | null>(null);

  useEffect(() => {
    const loadMedia = async () => {
      const mediaId = message.mediaId || message.attachment?.mediaId;
      if (mediaId) {
        try {
          const { getMedia } = await import('../utils/storage');
          const data = await getMedia(mediaId);
          if (data) setMediaData(data);
        } catch (err) {
          console.error("Error loading media from IndexedDB", err);
        }
      }
    };
    loadMedia();
  }, [message.mediaId, message.attachment?.mediaId]);

  const imageSrc = mediaData || message.image || (message.attachment?.type === 'image' ? message.attachment.data : null);

  return (
    <div className={`flex w-full mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] p-1 rounded-lg shadow-sm relative transition-all duration-300 ${highlight ? 'ring-2 ring-[#00a884]' : ''} ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}`}
        style={{ backgroundColor: isMe ? 'var(--bubble-me)' : 'var(--bubble-other)' }}
      >
        {isGroup && !isMe && message.senderName && (
          <div className="text-[13px] font-bold mb-1 px-2 pt-1" style={{ color: nameColor }}>
            {message.senderName}
          </div>
        )}

        {/* Render Image Attachment with Intelligent Scaling */}
        {imageSrc && (
          <div className="p-0.5 overflow-hidden">
            <img
              src={imageSrc}
              alt="Sent content"
              className="rounded-md w-full max-h-[450px] object-contain block shadow-sm bg-black/5 dark:bg-white/5"
              loading="lazy"
            />
          </div>
        )}

        {/* Render Document Attachment */}
        {message.attachment?.type === 'document' && (
          <div className="p-2 flex items-center gap-3 bg-black/5 dark:bg-black/20 rounded-md mb-1 border border-black/5 hover:bg-black/10 transition-colors cursor-pointer group">
            <div className="w-12 h-12 bg-[#00a884] rounded flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-primary font-medium truncate">{message.attachment.name}</p>
              <p className="text-[12px] text-secondary uppercase font-bold tracking-tighter">Document</p>
            </div>
            <Download size={20} className="text-secondary cursor-pointer hover:text-[#00a884] transition-colors" />
          </div>
        )}

        {/* Text Content (Caption or Message) */}
        <div className="px-2 py-1 flex flex-col relative">
          {message.text && (
            <p className={`text-[14.5px] text-primary whitespace-pre-wrap break-words pr-12 ${hasAttachment ? 'pt-1 pb-4' : 'pb-3'}`}>
              {message.text}
            </p>
          )}

          {/* Timestamp and Status */}
          <div className={`flex items-center gap-1 self-end ${message.text ? 'absolute bottom-1 right-2' : 'mt-1 mb-0.5 mr-1'}`}>
            <span className="text-[10px] text-secondary uppercase whitespace-nowrap font-medium">{message.timestamp}</span>
            {isMe && (
              <span className="text-[#53bdeb]">
                <CheckCheck size={16} />
              </span>
            )}
          </div>
        </div>

        {/* Bubble Tail */}
        <div
          className={`absolute top-0 ${isMe ? '-right-2 border-l-[10px]' : '-left-2 border-r-[10px]'} border-t-[10px] border-t-transparent`}
          style={{
            borderLeftColor: isMe ? 'var(--bubble-me)' : 'transparent',
            borderRightColor: !isMe ? 'var(--bubble-other)' : 'transparent'
          }}
        />
      </div>
    </div >
  );
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ chat, allChats, onHeaderClick, onDeleteChat, onClearChat, searchTerm, setSearchTerm, onAddContact }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat?.messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!chat) {
    return (
      <div className="flex-1 app-header flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-300">
        <div className="flex gap-8 relative z-10 p-12 border rounded-xl app-border bg-[#f8f9fa] dark:bg-[#182229] shadow-sm">
          {/* Send Document Shortcut */}
          <div className="flex flex-col items-center gap-3 group cursor-pointer">
            <div className="w-20 h-20 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#54656f] group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-all active:scale-95">
              <FileText size={32} />
            </div>
            <span className="text-[14px] text-secondary font-medium">Send document</span>
          </div>

          {/* Add Contact Shortcut */}
          <div className="flex flex-col items-center gap-3 group cursor-pointer" onClick={onAddContact}>
            <div className="w-20 h-20 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#54656f] group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-all active:scale-95">
              <UserPlus size={32} />
            </div>
            <span className="text-[14px] text-secondary font-medium">Add contact</span>
          </div>

          {/* Ask Meta AI Shortcut */}
          <div className="flex flex-col items-center gap-3 group cursor-pointer">
            <div className="w-20 h-20 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-all active:scale-95">
              <div className="w-8 h-8 rounded-full border-[3px] p-[1px] bg-clip-border"
                style={{
                  background: 'linear-gradient(45deg, #00d2ff 0%, #3a7bd5 50%, #8e2de2 100%)',
                  borderColor: 'transparent'
                }}>
                <div className="w-full h-full rounded-full bg-[#f8f9fa] dark:bg-[#182229]"></div>
              </div>
            </div>
            <span className="text-[14px] text-secondary font-medium">Ask Meta AI</span>
          </div>
        </div>
      </div>
    );
  }

  const filteredMessages = chat.messages.filter(msg =>
    !searchTerm || msg.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGroupMembersLabel = () => {
    if (!chat.isGroup || !chat.memberIds) return chat.status || 'online';
    const names = chat.memberIds.map(id => allChats.find(c => id === c.id)?.name).filter(Boolean);
    return [...names, 'You'].join(', ');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 app-chat-bg relative overflow-hidden transition-colors duration-300">
      {showDeleteModal && (
        <ConfirmationModal
          title={chat.isGroup ? "Exit group?" : "Delete this persona?"}
          message={chat.isGroup ? `Are you sure you want to exit and delete "${chat.name}"?` : `Are you sure you want to delete "${chat.name}"? This will remove the contact and all associated message history.`}
          confirmLabel={chat.isGroup ? "Exit" : "Delete"}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={() => {
            onDeleteChat();
            setShowDeleteModal(false);
          }}
        />
      )}

      {showClearModal && (
        <ConfirmationModal
          title="Clear messages?"
          message={`Are you sure you want to clear all messages in "${chat.name}"?`}
          confirmLabel="Clear Chat"
          onCancel={() => setShowClearModal(false)}
          onConfirm={() => {
            onClearChat();
            setShowClearModal(false);
          }}
        />
      )}

      {/* Chat Window Header */}
      <div className="h-[59px] app-header border-b app-border px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center cursor-pointer flex-1 min-w-0" onClick={onHeaderClick}>
          <img src={chat.avatar} alt={chat.name} className="w-10 h-10 rounded-full mr-3 object-cover shadow-sm" />
          <div className="flex flex-col min-w-0">
            <h2 className="text-[16px] text-primary font-medium leading-none truncate">{chat.name}</h2>
            <span className="text-[12.5px] text-secondary mt-1.5 truncate">
              {getGroupMembersLabel()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-secondary relative">
          <Search
            size={20}
            className={`cursor-pointer transition-colors ${showSearch ? 'text-[#00a884]' : 'hover:text-primary'}`}
            onClick={() => setShowSearch(!showSearch)}
          />
          <div className="relative" ref={menuRef}>
            < MoreVertical size={20} className="cursor-pointer hover:text-primary transition-colors" onClick={() => setShowMenu(!showMenu)} />
            {showMenu && (
              <div className="absolute right-0 top-10 w-[200px] app-panel shadow-xl rounded-md py-2 z-50 animate-in fade-in zoom-in duration-200 origin-top-right border app-border">
                <button
                  onClick={() => { onHeaderClick(); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 text-[14.5px] text-[#3b4a54] hover:bg-black/5 flex items-center gap-3 transition-colors"
                >
                  <Info size={18} className="text-[#667781]" /> {chat.isGroup ? 'Group info' : 'Contact info'}
                </button>
                <button
                  onClick={() => { setShowClearModal(true); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 text-[14.5px] text-[#3b4a54] hover:bg-black/5 flex items-center gap-3 transition-colors"
                >
                  <Eraser size={18} className="text-[#667781]" /> Clear chat
                </button>
                <div className="h-[1px] bg-black/5 my-1 mx-2" />
                <button
                  onClick={() => { setShowDeleteModal(true); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 text-[14.5px] text-red-500 hover:bg-red-500/5 flex items-center gap-3 transition-colors"
                >
                  <Trash2 size={18} /> {chat.isGroup ? 'Exit Group' : 'Delete persona'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Search Bar Overlay */}
      {showSearch && (
        <div className="app-header border-b app-border px-4 py-2 flex items-center gap-3 animate-in slide-in-from-top duration-200 shadow-sm z-20 shrink-0">
          <div className="flex-1 app-panel rounded-lg px-3 py-1.5 flex items-center gap-3 border app-border focus-within:ring-1 focus-within:ring-[#00a884]/20">
            <Search size={16} className="text-secondary" />
            <input
              type="text"
              placeholder="Search in chat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 outline-none text-[15px] bg-transparent text-primary"
              autoFocus
            />
          </div>
          <X
            size={20}
            className="text-secondary cursor-pointer hover:text-primary transition-colors"
            onClick={() => { setShowSearch(false); setSearchTerm(''); }}
          />
        </div>
      )}

      {/* Main Chat Scroll Area */}
      <div
        className="absolute inset-0 flex flex-col p-4 sm:p-10 space-y-1 overflow-y-auto pointer-events-auto z-10"
        ref={scrollRef}
      >
        <div className="flex justify-center my-4">
          <div className="encryption-box text-[12.5px] px-3 py-2 rounded-lg shadow-sm flex items-center gap-2 max-w-[500px] text-center border app-border">
            <Lock size={12} className="shrink-0 opacity-60" />
            <span>Messages are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.</span>
          </div>
        </div>

        {searchTerm && filteredMessages.length === 0 && (
          <div className="flex justify-center py-10">
            <span className="app-header px-4 py-2 rounded-lg text-secondary text-[13px] shadow-sm">
              No messages found matching "{searchTerm}"
            </span>
          </div>
        )}

        {filteredMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} highlight={!!searchTerm} isGroup={chat.isGroup} />
        ))}
      </div>

      {/* Theme-Aware Wallpaper Layer */}
      <div className="absolute inset-0 pointer-events-none chat-wallpaper transition-all duration-500" />
    </div>
  );
};
