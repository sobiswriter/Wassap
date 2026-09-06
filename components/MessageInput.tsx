
import React, { useState, useRef, useEffect } from 'react';
import { Smile, SendHorizontal, Image as ImageIcon, FileText, X, Paperclip, Camera, MapPin, User, Headphones, BarChart, Calendar, Sparkles, Mic, Square, Sticker, Trash2 } from 'lucide-react';
import { FileAttachment, Message } from '../types';
import { compressImage } from '../utils/imageCompressor';

interface MessageInputProps {
  onSendMessage: (text: string, attachment?: FileAttachment, replyTo?: Message, isEvent?: boolean, eventTitle?: string) => void;
  activeChatId: string;
  chatName?: string;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'
];

const WhatsAppMicIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
    <path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531-2.001 0-3.531 1.53-3.531 3.531v7.061c0 2.001 1.53 3.531 3.531 3.531z" />
    <path d="M17.653 11.411v-1.127h-1.611v1.127c0 2.228-1.802 4.031-4.043 4.031-2.241 0-4.043-1.803-4.043-4.031v-1.127H6.345v1.127c0 2.85 2.148 5.215 4.848 5.626v2.333h1.611v-2.333c2.7-.411 4.849-2.776 4.849-5.626z" />
  </svg>
);

export const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, activeChatId, chatName, replyingTo, onCancelReply }) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [stagedAttachment, setStagedAttachment] = useState<FileAttachment | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventText, setEventText] = useState('');
  const [eventImage, setEventImage] = useState<FileAttachment | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const eventImageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const emojiMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Auto-focus and clear state when chat changes
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    setShowEmojiPicker(false);
    setShowAttachmentMenu(false);
    setStagedAttachment(null);
    setShowEventModal(false);
    setEventTitle('');
    setEventText('');
    setEventImage(null);
    if (isRecording) {
      stopRecording();
    }
    setText('');

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    return () => clearTimeout(focusTimer);
  }, [activeChatId]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check emoji picker
      const isEmojiToggleClick = emojiRef.current?.contains(event.target as Node);
      const isEmojiMenuClick = emojiMenuRef.current?.contains(event.target as Node);
      if (!isEmojiToggleClick && !isEmojiMenuClick) {
        setShowEmojiPicker(false);
      }

      // Check attachment menu
      const isAttachToggleClick = attachRef.current?.contains(event.target as Node);
      const isAttachMenuClick = attachMenuRef.current?.contains(event.target as Node);
      if (!isAttachToggleClick && !isAttachMenuClick) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if (text.trim() || stagedAttachment) {
      onSendMessage(text, stagedAttachment || undefined, replyingTo || undefined);
      setText('');
      setStagedAttachment(null);
      if (onCancelReply) onCancelReply();
      setShowEmojiPicker(false);
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.focus();
      }
    }
  };

  const handleTriggerEvent = () => {
    const trimmedDesc = eventText.trim();
    const trimmedTitle = eventTitle.trim();
    if (trimmedDesc || eventImage) {
      // If title is not set, derive from the first few words of the description
      let finalTitle = trimmedTitle;
      if (!finalTitle) {
        if (trimmedDesc) {
          const words = trimmedDesc.split(/\s+/);
          if (words.length <= 5) {
            finalTitle = words.join(' ');
          } else {
            finalTitle = words.slice(0, 5).join(' ') + '...';
          }
        } else {
          finalTitle = 'Story Event';
        }
      }

      onSendMessage(trimmedDesc, eventImage || undefined, replyingTo || undefined, true, finalTitle);
      setShowEventModal(false);
      setEventTitle('');
      setEventText('');
      setEventImage(null);
      if (onCancelReply) onCancelReply();
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document' | 'audio') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'image') {
        try {
          const compressedDataUrl = await compressImage(file, 1280, 0.78);
          setStagedAttachment({
            name: file.name,
            data: compressedDataUrl,
            type: 'image',
            size: file.size
          });
          setShowAttachmentMenu(false);
          e.target.value = '';
          inputRef.current?.focus();
          return;
        } catch (err) {
          console.warn("Failed to compress attached image, falling back to raw:", err);
        }
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setStagedAttachment({
          name: file.name,
          data: reader.result as string,
          type: type,
          size: file.size
        });
        setShowAttachmentMenu(false);
        // Reset file input so same file can be selected again if removed
        e.target.value = '';
        inputRef.current?.focus();
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setStagedAttachment({
            name: 'Voice Note',
            data: reader.result as string,
            type: 'audio',
            size: audioBlob.size
          });
        };
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="flex flex-col shrink-0 z-30 transition-all duration-300">
      {/* Event Modal */}
      {showEventModal && (
        <div 
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEventModal(false);
              setEventTitle('');
              setEventText('');
              setEventImage(null);
            }
          }}
        >
          <div className="bg-white dark:bg-[#1f2c34] border border-black/10 dark:border-white/10 shadow-2xl rounded-3xl w-full max-w-[420px] overflow-hidden text-primary animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-black/5 dark:border-white/5 bg-[#f8f9fa] dark:bg-[#182229]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-primary tracking-tight">Trigger Story Event</h3>
                  <p className="text-[11px] text-secondary">Introduce a scenario to change the conversation</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowEventModal(false);
                  setEventTitle('');
                  setEventText('');
                  setEventImage(null);
                }} 
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-secondary hover:text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-5 space-y-3.5">
              {/* Event Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Event Title</label>
                  <span className="text-[11px] text-secondary/70 italic">Optional (auto-derived if empty)</span>
                </div>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g., Midnight Visitor, Power Outage..."
                  maxLength={50}
                  className="w-full bg-[#f0f2f5] dark:bg-[#111b21] border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-primary placeholder:text-secondary/50 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>

              {/* Scenario Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Scenario Description</label>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">What happens</span>
                </div>
                <textarea
                  value={eventText}
                  onChange={(e) => setEventText(e.target.value)}
                  placeholder="Describe what happens... (e.g. A loud thud echoes upstairs, or someone taps your shoulder)"
                  rows={3}
                  className="w-full bg-[#f0f2f5] dark:bg-[#111b21] border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-primary placeholder:text-secondary/50 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Inspiration Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-secondary font-medium">Quick ideas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { title: '🚪 Doorbell Rings', desc: 'A loud doorbell rings as a courier leaves a mysterious unlabeled box on the porch.' },
                    { title: '⚡ Power Outage', desc: 'The lights violently flicker and plunge the room into pitch darkness with a thunderstorm outside.' },
                    { title: '📱 Urgent Call', desc: 'Your phone buzzes vigorously with an incoming call marked "Urgent - Private Number".' },
                    { title: '☕ Spilled Drink', desc: 'An accidental bump knocks over a hot beverage across the entire table!' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setEventTitle(preset.title.replace(/^[\p{Emoji}\s]+/u, ''));
                        setEventText(preset.desc);
                      }}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400 text-secondary border border-black/5 dark:border-white/5 hover:border-amber-500/30 transition-all active:scale-95"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hidden file input */}
              <input 
                type="file" 
                ref={eventImageInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const compressed = await compressImage(file, 1280, 0.78);
                      setEventImage({ name: file.name, data: compressed, type: 'image', size: file.size });
                    } catch (err) {
                      const reader = new FileReader();
                      reader.onloadend = () => setEventImage({ name: file.name, data: reader.result as string, type: 'image', size: file.size });
                      reader.readAsDataURL(file);
                    }
                  }
                  e.target.value = '';
                }} 
              />

              {/* Image Preview or Upload Button */}
              {eventImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 group shadow-sm">
                  <img src={eventImage.data} className="w-full h-28 object-cover" alt="Event scene preview" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      type="button"
                      onClick={() => setEventImage(null)}
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-transform active:scale-90"
                      title="Remove image"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => eventImageInputRef.current?.click()}
                  className="w-full py-2.5 border border-dashed border-black/15 dark:border-white/15 rounded-xl flex items-center justify-center gap-2 text-secondary hover:text-primary hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-xs font-medium"
                >
                  <ImageIcon size={16} className="text-amber-500" />
                  <span>Attach Scene Image (Optional)</span>
                </button>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleTriggerEvent}
                disabled={!eventText.trim() && !eventImage}
                className="w-full mt-2 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 active:scale-[0.98] text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 text-sm"
              >
                <Sparkles size={16} />
                <span>Make it Happen 🎬</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Area (Staged) */}
      {stagedAttachment && (
        <div className="bg-[#f0f2f5] dark:bg-[#182229] border-t app-border px-4 py-4 flex items-end animate-in slide-in-from-bottom-2 duration-300 shadow-inner">
          <div className="relative group bg-white dark:bg-[#2a3942] p-2 rounded-xl border app-border shadow-md">
            <button
              onClick={() => setStagedAttachment(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors z-20 active:scale-90"
            >
              <X size={16} />
            </button>
            {stagedAttachment.type === 'image' && (
              <div className="relative w-32 h-32 overflow-hidden rounded-lg">
                <img src={stagedAttachment.data} className="w-full h-full object-cover" alt="preview" />
              </div>
            )}
            {stagedAttachment.type === 'document' && (
              <div className="w-32 h-32 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#182229] rounded-lg border app-border p-2">
                <FileText className="text-[#7f66ff] mb-2" size={40} />
                <span className="text-[calc(var(--input-font-size)-6px)] text-[#667781] text-center line-clamp-2 w-full leading-tight font-medium">{stagedAttachment.name}</span>
              </div>
            )}
            {stagedAttachment.type === 'audio' && (
              <div className="w-32 h-32 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#182229] rounded-lg border app-border p-2">
                <Headphones className="text-[#fe7a15] mb-2" size={40} />
                <span className="text-[calc(var(--input-font-size)-6px)] text-[#667781] text-center line-clamp-2 w-full leading-tight font-medium">{stagedAttachment.name || 'Audio file'}</span>
              </div>
            )}
          </div>
          <div className="ml-5 mb-2 flex flex-col">
            <span className="text-[calc(var(--input-font-size)-2px)] text-primary font-semibold">
              {stagedAttachment.type === 'image' ? 'Send Image' : stagedAttachment.type === 'audio' ? 'Send Audio' : 'Send Document'}
            </span>
            <span className="text-[calc(var(--input-font-size)-5px)] text-secondary italic">
              {stagedAttachment.type === 'image' ? 'Add a caption below' : stagedAttachment.name}
            </span>
          </div>
        </div>
      )}

      {/* Reply Banner Area */}
      {replyingTo && (
        <div className="bg-[#f0f2f5] dark:bg-[#182229] border-t app-border px-3 py-2 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300">
           <div className="flex-1 bg-black/5 dark:bg-black/20 border-l-4 border-[#21c063] rounded p-2 relative pr-8 overflow-hidden">
             <button onClick={onCancelReply} className="absolute right-2 top-2 text-secondary hover:text-primary"><X size={16}/></button>
             <p className="text-[calc(var(--input-font-size)-4px)] text-[#21c063] font-medium mb-0.5 truncate">
               {replyingTo.sender === 'me' ? 'You' : (replyingTo.senderName || chatName || 'Contact')}
             </p>
             <div className="text-[calc(var(--input-font-size)-5px)] text-secondary flex items-center gap-1.5 truncate">
               {(replyingTo.image || replyingTo.attachment?.type === 'image') && (
                 <span className="inline-flex items-center gap-1 text-primary font-medium shrink-0">
                   <Camera size={13} className="text-secondary" />
                   <span>Photo</span>
                 </span>
               )}
               {replyingTo.attachment?.type === 'audio' && (
                 <span className="inline-flex items-center gap-1 text-primary font-medium shrink-0">
                   <Mic size={13} className="text-[#21c063]" />
                   <span>Voice message</span>
                 </span>
               )}
               <span className="truncate">
                 {replyingTo.text || ((replyingTo.image || replyingTo.attachment?.type === 'image') ? '' : replyingTo.attachment ? 'Attachment' : 'Message')}
               </span>
             </div>
           </div>
        </div>
      )}

      {/* Main Input Bar */}
      <div className="bg-transparent px-2 py-2 pb-3 flex items-end gap-[10px] relative transition-colors duration-300 w-full z-40">
        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleFileSelection(e, 'image')} />
        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelection(e, 'image')} />
        <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.pptx" onChange={(e) => handleFileSelection(e, 'document')} />
        <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={(e) => handleFileSelection(e, 'audio')} />

        <div className="flex-1 bg-white dark:bg-[#233138] rounded-[24px] flex items-end shadow-[0_1px_2px_rgba(11,20,26,.1)] overflow-hidden min-h-[48px]">
          <div className="relative p-[12px] pl-[14px] shrink-0" ref={emojiRef}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`transition-colors flex items-center justify-center ${showEmojiPicker ? 'text-[#21c063]' : 'text-[#8696a0] hover:text-[#21c063]'}`}
            >
              <Smile size={26} strokeWidth={2} />
            </button>
          </div>

          <textarea
            ref={inputRef}
            placeholder={isRecording ? "Recording audio..." : (stagedAttachment ? (stagedAttachment.type === 'image' ? "Add a caption..." : "Message about this attachment...") : "Message")}
            disabled={isRecording}
            className="flex-1 bg-transparent outline-none text-[length:var(--input-font-size)] py-[12px] min-w-0 resize-none max-h-[140px] leading-relaxed custom-scrollbar disabled:opacity-70"
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          <div className="relative p-[12px] pr-4 shrink-0 flex items-center gap-[18px] text-[#8696a0]" ref={attachRef}>
            <button
              type="button"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className={`transition-transform duration-200 hover:text-black/60 dark:hover:text-white/80 ${showAttachmentMenu ? 'text-[#21c063] -rotate-45' : ''}`}
              title="Attach"
            >
              <Paperclip size={24} strokeWidth={2} className="rotate-[135deg]" />
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="transition-colors hover:text-black/60 dark:hover:text-white/80 active:scale-95"
              title="Camera"
            >
              <Camera size={24} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="w-[48px] h-[48px] shrink-0 mb-[0.5px]">
          {text.trim() || stagedAttachment ? (
            <button
              onClick={handleSend}
              className="w-full h-full bg-[#21c063] hover:bg-[#1eb05b] rounded-full flex items-center justify-center text-white transition-all active:scale-95 shadow-[0_2px_8px_rgba(33,192,99,0.3)]"
            >
              <SendHorizontal size={24} fill="currentColor" strokeWidth={1} className="ml-1" />
            </button>
          ) : (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full h-full rounded-full flex items-center justify-center text-white transition-all active:scale-95 shadow-[0_2px_8px_rgba(33,192,99,0.3)] ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-[#21c063] hover:bg-[#1eb05b]'}`}
            >
              {isRecording ? <Square size={18} fill="currentColor" /> : <WhatsAppMicIcon size={24} className="ml-[1px]" />}
            </button>
          )}
        </div>

        {/* Authentic WhatsApp Attachment Menu Sheet */}
        {showAttachmentMenu && (
          <div ref={attachMenuRef} className="absolute bottom-[60px] left-[10px] md:left-auto md:right-14 w-[calc(100vw-20px)] md:w-[360px] app-panel shadow-2xl rounded-[30px] p-6 px-4 animate-in zoom-in-95 duration-200 border app-border z-[100] origin-bottom sm:origin-bottom-right">
            <div className="grid grid-cols-4 gap-y-6 gap-x-2">
              {/* Gallery */}
              <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => { setShowAttachmentMenu(false); imageInputRef.current?.click(); }}>
                <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-tr from-[#ac44cf] to-[#bf59cf] shadow-[0_4px_12px_rgba(172,68,207,0.35)] flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all text-white">
                  <ImageIcon size={26} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-normal text-primary text-center">Gallery</span>
              </div>

              {/* Camera */}
              <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => { setShowAttachmentMenu(false); cameraInputRef.current?.click(); }}>
                <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-tr from-[#d3396d] to-[#ec407a] shadow-[0_4px_12px_rgba(211,57,109,0.35)] flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all text-white">
                  <Camera size={26} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-normal text-primary text-center">Camera</span>
              </div>

              {/* Location */}
              <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => {
                setShowAttachmentMenu(false);
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const lat = pos.coords.latitude.toFixed(5);
                      const lng = pos.coords.longitude.toFixed(5);
                      onSendMessage(`📍 Live Location: https://maps.google.com/?q=${lat},${lng}`);
                    },
                    () => {
                      onSendMessage('📍 Shared Location (Current GPS pin)');
                    }
                  );
                } else {
                  onSendMessage('📍 Shared Location (Current GPS pin)');
                }
              }}>
                <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-tr from-[#1ea952] to-[#25d366] shadow-[0_4px_12px_rgba(30,169,82,0.35)] flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all text-white">
                  <MapPin size={26} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-normal text-primary text-center">Location</span>
              </div>

              {/* Contact */}
              <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => {
                setShowAttachmentMenu(false);
                onSendMessage('👤 Shared Contact Card');
              }}>
                <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-tr from-[#009de2] to-[#00b0ff] shadow-[0_4px_12px_rgba(0,157,226,0.35)] flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all text-white">
                  <User size={26} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-normal text-primary text-center">Contact</span>
              </div>

              {/* Document */}
              <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => { setShowAttachmentMenu(false); docInputRef.current?.click(); }}>
                <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-tr from-[#7f66ff] to-[#9985ff] shadow-[0_4px_12px_rgba(127,102,255,0.35)] flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all text-white">
                  <FileText size={26} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-normal text-primary text-center">Document</span>
              </div>

              {/* Audio */}
              <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => { setShowAttachmentMenu(false); audioInputRef.current?.click(); }}>
                <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-tr from-[#fe7a15] to-[#ff9800] shadow-[0_4px_12px_rgba(254,122,21,0.35)] flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all text-white">
                  <Headphones size={26} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-normal text-primary text-center">Audio</span>
              </div>

              {/* Poll */}
              <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => {
                setShowAttachmentMenu(false);
                setText('📊 Poll: ');
                inputRef.current?.focus();
              }}>
                <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-tr from-[#ffb300] to-[#ffc107] shadow-[0_4px_12px_rgba(255,179,0,0.35)] flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all text-white">
                  <BarChart size={26} strokeWidth={2.4} />
                </div>
                <span className="text-[12px] font-normal text-primary text-center">Poll</span>
              </div>

              {/* Event */}
              <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => { setShowAttachmentMenu(false); setShowEventModal(true); }}>
                <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-tr from-[#e0537e] to-[#f06292] shadow-[0_4px_12px_rgba(224,83,126,0.35)] flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all text-white">
                  <Calendar size={26} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-normal text-primary text-center">Event</span>
              </div>

              {/* AI Images */}
              <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => {
                setShowAttachmentMenu(false);
                setText('@image Send me a photo of ');
                inputRef.current?.focus();
              }}>
                <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-tr from-[#0066ff] to-[#00d2ff] shadow-[0_4px_12px_rgba(0,102,255,0.35)] flex items-center justify-center group-hover:scale-105 active:scale-95 transition-all text-white">
                  <Sparkles size={26} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-normal text-primary text-center">AI Images</span>
              </div>
            </div>
          </div>
        )}

        {/* Emoji Picker (Absolute) */}
        {showEmojiPicker && (
          <div ref={emojiMenuRef} className="absolute bottom-[60px] left-2 md:left-4 w-[calc(100vw-16px)] md:w-[320px] h-[340px] app-panel shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200 border app-border z-[100]">
            <div className="p-3 bg-gray-50 dark:bg-[#182229] text-[calc(var(--msg-font-size)-1.5px)] font-medium text-[#21c063] border-b app-border">
              RECENTLY USED
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-7 sm:grid-cols-8 gap-1">
              {EMOJIS.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-2xl hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
