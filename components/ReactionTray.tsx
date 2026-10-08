import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

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
  '💪', '🤝', '👀', '💡', '🌟', '💔'
];

export const ReactionTray: React.FC<ReactionTrayProps> = ({
  onSelectReaction,
  onClose,
  currentReaction,
  isMe = false
}) => {
  const [showExtended, setShowExtended] = useState(false);

  const handlePick = (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('reaction');
    onSelectReaction(emoji);
  };

  return (
    <div 
      className={`absolute z-50 -top-12 ${isMe ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'} select-none`}
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
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic('tap');
            setShowExtended(!showExtended);
          }}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-secondary hover:text-primary transition-all duration-150 hover:scale-110 active:scale-90 ${
            showExtended ? 'bg-black/10 dark:bg-white/15 text-primary rotate-45' : 'hover:bg-black/5 dark:hover:bg-white/10'
          }`}
          title="More reactions"
        >
          <Plus size={19} strokeWidth={2.5} />
        </button>
      </div>

      {/* Extended reaction palette drawer */}
      {showExtended && (
        <div 
          className="animate-in fade-in zoom-in-95 duration-150 absolute bottom-14 left-0 bg-white dark:bg-[#202c33] p-2.5 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 grid grid-cols-6 gap-1 w-[240px] z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="col-span-6 flex items-center justify-between px-1 pb-1 mb-1 border-b border-black/5 dark:border-white/5">
            <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">All Reactions</span>
            <button
              type="button"
              onClick={() => setShowExtended(false)}
              className="text-secondary hover:text-primary p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X size={13} />
            </button>
          </div>
          {EXTENDED_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={(e) => handlePick(emoji, e)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[19px] hover:scale-125 active:scale-90 transition-transform hover:bg-black/5 dark:hover:bg-white/10"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
