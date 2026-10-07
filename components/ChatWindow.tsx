import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Search, MoreVertical, CheckCheck, Check, Clock, Lock, X, Trash2, Info, Eraser, FileText, UserPlus, File, Download, ArrowLeft, User, CornerDownLeft, Copy, Save, Camera, Mic, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Chat, MemoryBubble, Message, AppSettings } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { formatChatDividerLabel, formatDateRangeLabel, getDaysBetween, getMessageDateKey, getMessageTimestampEpoch, isDateInRange, normalizeDateKey } from '../utils/dates';
import { getGeminiDiaryEntry } from '../services/geminiService';
import { getMedia } from '../utils/storage';
import { Sparkles, Loader2 } from 'lucide-react';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { ImageLightboxModal } from './ImageLightboxModal';

interface ChatWindowProps {
  chat: Chat | null;
  allChats: Chat[];
  onHeaderClick: () => void;
  onDeleteChat: () => void;
  onClearChat: (clearMemories?: boolean) => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  onBack?: () => void;
  onProfileClick?: () => void;
  onMetaAIClick?: () => void;
  onAddContact?: () => void;
  onReply?: (message: Message) => void;
  onSaveMemory?: (chatId: string, memory: MemoryBubble) => void;
  onDeleteMessages?: (chatId: string, messageIds: string[]) => void;
  onMarkAsRead?: (chatId: string, messageIds?: string[]) => void;
  settings?: AppSettings;
}

const MEMBER_COLORS = ['#35a62e', '#e542a3', '#9141ac', '#dfa633', '#1d88e5'];

const getSenderLabel = (message: Message, chat: Chat) => {
  if (message.sender === 'me') return 'You';
  return message.senderName || chat.name;
};

const buildCapturedMemorySummary = (chat: Chat, messages: Message[], startDate: string, endDate: string, note: string) => {
  if (note && note.trim()) {
    return note.trim();
  }
  const dateLabel = formatDateRangeLabel(startDate, endDate);
  const textMessages = messages.filter(m => (m.text || '').trim());
  if (textMessages.length === 0) {
    return `Dear Diary, reflecting on ${dateLabel} with ${chat.name}. We spent quiet time connected. Even without words, it was a moment I want to remember.`;
  }
  return `Dear Diary, reflecting on ${dateLabel} with ${chat.name}. We spent time talking and sharing moments together. An intimate day I want to hold onto.`;
};

const DateDivider: React.FC<{ dateKey: string; onClick?: () => void }> = ({ dateKey, onClick }) => (
  <div className="flex justify-center sticky top-1 sm:top-2 z-10 my-1.5 sm:my-2.5 pointer-events-none">
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? 'Save this day as a diary memory' : undefined}
      className={`bg-white dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] text-[10px] sm:text-[11.5px] px-3 py-1 rounded-lg font-medium tracking-wide shadow-xs transition-all ${onClick ? 'pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 hover:text-[#21c063]' : 'pointer-events-none opacity-90'}`}
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
  selectedMessages?: Message[];
}> = ({ chat, dateKey, onCancel, onSave, settings, selectedMessages }) => {
  const isCustomSelection = Boolean(selectedMessages && selectedMessages.length > 0);
  const firstDate = isCustomSelection ? getMessageDateKey(selectedMessages![0]) : dateKey;
  const lastDate = isCustomSelection ? getMessageDateKey(selectedMessages![selectedMessages!.length - 1]) : dateKey;

  const [endDate, setEndDate] = useState(lastDate || dateKey);
  const [title, setTitle] = useState(
    isCustomSelection ? `${chat.name} - Cherished Moment` : `${chat.name}'s Diary - ${formatDateRangeLabel(normalizeDateKey(firstDate), normalizeDateKey(endDate || firstDate))}`
  );
  const [note, setNote] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const normalizedStart = normalizeDateKey(firstDate);
  const normalizedEnd = normalizeDateKey(endDate, normalizedStart);
  const capturedMessages = isCustomSelection
    ? selectedMessages!
    : chat.messages.filter(message =>
        isDateInRange(getMessageDateKey(message), normalizedStart, normalizedEnd)
      );

  const handleSave = () => {
    if (!isCustomSelection && normalizedEnd < normalizedStart) {
      alert('End date cannot be before the selected day.');
      return;
    }
    if (!isCustomSelection && getDaysBetween(normalizedStart, normalizedEnd) > 1) {
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
    if (!settings?.apiKey && !settings?.isVertexUnlocked) {
      alert("Please set your Gemini API key or unlock Vertex AI in Settings first.");
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
    <div className="absolute inset-0 z-[80] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="app-panel border app-border shadow-2xl rounded-xl w-full max-w-[440px] overflow-hidden text-primary animate-in fade-in zoom-in-95 duration-150">
        <div className="app-header border-b app-border px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#21c063]/10 text-[#21c063] flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[calc(var(--msg-font-size)+1px)] font-semibold truncate">
                {isCustomSelection ? 'Save to Diary' : `${chat.name}'s Diary`}
              </h3>
              <p className="text-[calc(var(--msg-font-size)-3px)] text-secondary truncate">
                {formatDateRangeLabel(normalizedStart, normalizedEnd)} · {capturedMessages.length} message{capturedMessages.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-[calc(var(--msg-font-size)-3px)] text-secondary uppercase font-bold tracking-wider mb-1 block">Diary Entry Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. A rainy day together, Unspoken feelings"
              className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[calc(var(--msg-font-size)-1px)] outline-none focus:border-[#21c063] transition-colors"
            />
          </div>

          {!isCustomSelection && (
            <div>
              <label className="text-[calc(var(--msg-font-size)-3px)] text-secondary uppercase font-bold tracking-wider mb-1 block">Span Date (Up to 1 extra day)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[calc(var(--msg-font-size)-1px)] outline-none focus:border-[#21c063] transition-colors"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[calc(var(--msg-font-size)-3px)] text-secondary uppercase font-bold tracking-wider">Secret Journal Entry</label>
              <button
                onClick={handleGenerateDiary}
                disabled={isGenerating || capturedMessages.length === 0}
                className="flex items-center gap-1.5 text-[calc(var(--msg-font-size)-2.5px)] text-[#21c063] font-semibold bg-[#21c063]/10 hover:bg-[#21c063]/20 border border-[#21c063]/30 px-2.5 py-1 rounded-full transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95"
              >
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {note ? 'Regenerate AI Diary' : 'Generate AI Diary'}
              </button>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Dear Diary...\n\nClick "Generate AI Diary" above to have ${chat.name} write an intimate, first-person journal entry reflecting on today's conversation and private feelings.`}
              rows={6}
              className="w-full bg-[#fffdfa] dark:bg-[#111b21] border border-[#e2d9cb] dark:border-[#222e35] rounded-lg p-3 text-[calc(var(--msg-font-size)-1px)] italic leading-relaxed text-primary shadow-inner outline-none focus:border-[#21c063] resize-none transition-colors"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-[#21c063] hover:bg-[#008f6f] text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
          >
            <Save size={16} /> Save to Persona's Diary
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
      return <code key={index} className="font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-[calc(var(--msg-font-size)-1.5px)] text-[#21c063] block my-1 whitespace-pre-wrap">{part.slice(3, -3)}</code>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="font-mono bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded text-[calc(var(--msg-font-size)-1.5px)] text-[#21c063]">{part.slice(1, -1)}</code>;
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

const MessageBubble = React.memo<{ 
  message: Message; 
  highlight?: boolean; 
  isGroup?: boolean; 
  chatName?: string;
  chatAvatar?: string;
  onReply?: (message: Message) => void;
  selected?: boolean;
  onToggleSelect?: (message: Message) => void;
  selectionMode?: boolean;
  isConsecutive?: boolean;
  onOpenImage?: (src: string, caption?: string, senderName?: string, timestamp?: string) => void;
}>(({ message, highlight, isGroup, chatName, chatAvatar, onReply, selected, onToggleSelect, selectionMode, isConsecutive, onOpenImage }) => {
  const isMe = message.sender === 'me';
  const nameColor = isGroup && !isMe ? MEMBER_COLORS[Math.abs(message.senderName?.length || 0) % MEMBER_COLORS.length] : '';
  const hasAttachment = !!message.attachment || !!message.image || !!message.mediaId || !!message.voiceAttachment || !!message.voiceMediaId;
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [voiceData, setVoiceData] = useState<string | null>(null);
  const [isEventExpanded, setIsEventExpanded] = useState(false);
  const lastTap = useRef(0);
  const holdTimerRef = useRef<any>(null);
  const isHoldTriggered = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isHoldTriggered.current = false;
    holdTimerRef.current = setTimeout(() => {
      isHoldTriggered.current = true;
      if (onToggleSelect) {
        onToggleSelect(message);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(40); } catch (_) {}
        }
      }
    }, 450);
  };

  const handlePointerUpOrCancel = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadMedia = async () => {
      const mediaId = message.mediaId || message.attachment?.mediaId;
      if (mediaId) {
        try {
          const data = await getMedia(mediaId);
          if (data && isMounted) setMediaData(data);
        } catch (err) {
          console.error("Error loading media from IndexedDB", err);
        }
      }
      const voiceId = message.voiceMediaId || message.voiceAttachment?.mediaId;
      if (voiceId) {
        try {
          const vData = await getMedia(voiceId);
          if (vData && isMounted) setVoiceData(vData);
        } catch (err) {
          console.error("Error loading voice note from IndexedDB", err);
        }
      }
    };
    loadMedia();
    return () => { isMounted = false; };
  }, [message.mediaId, message.attachment?.mediaId, message.voiceMediaId, message.voiceAttachment?.mediaId]);

  const mediaSrc = mediaData || message.image || message.attachment?.data || null;
  const voiceSrc = voiceData || message.voiceAttachment?.data || (message.attachment?.type === 'audio' ? mediaSrc : null);
  const hasImage = Boolean(mediaSrc && message.attachment?.type !== 'audio');
  const hasVoice = Boolean(voiceSrc);
  const isMediaMessage = hasImage;

  if (message.isEvent) {
    const trimmedText = message.text ? message.text.trim() : '';
    const displayTitle = message.eventTitle || (
      trimmedText 
        ? (trimmedText.split(/\s+/).slice(0, 5).join(' ') + (trimmedText.split(/\s+/).length > 5 ? '...' : '')) 
        : 'Event'
    );
    // Don't duplicate text if description is identical to the title
    const hasDistinctDescription = Boolean(trimmedText && trimmedText !== displayTitle);
    const isLongDescription = Boolean(trimmedText && trimmedText.length > 75);

    return (
      <div className="flex justify-center w-full my-2.5 px-3 select-none">
        <div 
          onClick={() => {
            if (isLongDescription) setIsEventExpanded(prev => !prev);
          }}
          className={`relative overflow-hidden transition-all duration-150 ${
            isLongDescription ? 'cursor-pointer' : ''
          } bg-[#ffffff] dark:bg-[#1f2c34] border border-black/10 dark:border-white/10 rounded-xl p-3.5 shadow-sm w-full max-w-[340px] sm:max-w-[380px] text-left`}
        >
          {/* Header Tag */}
          <div className="flex items-center gap-1.5 text-[#00a884] dark:text-[#25d366] text-[11px] font-semibold uppercase tracking-wider mb-1">
            <Calendar size={13} strokeWidth={2.5} />
            <span>Event</span>
          </div>

          {/* Event Title */}
          <h4 className="font-semibold text-[calc(var(--msg-font-size))] text-primary leading-snug">
            {displayTitle}
          </h4>

          {/* Attached Image if any */}
          {mediaSrc && (
            <div className="mt-2 rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
              <img 
                src={mediaSrc} 
                alt="Event" 
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenImage) onOpenImage(mediaSrc, trimmedText, displayTitle, message.timestamp);
                }}
                className="w-full max-h-[200px] object-cover cursor-pointer hover:opacity-95 transition-opacity" 
              />
            </div>
          )}

          {/* Scenario Description */}
          {hasDistinctDescription && (
            <div className="mt-1.5">
              <p 
                className={`text-[calc(var(--msg-font-size)-1px)] text-secondary leading-relaxed ${
                  !isEventExpanded && isLongDescription ? 'line-clamp-2' : ''
                }`}
              >
                {trimmedText}
              </p>
              
              {/* Expand / Collapse Toggle */}
              {isLongDescription && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEventExpanded(prev => !prev);
                  }}
                  className="text-[12px] text-[#00a884] dark:text-[#25d366] hover:underline font-medium mt-1 inline-block"
                >
                  {isEventExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* Timestamp footer */}
          <div className="text-[11px] text-secondary/70 text-right mt-2">
            {message.timestamp}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex w-full group/bubble px-1 ${isConsecutive ? 'py-[0.5px]' : 'py-[2px]'} transition-colors duration-200 ${selected ? 'bg-[#21c063]/25 dark:bg-white/10 selection-highlight' : ''} ${isMe ? 'justify-end' : 'justify-start'}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUpOrCancel}
      onPointerLeave={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onToggleSelect) onToggleSelect(message);
      }}
      onClick={() => {
        if (isHoldTriggered.current) {
          isHoldTriggered.current = false;
          return;
        }
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
        <button 
          onClick={() => onReply({
            ...message,
            senderName: message.senderName || (!isGroup ? chatName : undefined)
          })} 
          className="hidden md:block opacity-0 group-hover/bubble:opacity-100 p-2 text-secondary hover:text-primary transition-opacity mr-1 self-center scale-x-[-1]"
        >
          <CornerDownLeft size={18} />
        </button>
      )}
      <div
        className={`${
          isMediaMessage
            ? 'media-message-bubble'
            : (message.attachment?.type === 'audio' ? 'w-auto max-w-[95%] sm:max-w-[88%] md:max-w-[540px]' : 'max-w-[85%] sm:max-w-[75%]')
        } p-1 rounded-lg shadow-sm relative transition-all duration-300 select-none md:select-auto my-[2px] ${highlight ? 'ring-2 ring-[#21c063]' : ''} ${!isConsecutive ? (isMe ? 'rounded-tr-none' : 'rounded-tl-none') : ''}`}
        style={{ 
          backgroundColor: isMe ? 'var(--bubble-me)' : 'var(--bubble-other)',
          ...(isMediaMessage ? { width: 'fit-content', maxWidth: '330px' } : {})
        }}
      >
        {message.replyToMessage && (
          <div className="p-2 rounded-md mb-1 border-l-4 text-[calc(var(--msg-font-size)-1.5px)] bg-black/5 dark:bg-black/20 overflow-hidden cursor-pointer"
               style={{ borderLeftColor: message.replyToMessage.sender === 'me' ? '#53bdeb' : (nameColor || '#35a62e') }}>
             <div className="font-bold mb-0.5" style={{ color: message.replyToMessage.sender === 'me' ? '#53bdeb' : (nameColor || '#35a62e') }}>
                {message.replyToMessage.sender === 'me' ? 'You' : (message.replyToMessage.senderName || (!isGroup ? chatName : 'Contact') || 'Contact')}
             </div>
             <div className="text-secondary truncate flex items-center gap-1.5">
               {(message.replyToMessage.image || message.replyToMessage.attachment?.type === 'image') && (
                 <span className="inline-flex items-center gap-1 text-primary font-medium shrink-0">
                   <Camera size={13} className="text-secondary" />
                   <span>Photo</span>
                   {(message.replyToMessage.voiceAttachment || message.replyToMessage.voiceMediaId || message.replyToMessage.attachment?.type === 'audio') && (
                     <>
                       <span className="text-secondary">+</span>
                       <Mic size={13} className="text-[#21c063]" />
                       <span>Voice</span>
                     </>
                   )}
                 </span>
               )}
               {!(message.replyToMessage.image || message.replyToMessage.attachment?.type === 'image') && 
                (message.replyToMessage.voiceAttachment || message.replyToMessage.attachment?.type === 'audio') && (
                 <span className="inline-flex items-center gap-1 text-primary font-medium shrink-0">
                   <Mic size={13} className="text-[#21c063]" />
                   <span>Voice message</span>
                 </span>
               )}
               <span className="truncate">
                 {message.replyToMessage.text || ((message.replyToMessage.image || message.replyToMessage.attachment?.type === 'image') ? '' : message.replyToMessage.attachment ? 'Attachment' : 'Message')}
               </span>
             </div>
          </div>
        )}

        {isGroup && !isMe && message.senderName && !isConsecutive && (
          <div className="text-[calc(var(--msg-font-size)-1.5px)] font-bold mb-1 px-2 pt-1" style={{ color: nameColor }}>
            {message.senderName}
          </div>
        )}

        {isMediaMessage ? (
          <>
            <div 
              className="image-wrapper cursor-pointer group/img relative"
              onClick={(e) => {
                e.stopPropagation();
                onOpenImage?.(
                  mediaSrc,
                  message.text,
                  isMe ? 'You' : (message.senderName || undefined),
                  message.timestamp
                );
              }}
            >
              <img
                src={mediaSrc}
                alt="Sent photo"
                className="transition-transform duration-200 group-hover/img:scale-[1.01]"
                loading="lazy"
              />
            </div>

            {/* Attached Voice Note directly beneath image inside the same bubble */}
            {hasVoice && (
              <div className="w-full px-1 pt-1.5 pb-0.5">
                <VoiceNotePlayer
                  src={voiceSrc!}
                  seedId={`${message.id}-attached-voice`}
                  isMe={isMe}
                  avatar={isMe ? undefined : chatAvatar}
                  senderName={isMe ? 'You' : (message.senderName || 'Voice Note')}
                />
              </div>
            )}

            {message.text ? (
              <div className="caption-text flex flex-col relative w-full">
                <p className="text-primary whitespace-pre-wrap break-words pr-12 pb-2">
                  {formatMessageText(message.text)}
                </p>
                <div className="flex items-center gap-1 self-end absolute bottom-1 right-2">
                  <span className="text-[calc(var(--msg-font-size)-4.5px)] text-secondary uppercase whitespace-nowrap font-medium">{message.timestamp}</span>
                  {isMe && (
                    <span className={message.status === 'read' ? "text-[#53bdeb]" : "text-secondary"}>
                      {message.status === 'pending' ? (
                        <Clock size={13} className="text-secondary/70 animate-pulse" />
                      ) : message.status === 'sent' ? (
                        <Check size={16} />
                      ) : (
                        <CheckCheck size={16} />
                      )}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1 self-end mt-1 mb-0.5 mr-1.5">
                <span className="text-[calc(var(--msg-font-size)-4.5px)] text-secondary uppercase whitespace-nowrap font-medium">{message.timestamp}</span>
                {isMe && (
                  <span className={message.status === 'read' ? "text-[#53bdeb]" : "text-secondary"}>
                    {message.status === 'pending' ? (
                      <Clock size={13} className="text-secondary/70 animate-pulse" />
                    ) : message.status === 'sent' ? (
                      <Check size={16} />
                    ) : (
                      <CheckCheck size={16} />
                    )}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {message.attachment?.type === 'document' && (
              <div className="p-2 flex items-center gap-3 bg-black/5 dark:bg-black/20 rounded-md mb-1 border border-black/5 hover:bg-black/10 transition-colors cursor-pointer group">
                <div className="w-12 h-12 bg-[#21c063] rounded flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                  <FileText size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[calc(var(--msg-font-size)-0.5px)] text-primary font-medium truncate">{message.attachment.name}</p>
                  <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary uppercase font-bold tracking-tighter">Document</p>
                </div>
                <Download size={20} className="text-secondary cursor-pointer hover:text-[#21c063] transition-colors" />
              </div>
            )}

            {(message.attachment?.type === 'audio' || hasVoice) && (
              <div className="p-1 pb-0 w-full">
                <VoiceNotePlayer
                  src={voiceSrc || mediaSrc || message.attachment?.data || ''}
                  seedId={message.id}
                  transcript={message.text}
                  isMe={isMe}
                  avatar={isMe ? undefined : chatAvatar}
                  senderName={isMe ? 'You' : (message.senderName || 'Voice Note')}
                />
              </div>
            )}

            <div className="px-2 py-1 flex flex-col relative">
              {(!message.attachment || message.attachment.type !== 'audio') && message.text && (
                <p className={`text-[length:var(--msg-font-size)] text-primary whitespace-pre-wrap break-words pr-12 ${hasAttachment ? 'pt-1 pb-4' : 'pb-3'}`}>
                  {formatMessageText(message.text)}
                </p>
              )}

              <div className={`flex items-center gap-1 self-end ${(!message.attachment || message.attachment.type !== 'audio') && message.text ? 'absolute bottom-1 right-2' : 'mt-1 mb-0.5 mr-1'}`}>
                <span className="text-[calc(var(--msg-font-size)-4.5px)] text-secondary uppercase whitespace-nowrap font-medium">{message.timestamp}</span>
                {isMe && (
                  <span className={message.status === 'read' ? "text-[#53bdeb]" : "text-secondary"}>
                    {message.status === 'pending' ? (
                      <Clock size={13} className="text-secondary/70 animate-pulse" />
                    ) : message.status === 'sent' ? (
                      <Check size={16} />
                    ) : (
                      <CheckCheck size={16} />
                    )}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {!isConsecutive && (
          <div
            className={`absolute top-0 ${isMe ? '-right-2 border-l-[10px]' : '-left-2 border-r-[10px]'} border-t-[10px] border-t-transparent`}
            style={{
              borderLeftColor: isMe ? 'var(--bubble-me)' : 'transparent',
              borderRightColor: !isMe ? 'var(--bubble-other)' : 'transparent'
            }}
          />
        )}
      </div>

      {isMe && onReply && !selectionMode && (
        <button 
          onClick={() => onReply({ ...message, senderName: 'You' })} 
          className="hidden md:block opacity-0 group-hover/bubble:opacity-100 p-2 text-secondary hover:text-primary transition-opacity ml-1 self-center"
        >
          <CornerDownLeft size={18} />
        </button>
      )}
    </div>
  );
});

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

export const ChatWindow: React.FC<ChatWindowProps> = ({ chat, allChats, onHeaderClick, onDeleteChat, onClearChat, searchTerm, setSearchTerm, onBack, onProfileClick, onMetaAIClick, onAddContact, onReply, onSaveMemory, onDeleteMessages, onMarkAsRead, settings }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearMemoriesAlso, setClearMemoriesAlso] = useState(false);
  const [showDeleteMessagesModal, setShowDeleteMessagesModal] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [memoryCaptureDate, setMemoryCaptureDate] = useState<string | null>(null);
  const [memoryFromSelectionMessages, setMemoryFromSelectionMessages] = useState<Message[] | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    caption?: string;
    senderName?: string;
    timestamp?: string;
  } | null>(null);
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

  const filteredMessages = useMemo(() => {
    if (!chat?.messages) return [];
    return chat.messages.filter(msg =>
      !searchTerm || (msg.text || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [chat?.messages, searchTerm]);

  const messageGroups = useMemo(() => {
    if (!chat) return [];
    const groups: { dateKey: string; items: { msg: Message; isConsecutive: boolean }[] }[] = [];
    let currentGroup: { dateKey: string; items: { msg: Message; isConsecutive: boolean }[] } | null = null;

    filteredMessages.forEach((msg, index) => {
      const dateKey = getMessageDateKey(msg);
      const previousDateKey = index > 0 ? getMessageDateKey(filteredMessages[index - 1]) : '';

      const isConsecutive = (() => {
        if (index === 0) return false;
        const prevMsg = filteredMessages[index - 1];
        if (msg.isEvent || prevMsg.isEvent) return false;
        if (msg.sender !== prevMsg.sender) return false;
        if (chat?.isGroup && msg.senderName !== prevMsg.senderName) return false;
        if (dateKey !== previousDateKey) return false;

        const currentMs = getMessageTimestampEpoch(msg);
        const prevMs = getMessageTimestampEpoch(prevMsg);
        return (currentMs - prevMs) < 120000; // 2 minutes
      })();

      if (!currentGroup || currentGroup.dateKey !== dateKey) {
        currentGroup = { dateKey, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push({ msg, isConsecutive });
    });

    return groups;
  }, [filteredMessages, chat]);

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

  const getGroupMembersLabel = () => {
    if (chat.status === 'typing...') return <span className="text-[#21c063] font-medium italic animate-pulse">typing...</span>;
    if (!chat.isGroup || !chat.memberIds) {
      if (chat.status === 'online') {
        return <span className="text-[#21c063] dark:text-[#25d366] font-medium transition-colors">online</span>;
      }
      if (chat.status === 'offline') {
        const lastMsgTime = chat.lastSeenTime || chat.messages.filter(m => m.sender === 'other').pop()?.timestamp || chat.lastMessageTime || '12:00 PM';
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
          message={`Are you sure you want to clear all messages in "${chat.name}"? This action cannot be undone.`}
          confirmLabel="Clear Chat"
          onCancel={() => setShowClearModal(false)}
          onConfirm={() => {
            onClearChat(clearMemoriesAlso);
            setShowClearModal(false);
          }}
        >
          {chat.memoryBubbles && chat.memoryBubbles.length > 0 && (
            <label className="flex items-center gap-2.5 text-[calc(var(--msg-font-size)-1px)] text-secondary cursor-pointer select-none mt-2 p-2.5 rounded bg-black/5 dark:bg-white/5 border app-border">
              <input
                type="checkbox"
                checked={clearMemoriesAlso}
                onChange={(e) => setClearMemoriesAlso(e.target.checked)}
                className="rounded border-gray-400 text-[#00a884] focus:ring-[#00a884] w-4 h-4 cursor-pointer"
              />
              <span>Also clear persona's saved memory bubbles & diary entries ({chat.memoryBubbles.length})</span>
            </label>
          )}
        </ConfirmationModal>
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

      {memoryFromSelectionMessages && !chat.isGroup && onSaveMemory && (
        <DateMemoryModal
          chat={chat}
          dateKey={getMessageDateKey(memoryFromSelectionMessages[0])}
          selectedMessages={memoryFromSelectionMessages}
          onCancel={() => {
            setMemoryFromSelectionMessages(null);
            setSelectedMessageIds([]);
          }}
          onSave={(memory) => {
            onSaveMemory(chat.id, memory);
            setMemoryFromSelectionMessages(null);
            setSelectedMessageIds([]);
          }}
          settings={settings}
        />
      )}

      {showDeleteMessagesModal && (
        <ConfirmationModal
          title={selectedMessageIds.length === 1 ? "Delete message?" : "Delete messages?"}
          message={
            selectedMessageIds.length === 1
              ? "Are you sure you want to delete this message? This cannot be undone."
              : `Are you sure you want to delete ${selectedMessageIds.length} messages? This cannot be undone.`
          }
          confirmLabel="Delete"
          onCancel={() => setShowDeleteMessagesModal(false)}
          onConfirm={() => {
            onDeleteMessages?.(chat.id, selectedMessageIds);
            setSelectedMessageIds([]);
            setShowDeleteMessagesModal(false);
          }}
        />
      )}

      {selectedMessageIds.length > 0 ? (
        <div className="h-[59px] bg-[#f0f2f5] dark:bg-[#202c33] border-b app-border px-3 sm:px-4 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center">
            <button onClick={() => setSelectedMessageIds([])} title="Cancel selection" className="p-2 mr-1 sm:mr-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-secondary transition-colors">
              <X size={20} />
            </button>
            <span className="text-[calc(var(--msg-font-size)+4.5px)] ml-2 sm:ml-4 text-primary font-medium">{selectedMessageIds.length}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-secondary">
             {selectedMessageIds.length === 1 && onReply && (
                <button 
                  onClick={() => {
                     const msg = chat.messages.find(m => m.id === selectedMessageIds[0]);
                     if (msg) onReply({
                       ...msg,
                       senderName: msg.senderName || (msg.sender === 'me' ? 'You' : (!chat.isGroup ? chat.name : undefined))
                     });
                     setSelectedMessageIds([]);
                  }} 
                  title="Reply"
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors scale-x-[-1]"
                >
                  <CornerDownLeft size={20} />
                </button>
             )}
             {!chat.isGroup && onSaveMemory && (
                <button
                  onClick={() => {
                    const selMsgs = chat.messages.filter(m => selectedMessageIds.includes(m.id));
                    if (selMsgs.length > 0) {
                      setMemoryFromSelectionMessages(selMsgs);
                    }
                  }}
                  title="Save selected messages as memory"
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors hover:text-[#21c063]"
                >
                  <Sparkles size={20} />
                </button>
             )}
             {onMarkAsRead && (
                <button
                  onClick={() => {
                    onMarkAsRead(chat.id, selectedMessageIds);
                    setSelectedMessageIds([]);
                  }}
                  title="Mark as read"
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors hover:text-[#53bdeb] text-secondary flex items-center justify-center"
                >
                  <CheckCheck size={20} className="text-[#53bdeb]" />
                </button>
             )}
             <button 
               onClick={() => {
                  const texts = chat.messages.filter(m => selectedMessageIds.includes(m.id)).map(m => m.text).join('\n\n');
                  if (texts) {
                      navigator.clipboard.writeText(texts).then(() => setSelectedMessageIds([]));
                  }
               }} 
               title="Copy message text"
               className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
             >
               <Copy size={20} />
             </button>
             {onDeleteMessages && (
                <button
                  onClick={() => setShowDeleteMessagesModal(true)}
                  title="Delete message"
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors hover:text-red-500"
                >
                  <Trash2 size={20} />
                </button>
             )}
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
            <div className="flex items-center flex-1 min-w-0 ml-1 cursor-pointer active:opacity-75 transition-opacity select-none" onClick={onHeaderClick}>
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
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-full transition-colors ${showSearch ? 'bg-black/5 text-[#21c063]' : 'hover:bg-black/5 text-secondary hover:text-primary'}`}
            >
              <Search size={20} />
            </button>
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className={`p-2 -mr-2 rounded-full transition-colors ${showMenu ? 'bg-black/5 text-[#21c063]' : 'hover:bg-black/5 text-secondary hover:text-primary'}`}
              >
                <MoreVertical size={20} />
              </button>
              {showMenu && (
                <div className="absolute right-2 top-10 w-[210px] bg-[#ffffff] dark:bg-[#233138] shadow-2xl rounded-lg py-2 z-[100] animate-in fade-in zoom-in duration-200 origin-top-right border app-border overflow-hidden">
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
          <div className="flex-1 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-1.5 flex items-center gap-3 border app-border focus-within:ring-1 focus-within:ring-[#21c063]/20">
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

      <div className="flex-1 flex flex-col p-4 sm:p-10 space-y-1 overflow-y-auto pointer-events-auto z-10 relative">
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

        {messageGroups.map((group) => (
          <div key={group.dateKey} className="relative space-y-1">
            <DateDivider
              dateKey={group.dateKey}
              onClick={!chat.isGroup && onSaveMemory ? () => setMemoryCaptureDate(group.dateKey) : undefined}
            />
            {group.items.map(({ msg, isConsecutive }) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                highlight={!!searchTerm}
                isGroup={chat.isGroup}
                chatName={chat.name}
                chatAvatar={
                  msg.sender === 'me'
                    ? undefined
                    : (chat.isGroup
                        ? (allChats.find(c => c.id === msg.senderId || c.name === msg.senderName)?.avatar || chat.avatar)
                        : chat.avatar)
                }
                onReply={onReply}
                selected={selectedMessageIds.includes(msg.id)}
                onToggleSelect={(m) => {
                   setSelectedMessageIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]);
                }}
                selectionMode={selectedMessageIds.length > 0}
                isConsecutive={isConsecutive}
                onOpenImage={(src, caption, senderName, timestamp) => {
                  setLightboxImage({
                    src,
                    caption,
                    senderName: senderName || (msg.sender === 'me' ? 'You' : (msg.senderName || chat.name)),
                    timestamp: timestamp || msg.timestamp
                  });
                }}
              />
            ))}
          </div>
        ))}
        {!searchTerm && chat.status === 'typing...' && <TypingBubble />}
        <div ref={scrollRef} />
      </div>

      {lightboxImage && (
        <ImageLightboxModal
          src={lightboxImage.src}
          caption={lightboxImage.caption}
          senderName={lightboxImage.senderName}
          timestamp={lightboxImage.timestamp}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* Background wallpaper layer with responsive scaling and cropping */}
      <div
        className="absolute inset-0 pointer-events-none chat-wallpaper transition-all duration-500"
        style={
          settings?.chatWallpaper && settings.chatWallpaper !== 'default'
            ? {
                backgroundImage: `url("${settings.chatWallpaper}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat',
                opacity: settings.chatWallpaperOpacity !== undefined ? settings.chatWallpaperOpacity : 0.85,
              }
            : undefined
        }
      />
    </div>
  );
};
