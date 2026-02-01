
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Smile, Mic, SendHorizontal, Image as ImageIcon, FileText, X } from 'lucide-react';
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

  const inputRef = useRef<HTMLInputElement>(null);
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
      inputRef.current?.focus();
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
      <div className="app-chat-bg px-3 py-2 flex items-center gap-2 relative transition-colors duration-300">
        <div className="relative" ref={attachRef}>
          <button
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            className={`p-2 hover:bg-black/5 rounded-full transition-all shrink-0 ${showAttachmentMenu ? 'bg-black/10 rotate-45 text-[#00a884]' : 'text-secondary'}`}
          >
            <Plus size={28} strokeWidth={1.5} />
          </button>
        </div>

        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelection(e, 'image')} />
        <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt,.md" onChange={(e) => handleFileSelection(e, 'document')} />

        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-full px-4 py-1.5 flex items-center gap-3 shadow-sm border border-transparent focus-within:border-gray-100 dark:focus-within:border-gray-700">
          <div className="relative" ref={emojiRef}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`transition-colors shrink-0 ${showEmojiPicker ? 'text-[#00a884]' : 'text-secondary hover:text-[#00a884]'}`}
            >
              <Smile size={26} strokeWidth={1.5} />
            </button>
          </div>

          <input
            ref={inputRef}
            type="text"
            placeholder={stagedAttachment ? (stagedAttachment.type === 'image' ? "Add a caption..." : "Message about this document...") : "Type a message"}
            className="flex-1 bg-transparent outline-none text-[16px] text-primary py-1 placeholder-secondary"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
        </div>

        <div className="w-12 flex justify-center shrink-0">
          {(text.trim() || stagedAttachment) ? (
            <button
              onClick={handleSend}
              className="p-2.5 text-[#00a884] hover:bg-black/5 rounded-full transition-all active:scale-90"
            >
              <SendHorizontal size={26} fill="currentColor" className="fill-[#00a884]" />
            </button>
          ) : (
            <button className="p-2.5 text-secondary hover:bg-black/5 rounded-full transition-colors">
              <Mic size={26} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Attachment Menu (Absolute) */}
        {showAttachmentMenu && (
          <div ref={attachMenuRef} className="absolute bottom-full left-4 mb-2 w-[220px] app-panel shadow-2xl rounded-2xl p-2 animate-in slide-in-from-bottom-4 duration-200 border app-border z-[100]">
            <div className="space-y-1">
              <button onClick={() => imageInputRef.current?.click()} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-black/5 rounded-xl transition-colors group">
                <div className="w-10 h-10 rounded-full bg-[#bf59cf] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                  <ImageIcon size={20} fill="currentColor" />
                </div>
                <span className="text-[14.5px] text-primary font-medium">Photos & Videos</span>
              </button>
              <button onClick={() => docInputRef.current?.click()} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-black/5 rounded-xl transition-colors group">
                <div className="w-10 h-10 rounded-full bg-[#7f66ff] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                  <FileText size={20} fill="currentColor" />
                </div>
                <span className="text-[14.5px] text-primary font-medium">Document</span>
              </button>
            </div>
          </div>
        )}

        {/* Emoji Picker (Absolute) */}
        {showEmojiPicker && (
          <div ref={emojiMenuRef} className="absolute bottom-full left-4 md:left-20 mb-2 w-[calc(100vw-32px)] md:w-[320px] h-[340px] app-panel shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200 border app-border z-[100]">
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
