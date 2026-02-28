
import React, { useState, useRef, useEffect } from 'react';
import { Smile, SendHorizontal, Image as ImageIcon, FileText, X, Paperclip, Camera, MapPin, User, Headphones, BarChart, Calendar, Sparkles } from 'lucide-react';
import { FileAttachment } from '../types';

interface MessageInputProps {
  onSendMessage: (text: string, attachment?: FileAttachment) => void;
  activeChatId: string;
}

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'
];

export const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, activeChatId }) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [stagedAttachment, setStagedAttachment] = useState<FileAttachment | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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
      onSendMessage(text, stagedAttachment || undefined);
      setText('');
      setStagedAttachment(null);
      setShowEmojiPicker(false);
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.focus();
      }
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

  return (
    <div className="flex flex-col shrink-0 z-30 transition-all duration-300">
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
                <span className="text-[11px] text-[#667781] text-center line-clamp-2 w-full leading-tight">{stagedAttachment.name}</span>
              </div>
            )}
          </div>
          <div className="ml-5 mb-2 flex flex-col">
            <span className="text-[15px] text-primary font-semibold">
              {stagedAttachment.type === 'image' ? 'Send Image' : 'Send Document'}
            </span>
            <span className="text-[12px] text-secondary italic">
              {stagedAttachment.type === 'image' ? 'Add a caption below' : stagedAttachment.name}
            </span>
          </div>
        </div>
      )}

      {/* Main Input Bar */}
      <div className="bg-transparent px-2 py-2 flex items-end gap-2 relative transition-colors duration-300 w-full z-40">
        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelection(e, 'image')} />
        <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt,.md" onChange={(e) => handleFileSelection(e, 'document')} />

        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-[24px] flex items-end shadow-[0_1px_0.5px_rgba(11,20,26,.13)] overflow-hidden min-h-[44px]">
          <div className="relative p-[10px] pl-3 shrink-0" ref={emojiRef}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`transition-colors flex items-center justify-center ${showEmojiPicker ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-[#00a884]'}`}
            >
              <Smile size={24} strokeWidth={1.5} />
            </button>
          </div>

          <textarea
            ref={inputRef}
            placeholder={stagedAttachment ? (stagedAttachment.type === 'image' ? "Add a caption..." : "Message about this document...") : "Message"}
            className="flex-1 bg-transparent outline-none text-[16px] text-primary py-[10px] min-w-0 resize-none max-h-[140px] leading-relaxed custom-scrollbar"
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

          <div className="relative p-[10px] pr-3 shrink-0 flex items-center justify-center" ref={attachRef}>
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className={`transition-transform duration-200 ${showAttachmentMenu ? 'text-[#00a884] -rotate-45' : 'text-[#8696a0] hover:text-[#00a884]'}`}
            >
              <Paperclip size={22} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="w-[44px] h-[44px] shrink-0 mb-[1px]">
          <button
            onClick={handleSend}
            className="w-full h-full bg-[#00a884] hover:bg-[#008f6f] rounded-full flex items-center justify-center text-white transition-all active:scale-95 shadow-sm"
          >
            <SendHorizontal size={20} fill="currentColor" strokeWidth={1} className="ml-0.5" />
          </button>
        </div>

        {/* Attachment Menu (Absolute) */}
        {showAttachmentMenu && (
          <div ref={attachMenuRef} className="absolute bottom-[60px] left-[10px] md:left-auto md:right-14 w-[calc(100vw-20px)] md:w-[360px] app-panel shadow-2xl rounded-[30px] p-6 px-4 animate-in zoom-in-95 duration-200 border app-border z-[100] origin-bottom sm:origin-bottom-right">
            <div className="grid grid-cols-4 gap-y-6 gap-x-2">
              <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => imageInputRef.current?.click()}>
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ImageIcon size={26} className="text-[#007bfc]" fill="currentColor" />
                </div>
                <span className="text-[13px] text-primary">Gallery</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => imageInputRef.current?.click()}>
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Camera size={26} className="text-[#d3396d]" fill="currentColor" />
                </div>
                <span className="text-[13px] text-primary">Camera</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <MapPin size={26} className="text-[#21bfa6]" fill="currentColor" />
                </div>
                <span className="text-[13px] text-primary">Location</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <User size={26} className="text-[#00a4d4]" fill="currentColor" />
                </div>
                <span className="text-[13px] text-primary">Contact</span>
              </div>

              <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => docInputRef.current?.click()}>
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileText size={26} className="text-[#7f66ff]" fill="currentColor" />
                </div>
                <span className="text-[13px] text-primary">Document</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Headphones size={26} className="text-[#f0643b]" fill="currentColor" />
                </div>
                <span className="text-[13px] text-primary">Audio</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BarChart size={26} className="text-[#ffbc38]" strokeWidth={3} />
                </div>
                <span className="text-[13px] text-primary">Poll</span>
              </div>
              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Calendar size={26} className="text-[#ff3b7c]" fill="currentColor" />
                </div>
                <span className="text-[13px] text-primary">Event</span>
              </div>

              <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-[56px] h-[56px] rounded-full bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Sparkles size={26} className="text-[#007bfc]" fill="currentColor" />
                </div>
                <span className="text-[13px] text-primary">AI Images</span>
              </div>
            </div>
          </div>
        )}

        {/* Emoji Picker (Absolute) */}
        {showEmojiPicker && (
          <div ref={emojiMenuRef} className="absolute bottom-[60px] left-2 md:left-4 w-[calc(100vw-16px)] md:w-[320px] h-[340px] app-panel shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200 border app-border z-[100]">
            <div className="p-3 bg-gray-50 dark:bg-[#202c33] text-[13px] font-medium text-[#00a884] border-b app-border">
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
