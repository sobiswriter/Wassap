import React, { useState, useMemo } from 'react';
import { Search, X, Smile, ThumbsUp, Heart, Sparkles, Clock } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface EmojiPickerTrayProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiItem {
  emoji: string;
  name: string;
  category: 'smileys' | 'gestures' | 'hearts' | 'fun';
}

const EMOJI_DATABASE: EmojiItem[] = [
  // Smileys & Faces
  { emoji: '😀', name: 'grinning face smile', category: 'smileys' },
  { emoji: '😃', name: 'smiling face with big eyes happy', category: 'smileys' },
  { emoji: '😄', name: 'smiling face with smiling eyes', category: 'smileys' },
  { emoji: '😁', name: 'beaming face with smiling eyes', category: 'smileys' },
  { emoji: '😆', name: 'grinning squinting face laugh haha', category: 'smileys' },
  { emoji: '😅', name: 'grinning face with sweat sweat smile', category: 'smileys' },
  { emoji: '🤣', name: 'rolling on the floor laughing rofl lmao', category: 'smileys' },
  { emoji: '😂', name: 'face with tears of joy laugh cry funny', category: 'smileys' },
  { emoji: '🙂', name: 'slightly smiling face', category: 'smileys' },
  { emoji: '🙃', name: 'upside down face sarcasm', category: 'smileys' },
  { emoji: '😉', name: 'winking face wink', category: 'smileys' },
  { emoji: '😊', name: 'smiling face with smiling eyes blush', category: 'smileys' },
  { emoji: '😇', name: 'smiling face with halo angel innocent', category: 'smileys' },
  { emoji: '🥰', name: 'smiling face with hearts love adore', category: 'smileys' },
  { emoji: '😍', name: 'smiling face with heart eyes love heart', category: 'smileys' },
  { emoji: '🤩', name: 'star struck excited amazing', category: 'smileys' },
  { emoji: '😘', name: 'face blowing a kiss kiss love', category: 'smileys' },
  { emoji: '😗', name: 'kissing face kiss', category: 'smileys' },
  { emoji: '😚', name: 'kissing face with closed eyes kiss', category: 'smileys' },
  { emoji: '😋', name: 'face savoring food delicious yum', category: 'smileys' },
  { emoji: '😛', name: 'face with tongue playful silly', category: 'smileys' },
  { emoji: '😜', name: 'winking face with tongue tease joke', category: 'smileys' },
  { emoji: '🤪', name: 'zany face crazy wild goofy', category: 'smileys' },
  { emoji: '😝', name: 'squinting face with tongue lol', category: 'smileys' },
  { emoji: '🤑', name: 'money mouth face rich cash', category: 'smileys' },
  { emoji: '🤗', name: 'smiling face with open hands hug', category: 'smileys' },
  { emoji: '🤭', name: 'face with hand over mouth oops giggle', category: 'smileys' },
  { emoji: '🤫', name: 'shushing face quiet secret silence', category: 'smileys' },
  { emoji: '🤔', name: 'thinking face hmm wonder', category: 'smileys' },
  { emoji: '🤐', name: 'zipper mouth face secret silent', category: 'smileys' },
  { emoji: '🤨', name: 'face with raised eyebrow skeptical really', category: 'smileys' },
  { emoji: '😐', name: 'neutral face meh whatever', category: 'smileys' },
  { emoji: '😑', name: 'expressionless face deadpan', category: 'smileys' },
  { emoji: '😶', name: 'face without mouth mute silence', category: 'smileys' },
  { emoji: '😏', name: 'smirking face smirk sly', category: 'smileys' },
  { emoji: '😒', name: 'unamused face annoyed bored', category: 'smileys' },
  { emoji: '🙄', name: 'face with rolling eyes eye roll ugh', category: 'smileys' },
  { emoji: '😬', name: 'grimacing face awkward yikes', category: 'smileys' },
  { emoji: '🤥', name: 'lying face pinocchio lie liar', category: 'smileys' },
  { emoji: '😌', name: 'relieved face calm peaceful', category: 'smileys' },
  { emoji: '😔', name: 'pensive face sad regret', category: 'smileys' },
  { emoji: '😪', name: 'sleepy face tired', category: 'smileys' },
  { emoji: '🤤', name: 'drooling face hungry delicious', category: 'smileys' },
  { emoji: '😴', name: 'sleeping face sleep zzz goodnight', category: 'smileys' },
  { emoji: '😷', name: 'face with medical mask sick covid', category: 'smileys' },
  { emoji: '🤒', name: 'face with thermometer fever sick', category: 'smileys' },
  { emoji: '🤕', name: 'face with head bandage hurt injured', category: 'smileys' },
  { emoji: '🤢', name: 'nauseated face gross vomit', category: 'smileys' },
  { emoji: '🤮', name: 'face vomiting puke gross', category: 'smileys' },
  { emoji: '🤧', name: 'sneezing face sneeze tissue sick', category: 'smileys' },
  { emoji: '🥵', name: 'hot face sweating summer heat', category: 'smileys' },
  { emoji: '🥶', name: 'cold face freezing winter ice', category: 'smileys' },
  { emoji: '🥴', name: 'woozy face dizzy drunk tired', category: 'smileys' },
  { emoji: '😵', name: 'face with crossed out eyes dead knocked out', category: 'smileys' },
  { emoji: '🤯', name: 'exploding head mind blown wow', category: 'smileys' },
  { emoji: '🤠', name: 'cowboy hat face yeehaw', category: 'smileys' },
  { emoji: '🥳', name: 'partying face celebrate birthday party', category: 'smileys' },
  { emoji: '😎', name: 'smiling face with sunglasses cool boss', category: 'smileys' },
  { emoji: '🤓', name: 'nerd face smart geek study', category: 'smileys' },
  { emoji: '🧐', name: 'face with monocle inspect hmm curious', category: 'smileys' },
  { emoji: '😕', name: 'confused face unsure what', category: 'smileys' },
  { emoji: '😟', name: 'worried face concern anxious', category: 'smileys' },
  { emoji: '🙁', name: 'slightly frowning face sad unhappy', category: 'smileys' },
  { emoji: '☹️', name: 'frowning face sad upset', category: 'smileys' },
  { emoji: '😮', name: 'face with open mouth surprised oh wow', category: 'smileys' },
  { emoji: '😯', name: 'hushed face stunned speechless', category: 'smileys' },
  { emoji: '😲', name: 'astonished face shock what', category: 'smileys' },
  { emoji: '😳', name: 'flushed face blush embarrassed wide eyes', category: 'smileys' },
  { emoji: '🥺', name: 'pleading face please puppy eyes beg cute', category: 'smileys' },
  { emoji: '😦', name: 'frowning face with open mouth worry', category: 'smileys' },
  { emoji: '😧', name: 'anguished face shock pain', category: 'smileys' },
  { emoji: '😨', name: 'fearful face scared afraid', category: 'smileys' },
  { emoji: '😰', name: 'anxious face with sweat nervous panic', category: 'smileys' },
  { emoji: '😥', name: 'sad but relieved face whew phew', category: 'smileys' },
  { emoji: '😢', name: 'crying face tear sad weep', category: 'smileys' },
  { emoji: '😭', name: 'loudly crying face sob bawl sobbing', category: 'smileys' },
  { emoji: '😱', name: 'face screaming in fear scream shocked horror', category: 'smileys' },
  { emoji: '😖', name: 'confounded face frustrated pain', category: 'smileys' },
  { emoji: '😣', name: 'persevering face struggle endure', category: 'smileys' },
  { emoji: '😞', name: 'disappointed face letdown sad', category: 'smileys' },
  { emoji: '😓', name: 'downcast face with sweat stress hard', category: 'smileys' },
  { emoji: '😩', name: 'weary face exhausted overwhelmed', category: 'smileys' },
  { emoji: '😫', name: 'tired face done exhausted', category: 'smileys' },
  { emoji: '🥱', name: 'yawning face yawn boring sleepy', category: 'smileys' },
  { emoji: '😤', name: 'face with steam from nose proud angry huff', category: 'smileys' },
  { emoji: '😡', name: 'enraged face pouting mad furious', category: 'smileys' },
  { emoji: '😠', name: 'angry face mad annoyed irritated', category: 'smileys' },
  { emoji: '🤬', name: 'face with symbols on mouth swear cuss rage', category: 'smileys' },

  // Gestures & Hands
  { emoji: '👍', name: 'thumbs up like good yes approve ok', category: 'gestures' },
  { emoji: '👎', name: 'thumbs down dislike bad no', category: 'gestures' },
  { emoji: '👌', name: 'ok hand okay perfect fine', category: 'gestures' },
  { emoji: '🤌', name: 'pinched fingers italian what you want', category: 'gestures' },
  { emoji: '✌️', name: 'victory hand peace two v', category: 'gestures' },
  { emoji: '🤞', name: 'crossed fingers good luck hope', category: 'gestures' },
  { emoji: '🫰', name: 'hand with index finger and thumb crossed finger heart', category: 'gestures' },
  { emoji: '🤟', name: 'love-you gesture ily rock', category: 'gestures' },
  { emoji: '🤘', name: 'sign of the horns rock metal', category: 'gestures' },
  { emoji: '🤙', name: 'call me hand shaka hang loose phone', category: 'gestures' },
  { emoji: '👋', name: 'waving hand wave hello bye hi goodbye', category: 'gestures' },
  { emoji: '👏', name: 'clapping hands applause bravo praise', category: 'gestures' },
  { emoji: '🙌', name: 'raising hands celebrate praise hooray', category: 'gestures' },
  { emoji: '👐', name: 'open hands embrace welcome', category: 'gestures' },
  { emoji: '🤲', name: 'palms up together pray dua blessing', category: 'gestures' },
  { emoji: '🤝', name: 'handshake agree deal partner', category: 'gestures' },
  { emoji: '🙏', name: 'folded hands pray thank you please namaste', category: 'gestures' },
  { emoji: '✍️', name: 'writing hand write text note', category: 'gestures' },
  { emoji: '💅', name: 'nail polish sassy glam', category: 'gestures' },
  { emoji: '🤳', name: 'selfie camera photo picture', category: 'gestures' },
  { emoji: '💪', name: 'flexed biceps muscle strong gym flex', category: 'gestures' },
  { emoji: '👊', name: 'oncoming fist fist bump punch bro', category: 'gestures' },
  { emoji: '✊', name: 'raised fist solidarity power', category: 'gestures' },

  // Hearts & Romance
  { emoji: '❤️', name: 'red heart love romance sweet', category: 'hearts' },
  { emoji: '🧡', name: 'orange heart warm care', category: 'hearts' },
  { emoji: '💛', name: 'yellow heart friendship friend sunshine', category: 'hearts' },
  { emoji: '💚', name: 'green heart nature jealous peace', category: 'hearts' },
  { emoji: '💙', name: 'blue heart trust loyal calm', category: 'hearts' },
  { emoji: '💜', name: 'purple heart regal royal BTS', category: 'hearts' },
  { emoji: '🖤', name: 'black heart dark emo goth', category: 'hearts' },
  { emoji: '🤍', name: 'white heart pure angel peace', category: 'hearts' },
  { emoji: '🤎', name: 'brown heart earth chocolate', category: 'hearts' },
  { emoji: '💔', name: 'broken heart heartbreak sad breakup', category: 'hearts' },
  { emoji: '❣️', name: 'heart exclamation point excited love', category: 'hearts' },
  { emoji: '💕', name: 'two hearts love floating sweet', category: 'hearts' },
  { emoji: '💞', name: 'revolving hearts passion romance', category: 'hearts' },
  { emoji: '💓', name: 'beating heart pulse heartbeat', category: 'hearts' },
  { emoji: '💗', name: 'growing heart expanding love fond', category: 'hearts' },
  { emoji: '💖', name: 'sparkling heart sparkle shine', category: 'hearts' },
  { emoji: '💘', name: 'heart with arrow cupid struck romance', category: 'hearts' },
  { emoji: '💝', name: 'heart with ribbon gift present love', category: 'hearts' },
  { emoji: '💋', name: 'kiss mark lips lipstick romantic', category: 'hearts' },
  { emoji: '🫂', name: 'people hugging hug comfort embrace', category: 'hearts' },

  // Fun, Objects & Celebration
  { emoji: '🔥', name: 'fire lit hot flame awesome hype', category: 'fun' },
  { emoji: '💯', name: 'hundred points keep it 100 perfect real', category: 'fun' },
  { emoji: '✨', name: 'sparkles magic shiny clean aesthetic', category: 'fun' },
  { emoji: '⭐', name: 'star gold favorite rate', category: 'fun' },
  { emoji: '🌟', name: 'glowing star bright shining celebrity', category: 'fun' },
  { emoji: '🎉', name: 'party popper celebrate celebration congrats woo', category: 'fun' },
  { emoji: '🎊', name: 'confetti ball celebration party', category: 'fun' },
  { emoji: '🎈', name: 'balloon birthday party floating', category: 'fun' },
  { emoji: '🎂', name: 'birthday cake cake dessert celebration', category: 'fun' },
  { emoji: '🎁', name: 'wrapped gift present surprise package', category: 'fun' },
  { emoji: '🏆', name: 'trophy winner champion 1st first place', category: 'fun' },
  { emoji: '💀', name: 'skull dead dying laughing lol', category: 'fun' },
  { emoji: '☠️', name: 'skull and crossbones pirate danger dead', category: 'fun' },
  { emoji: '💩', name: 'pile of poo poop funny silly', category: 'fun' },
  { emoji: '👻', name: 'ghost spooky halloween boo', category: 'fun' },
  { emoji: '🤡', name: 'clown face circus foolish clowning', category: 'fun' },
  { emoji: '👀', name: 'eyes looking see watch tea drama', category: 'fun' },
  { emoji: '☕', name: 'hot beverage coffee tea morning', category: 'fun' },
  { emoji: '🍕', name: 'pizza slice food dinner cheese', category: 'fun' },
  { emoji: '🍻', name: 'clinking beer mugs cheers party drinks', category: 'fun' },
];

const DEFAULT_RECENTS = ['❤️', '😂', '🔥', '👍', '🙏', '😍', '✨', '🥺'];

export const EmojiPickerTray: React.FC<EmojiPickerTrayProps> = ({
  onSelectEmoji,
  onClose,
  onOpenNativeKeyboard,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'smileys' | 'gestures' | 'hearts' | 'fun'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wassap_recent_emojis');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 16);
      }
    } catch {}
    return DEFAULT_RECENTS;
  });

  const handleEmojiClick = (emoji: string) => {
    triggerHaptic('tap');
    onSelectEmoji(emoji);

    // Save to recents
    setRecentEmojis(prev => {
      const updated = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 16);
      try {
        localStorage.setItem('wassap_recent_emojis', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const filteredEmojis = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      return EMOJI_DATABASE.filter(item => item.name.toLowerCase().includes(term) || item.emoji.includes(term));
    }
    if (activeTab === 'all') return EMOJI_DATABASE;
    return EMOJI_DATABASE.filter(item => item.category === activeTab);
  }, [searchTerm, activeTab]);

  return (
    <div
      className="w-full bg-white dark:bg-[#202c33] rounded-2xl shadow-2xl border app-border overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col select-none"
      style={{ maxHeight: '360px' }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 border-b app-border bg-[#f0f2f5] dark:bg-[#182229] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Smile size={18} className="text-[#21c063] shrink-0" />
          <span className="text-[13.5px] font-semibold text-primary truncate">Emojis</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title="Close emoji panel"
          aria-label="Close emoji panel"
        >
          <X size={17} />
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="bg-[#f0f2f5] dark:bg-[#111b21] rounded-lg px-2.5 py-1.5 flex items-center gap-2 border app-border focus-within:ring-1 focus-within:ring-[#21c063]/30">
          <Search size={14} className="text-secondary shrink-0" />
          <input
            type="text"
            placeholder="Search emojis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[12.5px] text-primary min-w-0"
            autoFocus={false}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-secondary hover:text-primary p-0.5"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs (shown when not searching) */}
      {!searchTerm && (
        <div className="px-2 pt-1 pb-1 flex items-center gap-1 border-b app-border text-secondary overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors shrink-0 flex items-center gap-1 ${
              activeTab === 'all'
                ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            <span>All</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('smileys')}
            className={`px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors shrink-0 flex items-center gap-1 ${
              activeTab === 'smileys'
                ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            <Smile size={13} />
            <span>Smileys</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gestures')}
            className={`px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors shrink-0 flex items-center gap-1 ${
              activeTab === 'gestures'
                ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            <ThumbsUp size={13} />
            <span>Hands</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hearts')}
            className={`px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors shrink-0 flex items-center gap-1 ${
              activeTab === 'hearts'
                ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            <Heart size={13} />
            <span>Hearts</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fun')}
            className={`px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors shrink-0 flex items-center gap-1 ${
              activeTab === 'fun'
                ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            <Sparkles size={13} />
            <span>Fun</span>
          </button>
        </div>
      )}

      {/* Emoji Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar min-h-[180px] max-h-[240px]">
        {/* Recents Row (shown on 'all' tab when no search) */}
        {!searchTerm && activeTab === 'all' && recentEmojis.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-secondary uppercase tracking-wider px-1 mb-1.5">
              <Clock size={11} />
              <span>Recent</span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {recentEmojis.map((emoji, idx) => (
                <button
                  key={`recent-${emoji}-${idx}`}
                  type="button"
                  onClick={() => handleEmojiClick(emoji)}
                  className="w-9 h-9 sm:w-10 sm:h-10 text-[20px] sm:text-[22px] rounded-lg hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtered Emojis Grid */}
        <div>
          {!searchTerm && activeTab === 'all' && (
            <div className="text-[11px] font-semibold text-secondary uppercase tracking-wider px-1 mb-1.5">
              All Emojis
            </div>
          )}
          {filteredEmojis.length === 0 ? (
            <div className="text-center py-8 text-secondary text-[12px]">
              No emojis found for "{searchTerm}"
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {filteredEmojis.map((item, idx) => (
                <button
                  key={`${item.emoji}-${idx}`}
                  type="button"
                  onClick={() => handleEmojiClick(item.emoji)}
                  title={item.name}
                  className="w-9 h-9 sm:w-10 sm:h-10 text-[20px] sm:text-[22px] rounded-lg hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
