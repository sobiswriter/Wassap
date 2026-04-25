import React, { useRef, useEffect, useState } from 'react';
import { Search, MoreVertical, CheckCheck, Check, Lock, X, Trash2, Info, Eraser, FileText, UserPlus, File, Download, ArrowLeft, User, CornerDownLeft, Copy, Save } from 'lucide-react';
import { Chat, MemoryBubble, Message, AppSettings } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { formatChatDividerLabel, formatDateRangeLabel, getDaysBetween, getMessageDateKey, isDateInRange, normalizeDateKey } from '../utils/dates';
import { getGeminiDiaryEntry } from '../services/geminiService';
import { Sparkles, Loader2 } from 'lucide-react';

interface ChatWindowProps {
  chat: Chat | null;
  allChats: Chat[];
  onHeaderClick: () => void;
  onDeleteChat: () => void;
  onClearChat: () => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  onBack?: () => void;
  onProfileClick?: () => void;
  onMetaAIClick?: () => void;
  onAddContact?: () => void;
  onReply?: (message: Message) => void;
  onSaveMemory?: (chatId: string, memory: MemoryBubble) => void;
  settings?: AppSettings;
}

const MEMBER_COLORS = ['#35a62e', '#e542a3', '#9141ac', '#dfa633', '#1d88e5'];

const getSenderLabel = (message: Message, chat: Chat) => {
  if (message.sender === 'me') return 'You';
  return message.senderName || chat.name;
};

const buildCapturedMemorySummary = (chat: Chat, messages: Message[], startDate: string, endDate: string, note: string) => {
  const textMessages = messages
    .filter(message => (message.text || message.attachment?.name || '').trim())
    .map(message => ({
      speaker: getSenderLabel(message, chat),
      text: (message.text || message.attachment?.name || 'Attachment').trim(),
      timestamp: message.timestamp
    }));
  const participants = Array.from(new Set(textMessages.map(message => message.speaker))).join(', ') || `You, ${chat.name}`;
  const first = textMessages[0];
  const last = textMessages[textMessages.length - 1];
  const highlights = textMessages
    .filter(message => message.text.length > 18)
    .slice(-4)
    .map(message => `${message.speaker} said ${message.text.length > 140 ? `${message.text.slice(0, 137)}...` : message.text}`);
  const noteText = note.trim() ? ` User note: ${note.trim()}` : '';

  return [
    `Memory from ${formatDateRangeLabel(startDate, endDate)} with ${participants}.`,
    textMessages.length > 0
      ? `The interaction started around ${first.timestamp} with ${first.speaker} saying "${first.text.length > 100 ? `${first.text.slice(0, 97)}...` : first.text}" and ended around ${last.timestamp} with ${last.speaker} saying "${last.text.length > 100 ? `${last.text.slice(0, 97)}...` : last.text}".`
      : `There were no text messages to summarize, but this day was intentionally saved as a memory.`,
    highlights.length > 0 ? `Key beats: ${highlights.join('; ')}.` : '',
    noteText.trim()
  ].filter(Boolean).join('\n');
};

const DateDivider: React.FC<{ dateKey: string; onClick?: () => void }> = ({ dateKey, onClick }) => (
  <div className="flex justify-center sticky top-2 z-20 my-2 sm:my-4 pointer-events-none">
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? 'Save this day as a memory' : undefined}
      className={`app-header text-secondary text-[10px] sm:text-[12px] px-3 py-1 sm:px-4 sm:py-1.5 rounded-full font-medium transition-all ${onClick ? 'pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 hover:text-[#00a884]' : 'pointer-events-none opacity-90'}`}
    >
      {formatChatDividerLabel(dateKey)}
    </button>
  </div>
);

const DateMemoryModal: React.FC<{
  chat: Chat;
  dateKey: string;
  onCancel: () => void;
  onSave: (memory: MemoryBubble) => void;
  settings?: AppSettings;
}> = ({ chat, dateKey, onCancel, onSave, settings }) => {
  const [endDate, setEndDate] = useState(dateKey);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const normalizedStart = normalizeDateKey(dateKey);
  const normalizedEnd = normalizeDateKey(endDate, normalizedStart);
  const capturedMessages = chat.messages.filter(message =>
    isDateInRange(getMessageDateKey(message), normalizedStart, normalizedEnd)
  );

  const handleSave = () => {
    if (normalizedEnd < normalizedStart) {
      alert('End date cannot be before the selected day.');
      return;
    }
    if (getDaysBetween(normalizedStart, normalizedEnd) > 1) {
      alert('Memory capture can include this day and one extra day at most.');
      return;
    }

    onSave({
      id: `memory-${Date.now()}`,
      chatId: chat.id,
      title: title.trim() || `${chat.name} - ${formatDateRangeLabel(normalizedStart, normalizedEnd)}`,
      startDate: normalizedStart,
      endDate: normalizedEnd,
      summary: buildCapturedMemorySummary(chat, capturedMessages, normalizedStart, normalizedEnd, note),
      createdAt: new Date().toISOString()
    });
  };

  const handleGenerateDiary = async () => {
    if (!settings?.apiKey) {
      alert("Please set your Gemini API key in Settings first.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const diaryEntry = await getGeminiDiaryEntry(
        { 
          name: chat.name, 
          about: chat.about, 
          role: chat.role, 
          speechStyle: chat.speechStyle, 
          systemInstruction: chat.systemInstruction 
        },
        capturedMessages.map(m => ({ text: m.text, sender: m.sender, senderName: m.senderName })),
        normalizedStart,
        normalizedEnd,
        settings
      );
      setNote(diaryEntry);
    } catch (error) {
      console.error("Diary generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
      <div className="app-panel border app-border shadow-2xl rounded-lg w-full max-w-[420px] overflow-hidden text-primary">
        <div className="app-header border-b app-border px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-[calc(var(--msg-font-size)+1px)] font-medium">Save Memory Bubble</h3>
            <p className="text-[calc(var(--msg-font-size)-3px)] text-secondary">{formatDateRangeLabel(normalizedStart, normalizedEnd)} · {capturedMessages.length} messages</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-black/5 text-secondary">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Memory title"
            className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none"
          />
          <div className="space-y-1">
            <label className="text-[calc(var(--msg-font-size)-3px)] text-secondary uppercase font-bold">Include up to one extra day</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[calc(var(--msg-font-size)-3px)] text-secondary uppercase font-bold">Persona Diary / Notes</label>
            <button
              onClick={handleGenerateDiary}
              disabled={isGenerating || capturedMessages.length === 0}
              className="flex items-center gap-1.5 text-[calc(var(--msg-font-size)-2.5px)] text-[#00a884] font-bold hover:bg-[#00a884]/10 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate AI Diary
            </button>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write the memory note. Click the button above to have the persona write a diary entry for this day!"
            rows={5}
            className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none resize-none leading-relaxed"
          />
          <button
            onClick={handleSave}
            className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-medium py-2.5 rounded transition-colors flex items-center justify-center gap-2"
          >
            <Save size={16} /> Compress & Save
          </button>
        </div>
      </div>
    </div>
  );
};

const formatMessageText = (text: string) => {
  if (!text) return null;
  // Match WhatsApp & Standard Markdown: ```code```, `code`, **bold**, *bold*, _italics_, ~~strikethrough~~, ~strikethrough~, [text](url)
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|~~[^~]+~~|~[^~]+~|\[[^\]]+\]\([^)]+\))/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      return <code key={index} className="font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-[calc(var(--msg-font-size)-1.5px)] text-[#00a884] block my-1 whitespace-pre-wrap">{part.slice(3, -3)}</code>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="font-mono bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded text-[calc(var(--msg-font-size)-1.5px)] text-[#00a884]">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <strong key={index} className="font-bold">{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith('_') && part.endsWith('_')) {
      return <em key={index} className="italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <del key={index} className="line-through text-secondary">{part.slice(2, -2)}</del>;
    }
    if (part.startsWith('~') && part.endsWith('~')) {
      return <del key={index} className="line-through text-secondary">{part.slice(1, -1)}</del>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return <a key={index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-[#53bdeb] hover:underline cursor-pointer" onClick={(e) => e.stopPropagation()}>{linkMatch[1]}</a>;
    }
    return <span key={index}>{part}</span>;
  });
};

const MessageBubble: React.FC<{ 
  message: Message; 
  highlight?: boolean; 
  isGroup?: boolean; 
  onReply?: (message: Message) => void;
  selected?: boolean;
  onToggleSelect?: (message: Message) => void;
  selectionMode?: boolean;
}> = ({ message, highlight, isGroup, onReply, selected, onToggleSelect, selectionMode }) => {
  const isMe = message.sender === 'me';
  const nameColor = isGroup && !isMe ? MEMBER_COLORS[Math.abs(message.senderName?.length || 0) % MEMBER_COLORS.length] : '';
  const hasAttachment = !!message.attachment || !!message.image || !!message.mediaId;
  const [mediaData, setMediaData] = useState<string | null>(null);
  const lastTap = useRef(0);

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

  const mediaSrc = mediaData || message.image || message.attachment?.data || null;

  if (message.isEvent) {
    return (
      <div className="flex justify-center w-full my-4 px-4 select-none">
        <div className="flex flex-col items-center bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-2xl px-5 py-4 max-w-[85%] sm:max-w-[70%] shadow-md relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00a884]/10 to-transparent pointer-events-none opacity-50"></div>
          <div className="flex items-center gap-2 mb-2 z-10">
            <Sparkles size={14} className="text-[#00a884]" />
            <span className="text-[calc(var(--msg-font-size)-3px)] font-bold uppercase tracking-wider text-[#00a884]">Roleplay Event</span>
          </div>
          {mediaSrc && (
             <img src={mediaSrc} alt="Event Context" className="rounded-xl w-full max-h-[300px] object-cover mb-3 shadow-sm border app-border z-10" />
          )}
          {message.text && (
            <p className="text-[calc(var(--msg-font-size)+1px)] text-center text-primary italic leading-relaxed z-10">
              {message.text}
            </p>
          )}
          <div className="text-[calc(var(--msg-font-size)-4px)] text-secondary mt-3 z-10 font-medium">
            {message.timestamp}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex w-full group/bubble px-1 py-[2px] transition-colors duration-200 ${selected ? 'bg-[#00a884]/25 dark:bg-white/10 selection-highlight' : ''} ${isMe ? 'justify-end' : 'justify-start'}`}
      onClick={() => {
        if (!onToggleSelect) return;
        const now = Date.now();
        if (now - lastTap.current < 300) {
          // Double Tap Detected
          onToggleSelect(message);
          lastTap.current = 0; // Prevent triple-tap loops
        } else {
          lastTap.current = now;
          // Normal Tap in Selection Mode
          if (selectionMode) {
             onToggleSelect(message);
          }
        }
      }}
    >
      {!isMe && onReply && !selectionMode && (
        <button onClick={() => onReply(message)} className="hidden md:block opacity-0 group-hover/bubble:opacity-100 p-2 text-secondary hover:text-primary transition-opacity mr-1 self-center scale-x-[-1]">
          <CornerDownLeft size={18} />
        </button>
      )}
      <div
        className={`max-w-[85%] sm:max-w-[75%] p-1 rounded-lg shadow-sm relative transition-all duration-300 select-none md:select-auto my-[2px] ${highlight ? 'ring-2 ring-[#00a884]' : ''} ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}`}
        style={{ backgroundColor: isMe ? 'var(--bubble-me)' : 'var(--bubble-other)' }}
      >
        {message.replyToMessage && (
          <div className="p-2 rounded-md mb-1 border-l-4 text-[calc(var(--msg-font-size)-1.5px)] bg-black/5 dark:bg-black/20 overflow-hidden cursor-pointer"
               style={{ borderLeftColor: message.replyToMessage.sender === 'me' ? '#53bdeb' : (nameColor || '#35a62e') }}>
             <div className="font-bold mb-0.5" style={{ color: message.replyToMessage.sender === 'me' ? '#53bdeb' : (nameColor || '#35a62e') }}>
                {message.replyToMessage.sender === 'me' ? 'You' : (message.replyToMessage.senderName || 'Contact')}
             </div>
             <div className="text-secondary truncate">{message.replyToMessage.text || (message.replyToMessage.attachment ? 'Attachment' : 'Message')}</div>
          </div>
        )}

        {isGroup && !isMe && message.senderName && (
          <div className="text-[calc(var(--msg-font-size)-1.5px)] font-bold mb-1 px-2 pt-1" style={{ color: nameColor }}>
            {message.senderName}
          </div>
        )}

        {mediaSrc && message.attachment?.type !== 'audio' && (
          <div className="p-0.5 overflow-hidden">
            <img
              src={mediaSrc}
              alt="Sent content"
              className="rounded-md w-full max-h-[450px] object-contain block shadow-sm bg-black/5 dark:bg-white/5"
              loading="lazy"
            />
          </div>
        )}

        {message.attachment?.type === 'document' && (
          <div className="p-2 flex items-center gap-3 bg-black/5 dark:bg-black/20 rounded-md mb-1 border border-black/5 hover:bg-black/10 transition-colors cursor-pointer group">
            <div className="w-12 h-12 bg-[#00a884] rounded flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[calc(var(--msg-font-size)-0.5px)] text-primary font-medium truncate">{message.attachment.name}</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary uppercase font-bold tracking-tighter">Document</p>
            </div>
            <Download size={20} className="text-secondary cursor-pointer hover:text-[#00a884] transition-colors" />
          </div>
        )}

        {message.attachment?.type === 'audio' && (
          <div className="p-2 flex items-center justify-between min-w-[200px] gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: isMe ? '#eaffe4' : 'rgba(0,0,0,0.05)' }}>
               {isMe ? <User size={20} className="text-[#00a884]" /> : <User size={20} className="text-secondary" />}
            </div>
            {mediaSrc && <audio controls src={mediaSrc} className="w-[200px] h-10 outline-none" />}
          </div>
        )}

        <div className="px-2 py-1 flex flex-col relative">
          {message.text && (
            <p className={`text-[length:var(--msg-font-size)] text-primary whitespace-pre-wrap break-words pr-12 ${hasAttachment ? 'pt-1 pb-4' : 'pb-3'}`}>
              {formatMessageText(message.text)}
            </p>
          )}

          <div className={`flex items-center gap-1 self-end ${message.text ? 'absolute bottom-1 right-2' : 'mt-1 mb-0.5 mr-1'}`}>
            <span className="text-[calc(var(--msg-font-size)-4.5px)] text-secondary uppercase whitespace-nowrap font-medium">{message.timestamp}</span>
            {isMe && (
              <span className={message.status === 'read' ? "text-[#53bdeb]" : "text-secondary"}>
                {message.status === 'sent' ? <Check size={16} /> : <CheckCheck size={16} />}
              </span>
            )}
          </div>
        </div>

        <div
          className={`absolute top-0 ${isMe ? '-right-2 border-l-[10px]' : '-left-2 border-r-[10px]'} border-t-[10px] border-t-transparent`}
          style={{
            borderLeftColor: isMe ? 'var(--bubble-me)' : 'transparent',
            borderRightColor: !isMe ? 'var(--bubble-other)' : 'transparent'
          }}
        />
      </div>

      {isMe && onReply && !selectionMode && (
        <button onClick={() => onReply(message)} className="hidden md:block opacity-0 group-hover/bubble:opacity-100 p-2 text-secondary hover:text-primary transition-opacity ml-1 self-center">
          <CornerDownLeft size={18} />
        </button>
      )}
    </div>
  );
};

const TypingBubble: React.FC = () => (
  <div className="flex w-full px-1 py-[2px] justify-start mb-2">
    <div 
      className="p-1 rounded-lg shadow-sm relative transition-all duration-300 select-none rounded-tl-none"
      style={{ backgroundColor: 'var(--bubble-other)' }}
    >
      <div className="dot-typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div
        className="absolute top-0 -left-2 border-r-[10px] border-t-[10px] border-t-transparent"
        style={{ borderRightColor: 'var(--bubble-other)' }}
      />
    </div>
  </div>
);

export const ChatWindow: React.FC<ChatWindowProps> = ({ chat, allChats, onHeaderClick, onDeleteChat, onClearChat, searchTerm, setSearchTerm, onBack, onProfileClick, onMetaAIClick, onAddContact, onReply, onSaveMemory, settings }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [memoryCaptureDate, setMemoryCaptureDate] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedMessageIds([]);
  }, [chat?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [chat?.id, chat?.messages]);

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
          <div className="flex flex-col items-center gap-3 group cursor-pointer" onClick={onProfileClick}>
            <div className="w-20 h-20 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#54656f] group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-all active:scale-95">
              <User size={32} />
            </div>
            <span className="text-[calc(var(--msg-font-size)-0.5px)] text-secondary font-medium">Your Profile</span>
          </div>

          <div className="flex flex-col items-center gap-3 group cursor-pointer" onClick={onAddContact}>
            <div className="w-20 h-20 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#54656f] group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-all active:scale-95">
              <UserPlus size={32} />
            </div>
            <span className="text-[calc(var(--msg-font-size)-0.5px)] text-secondary font-medium">Add contact</span>
          </div>

          <div className="flex flex-col items-center gap-3 group cursor-pointer" onClick={onMetaAIClick}>
            <div className="w-20 h-20 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-all active:scale-95">
              <div className="w-8 h-8 rounded-full border-[3px] p-[1px] bg-clip-border"
                style={{
                  background: 'linear-gradient(45deg, #00d2ff 0%, #3a7bd5 50%, #8e2de2 100%)',
                  borderColor: 'transparent'
                }}>
                <div className="w-full h-full rounded-full bg-[#f8f9fa] dark:bg-[#182229]"></div>
              </div>
            </div>
            <span className="text-[calc(var(--msg-font-size)-0.5px)] text-secondary font-medium">Ask Meta AI</span>
          </div>
        </div>
      </div>
    );
  }

  const filteredMessages = chat.messages.filter(msg =>
    !searchTerm || msg.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGroupMembersLabel = () => {
    if (chat.status === 'typing...') return <span className="text-[#00a884] font-medium italic animate-pulse">typing...</span>;
    if (!chat.isGroup || !chat.memberIds) {
      if (chat.status === 'offline') {
        const lastMsgTime = chat.messages.filter(m => m.sender === 'other').pop()?.timestamp || chat.lastMessageTime || '12:00 PM';
        return `last seen today at ${lastMsgTime}`.toLowerCase();
      }
      return chat.status || 'offline';
    }
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

      {memoryCaptureDate && !chat.isGroup && onSaveMemory && (
        <DateMemoryModal
          chat={chat}
          dateKey={memoryCaptureDate}
          onCancel={() => setMemoryCaptureDate(null)}
          onSave={(memory) => {
            onSaveMemory(chat.id, memory);
            setMemoryCaptureDate(null);
          }}
          settings={settings}
        />
      )}

      {selectedMessageIds.length > 0 ? (
        <div className="h-[59px] bg-[#f0f2f5] dark:bg-[#202c33] border-b app-border px-4 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center">
            <button onClick={() => setSelectedMessageIds([])} className="p-2 mr-2 hover:bg-black/5 rounded-full text-secondary transition-colors">
              <X size={20} />
            </button>
            <span className="text-[calc(var(--msg-font-size)+4.5px)] ml-4 text-primary font-medium">{selectedMessageIds.length}</span>
          </div>
          <div className="flex items-center gap-4 text-secondary">
             {selectedMessageIds.length === 1 && onReply && (
                <button 
                  onClick={() => {
                     const msg = chat.messages.find(m => m.id === selectedMessageIds[0]);
                     if(msg) onReply(msg);
                     setSelectedMessageIds([]);
                  }} 
                  className="p-2 hover:bg-black/5 rounded-full transition-colors scale-x-[-1]"
                >
                  <CornerDownLeft size={20} />
                </button>
             )}
             <button 
               onClick={() => {
                  const texts = chat.messages.filter(m => selectedMessageIds.includes(m.id)).map(m => m.text).join('\n\n');
                  if (texts) {
                      navigator.clipboard.writeText(texts).then(() => setSelectedMessageIds([]));
                  }
               }} 
               className="p-2 hover:bg-black/5 rounded-full transition-colors"
             >
               <Copy size={20} />
             </button>
          </div>
        </div>
      ) : (
        <div className="h-[59px] app-header border-b app-border px-2 md:px-4 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center cursor-pointer flex-1 min-w-0">
            {onBack && (
              <button
                onClick={(e) => { e.stopPropagation(); onBack(); }}
                className="p-2 mr-1 hover:bg-black/5 rounded-full text-secondary md:hidden"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex items-center flex-1 min-w-0 ml-1" onClick={onHeaderClick}>
              <img src={chat.avatar} alt={chat.name} className="w-9 h-9 md:w-10 md:h-10 rounded-full mr-3 object-cover shadow-sm" />
              <div className="flex flex-col min-w-0">
                <h2 className="text-[calc(var(--msg-font-size)+1.5px)] text-primary font-medium leading-none truncate">{chat.name}</h2>
                <span className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary mt-1 truncate">
                  {getGroupMembersLabel()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6 text-secondary relative">
            <Search
              size={20}
              className={`cursor-pointer transition-colors ${showSearch ? 'text-[#00a884]' : 'hover:text-primary'}`}
              onClick={() => setShowSearch(!showSearch)}
            />
            <div className="relative" ref={menuRef}>
              <MoreVertical size={20} className="cursor-pointer hover:text-primary transition-colors" onClick={() => setShowMenu(!showMenu)} />
              {showMenu && (
                <div className="absolute right-0 top-10 w-[210px] app-panel shadow-2xl rounded-lg py-2 z-50 animate-in fade-in zoom-in duration-200 origin-top-right border app-border overflow-hidden">
                  <button
                    onClick={() => { onHeaderClick(); setShowMenu(false); }}
                    className="w-full text-left px-4 py-3 text-[calc(var(--msg-font-size))] text-primary hover:bg-black/5 flex items-center gap-3 transition-colors"
                  >
                    <Info size={18} className="text-secondary" /> {chat.isGroup ? 'Group info' : 'Contact info / Edit'}
                  </button>
                  <button
                    onClick={() => { setShowSearch(true); setShowMenu(false); }}
                    className="w-full text-left px-4 py-3 text-[calc(var(--msg-font-size))] text-primary hover:bg-black/5 flex items-center gap-3 transition-colors"
                  >
                    <Search size={18} className="text-secondary" /> Search messages
                  </button>
                  <div className="h-[1px] app-border bg-border mx-2 my-1 opacity-50" />
                  <button
                    onClick={() => { setShowClearModal(true); setShowMenu(false); }}
                    className="w-full text-left px-4 py-3 text-[calc(var(--msg-font-size))] text-primary hover:bg-black/5 flex items-center gap-3 transition-colors"
                  >
                    <Eraser size={18} className="text-secondary" /> Clear chat
                  </button>
                  <div className="h-[1px] app-border bg-border mx-2 my-1 opacity-50" />
                  <button
                    onClick={() => { onDeleteChat(); setShowMenu(false); }}
                    className="w-full text-left px-4 py-3 text-[calc(var(--msg-font-size))] text-[#ea0038] hover:bg-black/5 flex items-center gap-3 transition-colors"
                  >
                    <Trash2 size={18} /> {chat.isGroup ? 'Exit group' : 'Delete chat'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="app-header border-b app-border px-4 py-2 flex items-center gap-3 animate-in slide-in-from-top duration-200 shadow-sm z-20 shrink-0">
          <div className="flex-1 app-panel rounded-lg px-3 py-1.5 flex items-center gap-3 border app-border focus-within:ring-1 focus-within:ring-[#00a884]/20">
            <Search size={16} className="text-secondary" />
            <input
              type="text"
              placeholder="Search in chat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 outline-none text-[calc(var(--input-font-size)-2px)] bg-transparent text-primary"
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

      <div className="absolute inset-0 flex flex-col p-4 sm:p-10 space-y-1 overflow-y-auto pointer-events-auto z-10">
        <div className="flex justify-center my-4">
          <div className="encryption-box text-[calc(var(--msg-font-size)-2px)] px-3 py-2 rounded-lg shadow-sm flex items-center gap-2 max-w-[500px] text-center border app-border">
            <Lock size={12} className="shrink-0 opacity-60" />
            <span>Messages are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.</span>
          </div>
        </div>

        {searchTerm && filteredMessages.length === 0 && (
          <div className="flex justify-center py-10">
            <span className="app-header px-4 py-2 rounded-lg text-secondary text-[calc(var(--msg-font-size)-1.5px)] shadow-sm">
              No messages found matching "{searchTerm}"
            </span>
          </div>
        )}

        {filteredMessages.map((msg, index) => {
          const dateKey = getMessageDateKey(msg);
          const previousDateKey = index > 0 ? getMessageDateKey(filteredMessages[index - 1]) : '';
          const shouldShowDateDivider = dateKey !== previousDateKey;

          return (
            <React.Fragment key={msg.id}>
              {shouldShowDateDivider && (
                <DateDivider
                  dateKey={dateKey}
                  onClick={!chat.isGroup && onSaveMemory ? () => setMemoryCaptureDate(dateKey) : undefined}
                />
              )}
              <MessageBubble
                message={msg}
                highlight={!!searchTerm}
                isGroup={chat.isGroup}
                onReply={onReply}
                selected={selectedMessageIds.includes(msg.id)}
                onToggleSelect={(m) => {
                   setSelectedMessageIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]);
                }}
                selectionMode={selectedMessageIds.length > 0}
              />
            </React.Fragment>
          );
        })}
        {!searchTerm && chat.status === 'typing...' && <TypingBubble />}
        <div ref={scrollRef} />
      </div>

      <div className="absolute inset-0 pointer-events-none chat-wallpaper transition-all duration-500" />
    </div>
  );
};
