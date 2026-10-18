import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { isSingleEmoji } from '../utils/reactions';

interface ReactionTrayProps {
  onSelectReaction: (emoji: string) => void;
  onClose: () => void;
  currentReaction?: string;
  isMe?: boolean;
}

const PRIMARY_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const EXTENDED_REACTIONS = [
  '🔥', '🎉', '👏', '💯', '✨', '😍', 
  '🥰', '🥺', '🤔', '😎', '🥳', '🙌',
  '💪', '🤝', '👀', '💡', '🌟', '💔',
  '🤣', '😊', '😉', '🙃', '😏', '🙄',
  '😭', '😤', '😡', '🤯', '😱', '😬',
  '🫠', '🫡', '🤗', '🤭', '🤫', '🤨',
  '😴', '🥱', '🤒', '🤢', '🫶', '🤌',
  '🤞', '✌️', '👌', '👎', '✅', '❌',
  '💚', '💙', '💜', '🖤', '🤍', '💐'
];

export const ReactionTray: React.FC<ReactionTrayProps> = ({
  onSelectReaction,
  onClose,
  currentReaction,
  isMe = false
}) => {
  const [showExtended, setShowExtended] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const moreButton = useRef<HTMLButtonElement>(null);
  const closeExtended = () => { setShowExtended(false); moreButton.current?.focus(); };

  useLayoutEffect(() => {
    if (!showExtended) return;
    const place = () => {
      const rect = moreButton.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const height = Math.min(320, viewportHeight - 16);
      setPosition({ left: Math.max(8, Math.min(rect.right - 260, window.innerWidth - 268)),
        top: Math.max(8, Math.min(rect.top - height - 8, viewportHeight - height - 8)) });
    };
    place();
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    return () => { window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place); };
  }, [showExtended]);

  const handlePick = (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('reaction');
    onSelectReaction(emoji);
  };

  return (
    <div 
      className={`absolute z-50 -top-12 ${isMe ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'} select-none`}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="animate-reaction-tray bg-white dark:bg-[#202c33] px-2 py-1.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.18)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.45)] border border-black/5 dark:border-white/10 flex items-center gap-1">
        {PRIMARY_REACTIONS.map((emoji) => {
          const isSelected = currentReaction === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={(e) => handlePick(emoji, e)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[21px] sm:text-[23px] transition-transform duration-150 hover:scale-125 active:scale-90 ${
                isSelected ? 'bg-[#21c063]/20 scale-110' : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={emoji}
            >
              {emoji}
            </button>
          );
        })}

        <button
          ref={moreButton}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic('tap');
            setShowExtended(!showExtended);
          }}
          aria-expanded={showExtended}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-secondary hover:text-primary transition-all duration-150 hover:scale-110 active:scale-90 ${
            showExtended ? 'bg-black/10 dark:bg-white/15 text-primary rotate-45' : 'hover:bg-black/5 dark:hover:bg-white/10'
          }`}
          title="More reactions"
        >
          <Plus size={19} strokeWidth={2.5} />
        </button>
      </div>

      {/* Extended reaction palette drawer */}
      {showExtended && createPortal(
        <div 
          role="dialog" aria-label="All reactions"
          style={position}
          className="fixed bg-white dark:bg-[#202c33] p-2.5 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 w-[260px] h-[320px] max-h-[calc(100dvh-16px)] z-[100] flex flex-col"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); closeExtended(); } }}
        >
          <div className="col-span-6 flex items-center justify-between px-1 pb-1 mb-1 border-b border-black/5 dark:border-white/5">
            <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">All Reactions</span>
            <button
              type="button"
              aria-label="Close reactions"
              autoFocus
              onClick={closeExtended}
              className="text-secondary hover:text-primary p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X size={13} />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1 overflow-y-auto min-h-0 flex-1 py-1">
          {[...PRIMARY_REACTIONS, ...EXTENDED_REACTIONS].map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React ${emoji}`}
              aria-pressed={currentReaction === emoji}
              onClick={(e) => handlePick(emoji, e)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[19px] hover:scale-125 active:scale-90 transition-transform hover:bg-black/5 dark:hover:bg-white/10"
            >
              {emoji}
            </button>
          ))}
          </div>
          <form className="flex gap-2 pt-2 border-t border-black/5 dark:border-white/10" onSubmit={(e) => {
            e.preventDefault(); e.stopPropagation();
            if (isSingleEmoji(customEmoji.trim())) { triggerHaptic('reaction'); onSelectReaction(customEmoji.trim()); }
          }}>
            <input aria-label="Custom emoji" placeholder="Type or paste an emoji" value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)} maxLength={32} autoComplete="off"
              className="min-w-0 flex-1 rounded-lg px-2 py-2 text-sm bg-black/5 dark:bg-white/10 text-primary select-text" />
            <button type="submit" disabled={!isSingleEmoji(customEmoji.trim())}
              className="px-2 text-sm text-[#008069] dark:text-[#00a884] disabled:opacity-40">Add</button>
          </form>
        </div>, document.body
      )}
    </div>
  );
};
