
import React, { useState, useRef, useEffect } from 'react';
import { Smile, SendHorizontal, Image as ImageIcon, FileText, X, Paperclip, Camera, MapPin, User, Headphones, BarChart, Calendar, Sparkles, Mic, Square, Sticker } from 'lucide-react';
import { FileAttachment, Message } from '../types';

interface MessageInputProps {
  onSendMessage: (text: string, attachment?: FileAttachment, replyTo?: Message, isEvent?: boolean) => void;
  activeChatId: string;
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

export const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, activeChatId, replyingTo, onCancelReply }) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [stagedAttachment, setStagedAttachment] = useState<FileAttachment | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventText, setEventText] = useState('');
  const [eventImage, setEventImage] = useState<FileAttachment | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const eventImageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
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
    if (eventText.trim() || eventImage) {
      onSendMessage(eventText, eventImage || undefined, replyingTo || undefined, true);
      setShowEventModal(false);
      setEventText('');
      setEventImage(null);
      if (onCancelReply) onCancelReply();
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (file) {
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
        <div className="absolute inset-0 z-[110] bg-black/40 flex items-center justify-center p-4">
          <div className="app-panel border app-border shadow-2xl rounded-[16px] w-full max-w-[340px] overflow-hidden text-primary animate-in zoom-in-95 duration-200">
            <div className="app-header border-b app-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-[#ff3b7c]" />
                <h3 className="text-[calc(var(--msg-font-size)+1px)] font-medium">Trigger Event</h3>
              </div>
              <button onClick={() => setShowEventModal(false)} className="p-1.5 rounded-full hover:bg-black/5 text-secondary">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <textarea
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                placeholder="e.g., A doorbell rings, or A delivery man arrives with a present..."
                className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-xl px-3 py-3 text-[calc(var(--msg-font-size)-1px)] outline-none resize-none leading-relaxed min-h-[100px]"
              />
              
              <input 
                type="file" 
                ref={eventImageInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setEventImage({ name: file.name, data: reader.result as string, type: 'image', size: file.size });
                    reader.readAsDataURL(file);
                  }
                  e.target.value = '';
                }} 
              />
              
              {eventImage ? (
                <div className="relative rounded-xl overflow-hidden border app-border group">
                  <img src={eventImage.data} className="w-full h-32 object-cover" alt="Event preview" />
                  <button 
                    onClick={() => setEventImage(null)}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => eventImageInputRef.current?.click()}
                  className="w-full py-2.5 border border-dashed app-border rounded-xl flex items-center justify-center gap-2 text-secondary hover:text-primary hover:bg-black/5 transition-colors text-[calc(var(--msg-font-size)-2px)] font-medium"
                >
                  <ImageIcon size={18} /> Attach an Image (Optional)
                </button>
              )}

              <button
                onClick={handleTriggerEvent}
                disabled={!eventText.trim() && !eventImage}
                className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-medium py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-md"
              >
                Make it Happen
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
            {stagedAttachment.type === 'image' ? (
              <div className="relative w-32 h-32 overflow-hidden rounded-lg">
                <img src={stagedAttachment.data} className="w-full h-full object-cover" alt="preview" />
              </div>
            ) : (
              <div className="w-32 h-32 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#111b21] rounded-lg border app-border p-2">
                <FileText className="text-[#00a884] mb-2" size={40} />
                <span className="text-[calc(var(--input-font-size)-6px)] text-[#667781] text-center line-clamp-2 w-full leading-tight">{stagedAttachment.name}</span>
              </div>
            )}
            {stagedAttachment.type === 'audio' && (
              <div className="w-32 h-32 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#111b21] rounded-lg border app-border p-2">
                <WhatsAppMicIcon className="text-[#00a884] mb-2" size={40} />
                <span className="text-[calc(var(--input-font-size)-6px)] text-[#667781] text-center w-full leading-tight">Audio Note recorded</span>
              </div>
            )}
          </div>
          <div className="ml-5 mb-2 flex flex-col">
            <span className="text-[calc(var(--input-font-size)-2px)] text-primary font-semibold">
              {stagedAttachment.type === 'image' ? 'Send Image' : stagedAttachment.type === 'audio' ? 'Send Voice Note' : 'Send Document'}
            </span>
            <span className="text-[calc(var(--input-font-size)-5px)] text-secondary italic">
              {stagedAttachment.type === 'image' ? 'Add a caption below' : stagedAttachment.name}
            </span>
          </div>
        </div>
      )}

      {/* Reply Banner Area */}
      {replyingTo && (
        <div className="bg-[#f0f2f5] dark:bg-[#202c33] border-t app-border px-3 py-2 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300">
           <div className="flex-1 bg-black/5 dark:bg-black/20 border-l-4 border-[#00a884] rounded p-2 relative pr-8 overflow-hidden">
             <button onClick={onCancelReply} className="absolute right-2 top-2 text-secondary hover:text-primary"><X size={16}/></button>
             <p className="text-[calc(var(--input-font-size)-4px)] text-[#00a884] font-medium mb-0.5 truncate">{replyingTo.sender === 'me' ? 'You' : (replyingTo.senderName || 'Contact')}</p>
             <p className="text-[calc(var(--input-font-size)-5px)] text-secondary truncate">{replyingTo.text || (replyingTo.attachment ? 'Attachment' : 'Message')}</p>
           </div>
        </div>
      )}

      {/* Main Input Bar */}
      <div className="bg-transparent px-2 py-2 pb-3 flex items-end gap-[10px] relative transition-colors duration-300 w-full z-40">
        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelection(e, 'image')} />
        <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt,.md" onChange={(e) => handleFileSelection(e, 'document')} />

        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-[24px] flex items-end shadow-[0_1px_2px_rgba(11,20,26,.1)] overflow-hidden min-h-[48px]">
          <div className="relative p-[12px] pl-[14px] shrink-0" ref={emojiRef}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`transition-colors flex items-center justify-center ${showEmojiPicker ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-[#00a884]'}`}
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
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className={`transition-transform duration-200 hover:text-black/60 dark:hover:text-white/80 ${showAttachmentMenu ? 'text-[#00a884] -rotate-45' : ''}`}
            >
              <Paperclip size={24} strokeWidth={2} className="rotate-[135deg]" />
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              className="transition-colors hover:text-black/60 dark:hover:text-white/80"
            >
              <Camera size={24} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="w-[48px] h-[48px] shrink-0 mb-[0.5px]">
          {text.trim() || stagedAttachment ? (
            <button
              onClick={handleSend}
              className="w-full h-full bg-[#25d366] dark:bg-[#00a884] hover:bg-[#00a884] dark:hover:bg-[#008f6f] rounded-full flex items-center justify-center text-white transition-all active:scale-95 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
            >
              <SendHorizontal size={24} fill="currentColor" strokeWidth={1} className="ml-1" />
            </button>
          ) : (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full h-full rounded-full flex items-center justify-center text-white transition-all active:scale-95 shadow-[0_1px_3px_rgba(0,0,0,0.1)] ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-[#25d366] dark:bg-[#00a884] hover:bg-[#00a884] dark:hover:bg-[#008f6f]'}`}
            >
              {isRecording ? <Square size={18} fill="currentColor" /> : <WhatsAppMicIcon size={24} className="ml-[1px]" />}
            </button>
          )}
        </div>

        {/* Attachment Menu (Absolute) */}
        {showAttachmentMenu && (
          <div ref={attachMenuRef} className="absolute bottom-[60px] left-[10px] md:left-auto md:right-14 w-[calc(100vw-20px)] md:w-[360px] app-panel shadow-2xl rounded-[30px] p-6 px-4 animate-in zoom-in-95 duration-200 border app-border z-[100] origin-bottom sm:origin-bottom-right">
            <div className="grid grid-cols-4 gap-y-6 gap-x-2">
              <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => imageInputRef.current?.click()}>
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ImageIcon size={26} className="text-[#007bfc]" fill="currentColor" />
                </div>
                <span className="text-[calc(var(--msg-font-size)-1.5px)] text-primary">Gallery</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => imageInputRef.current?.click()}>
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Camera size={26} className="text-[#d3396d]" fill="currentColor" />
                </div>
                <span className="text-[calc(var(--msg-font-size)-1.5px)] text-primary">Camera</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <MapPin size={26} className="text-[#21bfa6]" fill="currentColor" />
                </div>
                <span className="text-[calc(var(--msg-font-size)-1.5px)] text-primary">Location</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <User size={26} className="text-[#00a4d4]" fill="currentColor" />
                </div>
                <span className="text-[calc(var(--msg-font-size)-1.5px)] text-primary">Contact</span>
              </div>

              <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => docInputRef.current?.click()}>
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileText size={26} className="text-[#7f66ff]" fill="currentColor" />
                </div>
                <span className="text-[calc(var(--msg-font-size)-1.5px)] text-primary">Document</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Headphones size={26} className="text-[#f0643b]" fill="currentColor" />
                </div>
                <span className="text-[calc(var(--msg-font-size)-1.5px)] text-primary">Audio</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BarChart size={26} className="text-[#ffbc38]" strokeWidth={3} />
                </div>
                <span className="text-[calc(var(--msg-font-size)-1.5px)] text-primary">Poll</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => { setShowAttachmentMenu(false); setShowEventModal(true); }}>
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Calendar size={26} className="text-[#ff3b7c]" fill="currentColor" />
                </div>
                <span className="text-[calc(var(--msg-font-size)-1.5px)] text-primary">Event</span>
              </div>

              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Sparkles size={26} className="text-[#007bfc]" fill="currentColor" />
                </div>
                <span className="text-[calc(var(--msg-font-size)-1.5px)] text-primary">AI Images</span>
              </div>
            </div>
          </div>
        )}

        {/* Emoji Picker (Absolute) */}
        {showEmojiPicker && (
          <div ref={emojiMenuRef} className="absolute bottom-[60px] left-2 md:left-4 w-[calc(100vw-16px)] md:w-[320px] h-[340px] app-panel shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200 border app-border z-[100]">
            <div className="p-3 bg-gray-50 dark:bg-[#202c33] text-[calc(var(--msg-font-size)-1.5px)] font-medium text-[#00a884] border-b app-border">
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
