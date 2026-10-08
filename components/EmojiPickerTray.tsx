import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Smile, ThumbsUp, Heart, Sparkles, Clock, Film, Sticker, Plus, Upload, Loader2, Globe, Link as LinkIcon } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { GIF_DATABASE, STICKER_DATABASE, GifItem, StickerItem, searchGifsOnline, searchStickersOnline } from '../utils/stickersAndGifs';

interface EmojiPickerTrayProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectGif?: (gifUrl: string, name?: string) => void;
  onSelectSticker?: (stickerUrl: string, name?: string) => void;
  onClose: () => void;
  giphyApiKey?: string;
  onOpenSettings?: () => void;
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
  { emoji: '🥱', name: 'yawning face tired sleepy bored', category: 'smileys' },
  { emoji: '😤', name: 'face with steam from nose proud angry', category: 'smileys' },
  { emoji: '😡', name: 'pouting face angry mad', category: 'smileys' },
  { emoji: '😠', name: 'angry face mad rage', category: 'smileys' },
  { emoji: '🤬', name: 'face with symbols on mouth swearing cursing', category: 'smileys' },
  { emoji: '😈', name: 'smiling face with horns devil evil mischievous', category: 'smileys' },
  { emoji: '👿', name: 'angry face with horns devil demon', category: 'smileys' },
  { emoji: '💀', name: 'skull dead dying laughing', category: 'smileys' },
  { emoji: '☠️', name: 'skull and crossbones danger poison', category: 'smileys' },
  { emoji: '💩', name: 'pile of poo poop funny', category: 'smileys' },
  { emoji: '🤡', name: 'clown face fool goofy', category: 'smileys' },
  { emoji: '👹', name: 'ogre japanese mask monster', category: 'smileys' },
  { emoji: '👺', name: 'goblin mask tengu red', category: 'smileys' },
  { emoji: '👻', name: 'ghost spooky halloween', category: 'smileys' },
  { emoji: '👽', name: 'alien ufo extraterrestrial', category: 'smileys' },
  { emoji: '👾', name: 'alien monster retro pixel game', category: 'smileys' },
  { emoji: '🤖', name: 'robot face tech ai bot', category: 'smileys' },

  // Hands & Gestures
  { emoji: '👍', name: 'thumbs up like good yes approve', category: 'gestures' },
  { emoji: '👎', name: 'thumbs down dislike bad no', category: 'gestures' },
  { emoji: '👏', name: 'clapping hands applause bravo well done', category: 'gestures' },
  { emoji: '🙌', name: 'raising hands celebration praise hooray', category: 'gestures' },
  { emoji: '👐', name: 'open hands hug welcome', category: 'gestures' },
  { emoji: '🤲', name: 'palms up together pray offer', category: 'gestures' },
  { emoji: '🤝', name: 'handshake deal agreement partnership', category: 'gestures' },
  { emoji: '🙏', name: 'folded hands pray please thank you namaste', category: 'gestures' },
  { emoji: '✍️', name: 'writing hand write taking notes', category: 'gestures' },
  { emoji: '💅', name: 'nail polish sassy stylish fab', category: 'gestures' },
  { emoji: '🤳', name: 'selfie photo phone camera', category: 'gestures' },
  { emoji: '💪', name: 'flexed biceps muscle strong power workout', category: 'gestures' },
  { emoji: '🦾', name: 'mechanical arm bionic robot strong', category: 'gestures' },
  { emoji: '🦵', name: 'leg kick knee', category: 'gestures' },
  { emoji: '🦶', name: 'foot barefoot toe', category: 'gestures' },
  { emoji: '👂', name: 'ear listen hearing sound', category: 'gestures' },
  { emoji: '👃', name: 'nose smell sniff scent', category: 'gestures' },
  { emoji: '🧠', name: 'brain smart think mind intelligence', category: 'gestures' },
  { emoji: '🫀', name: 'anatomical heart organ biology', category: 'gestures' },
  { emoji: '🫁', name: 'lungs breath breathing respiratory', category: 'gestures' },
  { emoji: '👀', name: 'eyes look see watching spy drama', category: 'gestures' },
  { emoji: '👁️', name: 'eye watching see vision', category: 'gestures' },
  { emoji: '👅', name: 'tongue taste lick playful', category: 'gestures' },
  { emoji: '👄', name: 'mouth lips kiss speak talk', category: 'gestures' },
  { emoji: '💋', name: 'kiss mark lips lipstick romantic', category: 'gestures' },
  { emoji: '👋', name: 'waving hand wave hello hi goodbye bye', category: 'gestures' },
  { emoji: '🤚', name: 'raised back of hand stop high five', category: 'gestures' },
  { emoji: '🖐️', name: 'hand with fingers splayed five stop', category: 'gestures' },
  { emoji: '✋', name: 'raised hand stop high five pause', category: 'gestures' },
  { emoji: '🖖', name: 'vulcan salute live long and prosper spock', category: 'gestures' },
  { emoji: '👌', name: 'ok hand okay perfect fine good', category: 'gestures' },
  { emoji: '🤌', name: 'pinched fingers italian chef what do you want', category: 'gestures' },
  { emoji: '🤏', name: 'pinching hand small tiny little bit', category: 'gestures' },
  { emoji: '✌️', name: 'victory hand peace two deuces', category: 'gestures' },
  { emoji: '🤞', name: 'crossed fingers luck wish hope promise', category: 'gestures' },
  { emoji: '🫰', name: 'hand with index finger and thumb crossed finger heart korean love money', category: 'gestures' },
  { emoji: '🤟', name: 'love you gesture ily sign rock on', category: 'gestures' },
  { emoji: '🤘', name: 'sign of the horns rock metal heavy rock on', category: 'gestures' },
  { emoji: '🤙', name: 'call me hand shaka hang loose surf', category: 'gestures' },
  { emoji: '👈', name: 'backhand index pointing left look', category: 'gestures' },
  { emoji: '👉', name: 'backhand index pointing right this', category: 'gestures' },
  { emoji: '👆', name: 'backhand index pointing up above', category: 'gestures' },
  { emoji: '🖕', name: 'middle finger offensive anger', category: 'gestures' },
  { emoji: '👇', name: 'backhand index pointing down below', category: 'gestures' },
  { emoji: '☝️', name: 'index pointing up one listen attention', category: 'gestures' },

  // Hearts & Romance
  { emoji: '❤️', name: 'red heart love romance true love', category: 'hearts' },
  { emoji: '🧡', name: 'orange heart warm care friendly', category: 'hearts' },
  { emoji: '💛', name: 'yellow heart friendship joy sunny', category: 'hearts' },
  { emoji: '💚', name: 'green heart nature life health', category: 'hearts' },
  { emoji: '💙', name: 'blue heart trust peace loyalty', category: 'hearts' },
  { emoji: '💜', name: 'purple heart royalty luxury magic', category: 'hearts' },
  { emoji: '🤎', name: 'brown heart earth chocolate cozy', category: 'hearts' },
  { emoji: '🖤', name: 'black heart dark gothic sorrow', category: 'hearts' },
  { emoji: '🤍', name: 'white heart pure angel peace', category: 'hearts' },
  { emoji: '💔', name: 'broken heart heartbreak sad dump breakup', category: 'hearts' },
  { emoji: '❤️‍🔥', name: 'heart on fire passion burning love hot', category: 'hearts' },
  { emoji: '❤️‍🩹', name: 'mending heart healing recovery better', category: 'hearts' },
  { emoji: '❣️', name: 'heart exclamation point excited emphasis', category: 'hearts' },
  { emoji: '💕', name: 'two hearts love floating affection', category: 'hearts' },
  { emoji: '💞', name: 'revolving hearts revolving love rotation', category: 'hearts' },
  { emoji: '💓', name: 'beating heart pulse heartbeat alive', category: 'hearts' },
  { emoji: '💗', name: 'growing heart expanding excited love', category: 'hearts' },
  { emoji: '💖', name: 'sparkling heart glitter shine love', category: 'hearts' },
  { emoji: '💘', name: 'heart with arrow cupid struck romance', category: 'hearts' },
  { emoji: '💝', name: 'heart with ribbon gift present valentine', category: 'hearts' },
  { emoji: '💟', name: 'heart decoration purple square badge', category: 'hearts' },

  // Fun, Sparkles & Vibe
  { emoji: '✨', name: 'sparkles stars magic glitter clean fresh aesthetic', category: 'fun' },
  { emoji: '⭐', name: 'star gold celestial favorite', category: 'fun' },
  { emoji: '🌟', name: 'glowing star shine bright sparkle', category: 'fun' },
  { emoji: '💫', name: 'dizzy star shooting star magic', category: 'fun' },
  { emoji: '🔥', name: 'fire flame lit hot trend burn', category: 'fun' },
  { emoji: '💥', name: 'collision boom bang explode shock', category: 'fun' },
  { emoji: '💯', name: 'hundred points score perfect keep it 100', category: 'fun' },
  { emoji: '🎉', name: 'party popper celebrate celebration congrats birthday', category: 'fun' },
  { emoji: '🎊', name: 'confetti ball celebration festive event', category: 'fun' },
  { emoji: '🎈', name: 'balloon birthday party float fun', category: 'fun' },
  { emoji: '🎁', name: 'wrapped gift present surprise box', category: 'fun' },
  { emoji: '🏆', name: 'trophy winner champion first place gold', category: 'fun' },
  { emoji: '🥇', name: 'first place medal gold champion 1st', category: 'fun' },
  { emoji: '🎯', name: 'bullseye direct hit target goal focus', category: 'fun' },
  { emoji: '🚀', name: 'rocket ship blast off to the moon fast speed', category: 'fun' },
  { emoji: '⚡', name: 'high voltage lightning bolt power energy electric fast', category: 'fun' },
  { emoji: '🌈', name: 'rainbow colorful pride weather sky beauty', category: 'fun' },
  { emoji: '🍕', name: 'pizza slice food pepperoni delicious cheesy', category: 'fun' },
  { emoji: '🍔', name: 'hamburger burger fast food diner', category: 'fun' },
  { emoji: '🍟', name: 'french fries chips fast food snack', category: 'fun' },
  { emoji: '🍻', name: 'clinking beer mugs cheers drinks party bar', category: 'fun' },
  { emoji: '🥂', name: 'clinking glasses champagne cheers celebrate toast', category: 'fun' },
  { emoji: '☕', name: 'hot beverage coffee tea cup morning cozy', category: 'fun' },
  { emoji: '🎧', name: 'headphone music sound beats listening songs', category: 'fun' },
  { emoji: '🎮', name: 'video game controller gaming play esports', category: 'fun' },
  { emoji: '🎲', name: 'game die dice roll luck casino gamble', category: 'fun' }
];

const DEFAULT_RECENTS = ['😂', '❤️', '👍', '🔥', '✨', '🥰', '🙏', '🥺'];

export const EmojiPickerTray: React.FC<EmojiPickerTrayProps> = ({
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  onClose,
  giphyApiKey,
  onOpenSettings
}) => {
  const [mainTab, setMainTab] = useState<'emojis' | 'gifs' | 'stickers'>('emojis');
  const [searchTerm, setSearchTerm] = useState('');
  const [emojiCategory, setEmojiCategory] = useState<'all' | 'smileys' | 'gestures' | 'hearts' | 'fun'>('all');
  const [gifCategory, setGifCategory] = useState<'all' | 'trending' | 'reactions' | 'laughing' | 'love' | 'shocked' | 'dancing' | 'memes' | 'yesno'>('all');
  const [stickerPack, setStickerPack] = useState<'all' | 'pepe' | 'cats' | '3d' | 'anime' | 'memes'>('all');

  const [onlineGifs, setOnlineGifs] = useState<GifItem[]>([]);
  const [onlineStickers, setOnlineStickers] = useState<StickerItem[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [hasOnlineResults, setHasOnlineResults] = useState(false);
  const [hiddenGifUrls, setHiddenGifUrls] = useState<Set<string>>(new Set());
  const [hiddenStickerUrls, setHiddenStickerUrls] = useState<Set<string>>(new Set());

  const customGifInputRef = useRef<HTMLInputElement>(null);
  const customStickerInputRef = useRef<HTMLInputElement>(null);

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

    setRecentEmojis(prev => {
      const updated = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 16);
      try {
        localStorage.setItem('wassap_recent_emojis', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleGifClick = (gif: { url: string; name: string }) => {
    triggerHaptic('send');
    if (onSelectGif) {
      onSelectGif(gif.url, gif.name);
    }
  };

  const handleStickerClick = (sticker: { dataUrl: string; name: string }) => {
    triggerHaptic('send');
    if (onSelectSticker) {
      onSelectSticker(sticker.dataUrl, sticker.name);
    }
  };

  // Upload Custom GIF
  const handleCustomGifUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (dataUrl && onSelectGif) {
        triggerHaptic('send');
        onSelectGif(dataUrl, file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Upload Custom Sticker
  const handleCustomStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (dataUrl && onSelectSticker) {
        triggerHaptic('send');
        onSelectSticker(dataUrl, file.name || 'custom-sticker.webp');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Detect whether search term is a pasted direct media link
  const isPastedUrl = useMemo(() => {
    const trimmed = searchTerm.trim();
    return /^https?:\/\/.+/i.test(trimmed) || /^data:image\/.+/i.test(trimmed);
  }, [searchTerm]);

  // Debounced online search for GIFs and Stickers via GIPHY
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term || isPastedUrl) {
      setOnlineGifs([]);
      setOnlineStickers([]);
      setHasOnlineResults(false);
      setIsSearchingOnline(false);
      return;
    }

    if (mainTab !== 'gifs' && mainTab !== 'stickers') {
      return;
    }

    setIsSearchingOnline(true);
    const timer = window.setTimeout(async () => {
      try {
        if (mainTab === 'gifs') {
          const res = await searchGifsOnline(term, giphyApiKey);
          if (res.ok && res.results.length > 0) {
            setOnlineGifs(res.results);
            setHasOnlineResults(Boolean(res.isOnline));
          } else {
            setOnlineGifs([]);
            setHasOnlineResults(false);
          }
        } else if (mainTab === 'stickers') {
          const res = await searchStickersOnline(term, giphyApiKey);
          if (res.ok && res.results.length > 0) {
            setOnlineStickers(res.results);
            setHasOnlineResults(Boolean(res.isOnline));
          } else {
            setOnlineStickers([]);
            setHasOnlineResults(false);
          }
        }
      } catch (err) {
        console.warn('Online media search error:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, mainTab, giphyApiKey, isPastedUrl]);

  const filteredEmojis = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      return EMOJI_DATABASE.filter(item => item.name.toLowerCase().includes(term) || item.emoji.includes(term));
    }
    if (emojiCategory === 'all') return EMOJI_DATABASE;
    return EMOJI_DATABASE.filter(item => item.category === emojiCategory);
  }, [searchTerm, emojiCategory]);

  const filteredGifs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      return GIF_DATABASE.filter(item => 
        item.name.toLowerCase().includes(term) || 
        item.tags.some(t => t.toLowerCase().includes(term))
      );
    }
    if (gifCategory === 'all') return GIF_DATABASE;
    return GIF_DATABASE.filter(item => item.category === gifCategory);
  }, [searchTerm, gifCategory]);

  const displayedGifs = useMemo(() => {
    if (searchTerm.trim() && onlineGifs.length > 0) {
      return onlineGifs;
    }
    return filteredGifs;
  }, [searchTerm, onlineGifs, filteredGifs]);

  const visibleGifs = useMemo(() => {
    return displayedGifs.filter(gif => !hiddenGifUrls.has(gif.url));
  }, [displayedGifs, hiddenGifUrls]);

  const filteredStickers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      return STICKER_DATABASE.filter(item => 
        item.name.toLowerCase().includes(term) || 
        item.tags.some(t => t.toLowerCase().includes(term))
      );
    }
    if (stickerPack === 'all') return STICKER_DATABASE;
    return STICKER_DATABASE.filter(item => item.pack === stickerPack);
  }, [searchTerm, stickerPack]);

  const displayedStickers = useMemo(() => {
    if (searchTerm.trim() && onlineStickers.length > 0) {
      return onlineStickers;
    }
    return filteredStickers;
  }, [searchTerm, onlineStickers, filteredStickers]);

  const visibleStickers = useMemo(() => {
    return displayedStickers.filter(sticker => !hiddenStickerUrls.has(sticker.dataUrl));
  }, [displayedStickers, hiddenStickerUrls]);

  return (
    <div
      className="w-full bg-white dark:bg-[#202c33] rounded-2xl shadow-2xl border app-border overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col select-none"
      style={{ maxHeight: '440px', height: '410px' }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <input 
        type="file" 
        ref={customGifInputRef} 
        accept="image/gif,video/mp4,video/webm" 
        className="hidden" 
        onChange={handleCustomGifUpload} 
      />
      <input 
        type="file" 
        ref={customStickerInputRef} 
        accept="image/*,.webp" 
        className="hidden" 
        onChange={handleCustomStickerUpload} 
      />

      {/* Top Main Navigation Tabs */}
      <div className="px-3 pt-2 pb-1.5 border-b app-border bg-[#f0f2f5] dark:bg-[#182229] flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => { triggerHaptic('tap'); setMainTab('emojis'); setSearchTerm(''); }}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-all flex items-center gap-1.5 touch-btn ${
              mainTab === 'emojis'
                ? 'bg-[#21c063] text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Smile size={15} />
            <span>Emojis</span>
          </button>

          <button
            type="button"
            onClick={() => { triggerHaptic('tap'); setMainTab('gifs'); setSearchTerm(''); }}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-all flex items-center gap-1.5 touch-btn ${
              mainTab === 'gifs'
                ? 'bg-[#21c063] text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Film size={15} />
            <span>GIFs</span>
          </button>

          <button
            type="button"
            onClick={() => { triggerHaptic('tap'); setMainTab('stickers'); setSearchTerm(''); }}
            className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-all flex items-center gap-1.5 touch-btn ${
              mainTab === 'stickers'
                ? 'bg-[#21c063] text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Sticker size={15} />
            <span>Stickers</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          title="Close panel"
          aria-label="Close panel"
        >
          <X size={17} />
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="px-3 pt-2 pb-1">
        <div className="bg-[#f0f2f5] dark:bg-[#111b21] rounded-lg px-2.5 py-1.5 flex items-center gap-2 border app-border focus-within:ring-1 focus-within:ring-[#21c063]/30">
          <Search size={14} className="text-secondary shrink-0" />
          <input
            type="text"
            placeholder={
              mainTab === 'emojis' 
                ? "Search emojis..." 
                : mainTab === 'gifs' 
                  ? "Search reaction GIFs..." 
                  : "Search stickers..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[12px] text-primary min-w-0"
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

      {/* --- EMOJIS SUB-TABS --- */}
      {mainTab === 'emojis' && !searchTerm && (
        <div className="px-2 pt-0.5 pb-1 flex items-center gap-1 border-b app-border text-secondary overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setEmojiCategory('all')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1 ${
              emojiCategory === 'all'
                ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            <span>All</span>
          </button>
          <button
            type="button"
            onClick={() => setEmojiCategory('smileys')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1 ${
              emojiCategory === 'smileys'
                ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            <Smile size={12} />
            <span>Smileys</span>
          </button>
          <button
            type="button"
            onClick={() => setEmojiCategory('gestures')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1 ${
              emojiCategory === 'gestures'
                ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            <ThumbsUp size={12} />
            <span>Hands</span>
          </button>
          <button
            type="button"
            onClick={() => setEmojiCategory('hearts')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1 ${
              emojiCategory === 'hearts'
                ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            <Heart size={12} />
            <span>Hearts</span>
          </button>
          <button
            type="button"
            onClick={() => setEmojiCategory('fun')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1 ${
              emojiCategory === 'fun'
                ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            <Sparkles size={12} />
            <span>Fun</span>
          </button>
        </div>
      )}

      {/* --- GIFS SUB-TABS --- */}
      {mainTab === 'gifs' && !searchTerm && (
        <div className="px-2 pt-0.5 pb-1 flex items-center gap-1 border-b app-border text-secondary overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'trending', label: '🔥 Trending' },
            { id: 'reactions', label: '👀 Reactions' },
            { id: 'laughing', label: '😂 Laughing' },
            { id: 'love', label: '❤️ Love' },
            { id: 'shocked', label: '🤯 Shocked' },
            { id: 'dancing', label: '🕺 Dancing' },
            { id: 'memes', label: '😎 Memes' },
            { id: 'yesno', label: '👍 Yes / No' }
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setGifCategory(cat.id as any)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                gifCategory === cat.id
                  ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* --- STICKERS SUB-TABS --- */}
      {mainTab === 'stickers' && !searchTerm && (
        <div className="px-2 pt-0.5 pb-1 flex items-center gap-1 border-b app-border text-secondary overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Packs' },
            { id: 'pepe', label: '🐸 Pepe & Frog' },
            { id: 'cats', label: '🐱 Cute Cats' },
            { id: '3d', label: '✨ 3D WhatsApp' },
            { id: 'anime', label: '🌸 Anime & Chibi' },
            { id: 'memes', label: '🔥 Classic Memes' }
          ].map(pack => (
            <button
              key={pack.id}
              type="button"
              onClick={() => setStickerPack(pack.id as any)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                stickerPack === pack.id
                  ? 'bg-[#21c063]/15 text-[#21c063] dark:text-[#25d366]'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 text-secondary'
              }`}
            >
              {pack.label}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar min-h-[180px]">
        
        {/* === 1. EMOJIS VIEW === */}
        {mainTab === 'emojis' && (
          <div>
            {!searchTerm && emojiCategory === 'all' && recentEmojis.length > 0 && (
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

            <div>
              {!searchTerm && emojiCategory === 'all' && (
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
        )}

        {/* === 2. GIFS VIEW === */}
        {mainTab === 'gifs' && (
          <div>
            {/* Direct URL Pasted Preview Card */}
            {isPastedUrl && (
              <div className="mb-3 p-2.5 rounded-xl border-2 border-[#21c063] bg-[#21c063]/10 flex flex-col gap-2 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between text-xs font-semibold text-[#21c063]">
                  <span className="flex items-center gap-1.5"><LinkIcon size={14} /> Send Pasted GIF Link</span>
                  <span className="text-[10px] bg-[#21c063]/20 px-1.5 py-0.5 rounded">Preview</span>
                </div>
                <div className="h-28 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center">
                  <img
                    src={searchTerm.trim()}
                    alt="Pasted preview"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleGifClick({ url: searchTerm.trim(), name: 'Pasted GIF' })}
                  className="w-full py-1.5 bg-[#21c063] hover:bg-[#1eb05b] text-white text-xs font-medium rounded-lg shadow-sm active:scale-95 transition-all text-center cursor-pointer"
                >
                  Send this GIF
                </button>
              </div>
            )}

            {/* Online Searching Loading Indicator */}
            {isSearchingOnline && (
              <div className="flex items-center justify-center gap-2 py-2 mb-2 text-[11px] text-[#21c063] font-medium bg-[#21c063]/10 rounded-lg animate-pulse">
                <Loader2 size={13} className="animate-spin" />
                <span>Searching GIPHY online library...</span>
              </div>
            )}

            {/* Online Results Indicator */}
            {hasOnlineResults && !isSearchingOnline && (
              <div className="flex items-center justify-between px-1.5 py-1 mb-2 text-[10.5px] border-b app-border text-secondary">
                <span className="flex items-center gap-1 text-[#21c063] font-medium">
                  <Globe size={11} /> Online Search Results
                </span>
                <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75">
                  Powered by GIPHY
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {/* Upload Custom GIF Card */}
              <button
                type="button"
                onClick={() => customGifInputRef.current?.click()}
                className="h-[105px] rounded-xl border-2 border-dashed border-[#21c063]/40 hover:border-[#21c063] bg-[#21c063]/5 hover:bg-[#21c063]/10 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 text-[#21c063] cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#21c063]/15 flex items-center justify-center">
                  <Upload size={17} />
                </div>
                <span className="text-[11.5px] font-semibold">+ Custom GIF</span>
                <span className="text-[9.5px] text-secondary">from phone / PC</span>
              </button>

              {visibleGifs.map(gif => (
                <div
                  key={gif.id}
                  onClick={() => handleGifClick(gif)}
                  className="h-[105px] rounded-xl overflow-hidden relative cursor-pointer group bg-black/10 dark:bg-black/40 border border-black/5 dark:border-white/5 hover:border-[#21c063]/50 transition-all active:scale-95 shadow-xs"
                >
                  <img
                    src={gif.previewUrl || gif.url}
                    alt={gif.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      // GIPHY returns an explicit 480x270 placeholder graphic of 239321 bytes with text "THIS CONTENT IS NOT AVAILABLE"
                      if (img.naturalWidth === 480 && img.naturalHeight === 270) {
                        setHiddenGifUrls(prev => {
                          const updated = new Set(prev);
                          updated.add(gif.url);
                          return updated;
                        });
                      }
                    }}
                    onError={() => {
                      setHiddenGifUrls(prev => {
                        const updated = new Set(prev);
                        updated.add(gif.url);
                        return updated;
                      });
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-1.5 pt-4">
                    <p className="text-[10px] text-white font-medium truncate drop-shadow-sm">
                      {gif.name}
                    </p>
                  </div>
                  <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[8.5px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase backdrop-blur-xs">
                    GIF
                  </span>
                </div>
              ))}
            </div>

            {visibleGifs.length === 0 && !isSearchingOnline && (
              <div className="text-center py-8 text-secondary text-[12px]">
                No GIFs found for "{searchTerm}"
              </div>
            )}
          </div>
        )}

        {/* === 3. STICKERS VIEW === */}
        {mainTab === 'stickers' && (
          <div>
            {/* Direct URL Pasted Preview Card */}
            {isPastedUrl && (
              <div className="mb-3 p-2.5 rounded-xl border-2 border-[#21c063] bg-[#21c063]/10 flex flex-col gap-2 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between text-xs font-semibold text-[#21c063]">
                  <span className="flex items-center gap-1.5"><LinkIcon size={14} /> Send Pasted Sticker Link</span>
                  <span className="text-[10px] bg-[#21c063]/20 px-1.5 py-0.5 rounded">Preview</span>
                </div>
                <div className="h-24 rounded-lg overflow-hidden bg-black/10 dark:bg-black/30 flex items-center justify-center p-2">
                  <img
                    src={searchTerm.trim()}
                    alt="Pasted sticker preview"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleStickerClick({ dataUrl: searchTerm.trim(), name: 'Pasted Sticker' })}
                  className="w-full py-1.5 bg-[#21c063] hover:bg-[#1eb05b] text-white text-xs font-medium rounded-lg shadow-sm active:scale-95 transition-all text-center cursor-pointer"
                >
                  Send this Sticker
                </button>
              </div>
            )}

            {/* Online Searching Loading Indicator */}
            {isSearchingOnline && (
              <div className="flex items-center justify-center gap-2 py-2 mb-2 text-[11px] text-[#21c063] font-medium bg-[#21c063]/10 rounded-lg animate-pulse">
                <Loader2 size={13} className="animate-spin" />
                <span>Searching GIPHY stickers online...</span>
              </div>
            )}

            {/* Online Results Indicator */}
            {hasOnlineResults && !isSearchingOnline && (
              <div className="flex items-center justify-between px-1.5 py-1 mb-2 text-[10.5px] border-b app-border text-secondary">
                <span className="flex items-center gap-1 text-[#21c063] font-medium">
                  <Globe size={11} /> Online Stickers
                </span>
                <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75">
                  Powered by GIPHY
                </span>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {/* Upload Custom Sticker Card */}
              <button
                type="button"
                onClick={() => customStickerInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-[#21c063]/40 hover:border-[#21c063] bg-[#21c063]/5 hover:bg-[#21c063]/10 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 text-[#21c063] cursor-pointer p-1"
                title="Upload image as sticker"
              >
                <div className="w-7 h-7 rounded-full bg-[#21c063]/15 flex items-center justify-center">
                  <Plus size={16} />
                </div>
                <span className="text-[10px] font-semibold text-center leading-tight">+ Sticker</span>
              </button>

              {visibleStickers.map(sticker => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => handleStickerClick(sticker)}
                  title={sticker.name}
                  className="aspect-square rounded-xl p-1.5 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer group relative"
                >
                  <img
                    src={sticker.dataUrl}
                    alt={sticker.name}
                    className="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-110 transition-transform duration-150"
                    loading="lazy"
                    onError={() => {
                      setHiddenStickerUrls(prev => {
                        const updated = new Set(prev);
                        updated.add(sticker.dataUrl);
                        return updated;
                      });
                    }}
                  />
                </button>
              ))}
            </div>

            {visibleStickers.length === 0 && !isSearchingOnline && (
              <div className="text-center py-8 text-secondary text-[12px]">
                No stickers found for "{searchTerm}"
              </div>
            )}
          </div>
        )}

      </div>

      {/* Persistent GIPHY Attribution & API Key Setup Bar */}
      {(mainTab === 'gifs' || mainTab === 'stickers') && (
        <div className="px-3 py-1.5 border-t app-border bg-[#f0f2f5]/90 dark:bg-[#182229]/90 flex items-center justify-between text-[10.5px] text-secondary">
          {giphyApiKey ? (
            <span className="flex items-center gap-1 text-[#21c063] font-medium">
              <Globe size={11} /> Live GIPHY Connected
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1 text-[#21c063] hover:underline cursor-pointer"
              title="Open Settings to add your GIPHY API Key"
            >
              <Sparkles size={11} />
              <span>Connect GIPHY in Settings</span>
            </button>
          )}

          <span className="text-[9px] uppercase tracking-wider font-semibold text-secondary/70">
            Powered by GIPHY
          </span>
        </div>
      )}
    </div>
  );
};
