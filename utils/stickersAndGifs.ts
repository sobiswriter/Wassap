// Curated high-performance Sticker and GIF collections for WhatsApp-grade in-app media tray
// Supports comprehensive offline built-in database & live GIPHY online search integration

export interface GifItem {
  id: string;
  name: string;
  category: 'trending' | 'reactions' | 'laughing' | 'love' | 'shocked' | 'dancing' | 'memes' | 'yesno';
  url: string;
  tags: string[];
  previewUrl?: string;
}

export interface StickerItem {
  id: string;
  name: string;
  pack: 'pepe' | 'cats' | '3d' | 'anime' | 'memes';
  dataUrl: string;
  tags: string[];
}

export const GIF_DATABASE: GifItem[] = [
  // --- TRENDING & CLASSICS ---
  {
    id: 'cat-vibing',
    name: 'Cat Vibing / Nodding',
    category: 'trending',
    url: 'https://i.giphy.com/GeimqsH0TLDt4tScGw.gif',
    tags: ['cat', 'vibing', 'nodding', 'music', 'headbob', 'dance', 'rhythm']
  },
  {
    id: 'popcorn-drama',
    name: 'Eating Popcorn / Drama',
    category: 'reactions',
    url: 'https://i.giphy.com/gl0mkIZOW6Nwc.gif',
    tags: ['popcorn', 'drama', 'watching', 'tea', 'spill', 'eating', 'show']
  },
  {
    id: 'mind-blown',
    name: 'Mind Blown Galaxy',
    category: 'shocked',
    url: 'https://i.giphy.com/26ufdipQqU2lhNA4g.gif',
    tags: ['mind', 'blown', 'galaxy', 'boom', 'shock', 'universe', 'explosion']
  },
  {
    id: 'leo-cheers',
    name: 'Leonardo DiCaprio Cheers',
    category: 'trending',
    url: 'https://i.giphy.com/QMkPpxPDYY0fu.gif',
    tags: ['leo', 'cheers', 'drink', 'great', 'gatsby', 'champagne', 'toast', 'celebrate']
  },
  {
    id: 'laughing-hard',
    name: 'Laughing Out Loud Haha',
    category: 'laughing',
    url: 'https://i.giphy.com/10JhviFuU2gWD6.gif',
    tags: ['laugh', 'lol', 'haha', 'lmao', 'funny', 'joke', 'rofl']
  },
  {
    id: 'dancing-baby',
    name: 'Dancing Baby Celebration',
    category: 'dancing',
    url: 'https://i.giphy.com/blSTtZehjAZ8I.gif',
    tags: ['baby', 'dance', 'happy', 'party', 'vibes', 'groove']
  },
  {
    id: 'homer-bushes',
    name: 'Homer Disappears in Bushes',
    category: 'reactions',
    url: 'https://i.giphy.com/jUwpNzg9IcyrK.gif',
    tags: ['homer', 'bushes', 'fade', 'awkward', 'exit', 'leave', 'simpsons', 'bye']
  },
  {
    id: 'cat-heart-eyes',
    name: 'Cat In Love Heart Eyes',
    category: 'love',
    url: 'https://i.giphy.com/Cnd2PddhqYBcA.gif',
    tags: ['cat', 'love', 'hearts', 'cute', 'adorable', 'sweet', 'crush']
  },
  {
    id: 'facepalm',
    name: 'Facepalm Captain Picard',
    category: 'reactions',
    url: 'https://i.giphy.com/3xz2BLBOt13X9AgjEA.gif',
    tags: ['facepalm', 'picard', 'smh', 'fail', 'star trek', 'disappointed', 'sigh']
  },
  {
    id: 'clapping-applause',
    name: 'Applause Clapping Bravo',
    category: 'trending',
    url: 'https://i.giphy.com/7rj2ZgttvgomY.gif',
    tags: ['applause', 'clapping', 'bravo', 'congrats', 'cheer', 'respect', 'great']
  },
  {
    id: 'spongebob-excited',
    name: 'SpongeBob Super Excited',
    category: 'trending',
    url: 'https://i.giphy.com/SKGo6OYe24EBG.gif',
    tags: ['spongebob', 'excited', 'yay', 'jumping', 'happy', 'ready', 'hype']
  },
  {
    id: 'success-kid',
    name: 'Success Kid Yes Win',
    category: 'trending',
    url: 'https://i.giphy.com/nXxOjZrbnbRxS.gif',
    tags: ['success', 'kid', 'yes', 'win', 'fist', 'accomplished', 'nailed it']
  },
  {
    id: 'this-is-fine',
    name: 'This Is Fine Dog Fire',
    category: 'memes',
    url: 'https://i.giphy.com/9M5jK4GXmD5o1irGrF.gif',
    tags: ['this is fine', 'fire', 'dog', 'chaos', 'stress', 'okay', 'panic', 'meme']
  },
  {
    id: 'roll-safe',
    name: 'Roll Safe Smart Brain',
    category: 'memes',
    url: 'https://i.giphy.com/d3mlE7uhX8KFgEmY.gif',
    tags: ['roll safe', 'think', 'smart', 'brain', 'clever', 'tap head', 'meme']
  },
  {
    id: 'drake-no-yes',
    name: 'Drake Hotline Bling',
    category: 'memes',
    url: 'https://i.giphy.com/nR4L10XlJcSeQ.gif',
    tags: ['drake', 'nah', 'no', 'dislike', 'reject', 'pass', 'hotline bling']
  },
  {
    id: 'spiderman-pointing',
    name: 'Spider-Man Pointing',
    category: 'memes',
    url: 'https://i.giphy.com/voOhKPgzYsyPu.gif',
    tags: ['spiderman', 'pointing', 'same', 'identical', 'clone', 'you', 'me']
  },
  {
    id: 'deal-with-it',
    name: 'Deal With It Glasses',
    category: 'memes',
    url: 'https://i.giphy.com/yCAoGdVUCW5LW.gif',
    tags: ['deal with it', 'glasses', 'shades', 'cool', 'boss', 'swag']
  },
  {
    id: 'rickroll',
    name: 'Rick Astley Dance',
    category: 'memes',
    url: 'https://i.giphy.com/Ju7l5y9osyymQ.gif',
    tags: ['rickroll', 'rick astley', 'never gonna give you up', 'classic', 'dance']
  },

  // --- REACTIONS & EXPRESSIONS ---
  {
    id: 'awkward-monkey',
    name: 'Awkward Puppet Monkey Glance',
    category: 'reactions',
    url: 'https://i.giphy.com/H5C8CevNMbpBqNqFjl.gif',
    tags: ['awkward', 'monkey', 'puppet', 'look away', 'guilty', 'nervous', 'oops']
  },
  {
    id: 'disappointed-fan',
    name: 'Disappointed Hands on Hips',
    category: 'reactions',
    url: 'https://i.giphy.com/7SF5scGB2AFrgsXP63.gif',
    tags: ['disappointed', 'cricket', 'fan', 'hands on hips', 'smh', 'why', 'unbelievable']
  },
  {
    id: 'confused-travolta',
    name: 'Confused John Travolta',
    category: 'reactions',
    url: 'https://i.giphy.com/g01ZnwAUvutuK8GIQn.gif',
    tags: ['travolta', 'confused', 'where', 'lost', 'what', 'pulp fiction', 'empty']
  },
  {
    id: 'crying-sad',
    name: 'Crying Sad Tears',
    category: 'reactions',
    url: 'https://i.giphy.com/d2lcHJTG5Tscg.gif',
    tags: ['cry', 'sad', 'tears', 'upset', 'weep', 'heartbroken', 'depressed']
  },
  {
    id: 'steve-carell-no',
    name: 'Michael Scott NO GOD PLEASE NO',
    category: 'reactions',
    url: 'https://i.giphy.com/vyTnNTrs3wqQ0UIvwE.gif',
    tags: ['no', 'michael scott', 'the office', 'refuse', 'horror', 'screaming', 'please no']
  },
  {
    id: 'robert-redford-nod',
    name: 'Robert Redford Nodding Approval',
    category: 'yesno',
    url: 'https://i.giphy.com/KffdTQfewxdbKTGEJY.gif',
    tags: ['nod', 'yes', 'approve', 'respect', 'good', 'agreement', 'proud']
  },
  {
    id: 'shrug-dunno',
    name: 'Shrug Dunno Who Knows',
    category: 'reactions',
    url: 'https://i.giphy.com/jPAdK8Nfzzwt2.gif',
    tags: ['shrug', 'dunno', 'idk', 'who knows', 'whatever', 'maybe']
  },
  {
    id: 'side-eye-dog',
    name: 'Side Eye Bombastic Look',
    category: 'reactions',
    url: 'https://i.giphy.com/3gNotAoIRZsb9UHPnj.gif',
    tags: ['side eye', 'suspicious', 'doubt', 'bombastic', 'glance', 'hmmm']
  },
  {
    id: 'bye-felicia',
    name: 'Bye Peace Out',
    category: 'reactions',
    url: 'https://i.giphy.com/SZioIIBxB7QRy.gif',
    tags: ['bye', 'goodbye', 'peace', 'exit', 'cya', 'leave', 'farewell']
  },
  {
    id: 'mic-drop',
    name: 'Mic Drop Boom Done',
    category: 'reactions',
    url: 'https://i.giphy.com/3o7qDSOvfaCO9b3MlO.gif',
    tags: ['mic drop', 'boom', 'done', 'won', 'finished', 'period']
  },

  // --- LAUGHING & COMEDY ---
  {
    id: 'minion-laugh',
    name: 'Minion Laughing Haha',
    category: 'laughing',
    url: 'https://i.giphy.com/3o85xIO33l7RlmLR4I.gif',
    tags: ['minion', 'laugh', 'giggle', 'haha', 'yellow', 'funny']
  },
  {
    id: 'pedro-pascal-laugh',
    name: 'Pedro Pascal Laughing & Crying',
    category: 'laughing',
    url: 'https://i.giphy.com/TydZAW0DVCbGE.gif',
    tags: ['pedro pascal', 'laugh', 'cry', 'emotional', 'hysterical', 'funny', 'crazy']
  },
  {
    id: 'ryan-gosling-giggle',
    name: 'Ryan Gosling Chuckle',
    category: 'laughing',
    url: 'https://i.giphy.com/A7Zc53i8U59SHv9CAm.gif',
    tags: ['ryan gosling', 'laugh', 'chuckle', 'smile', 'giggle', 'cute', 'amused']
  },
  {
    id: 'el-risitas-kekw',
    name: 'El Risitas Wheeze KEKW',
    category: 'laughing',
    url: 'https://i.giphy.com/kC8N6DPOkbqWTxkNTe.gif',
    tags: ['kekw', 'risitas', 'wheeze', 'laugh', 'spanish', 'hysterical', 'rofl']
  },
  {
    id: 'joker-laugh',
    name: 'Joker Laugh Dance',
    category: 'laughing',
    url: 'https://i.giphy.com/F0A48Q2wFjE7S.gif',
    tags: ['joker', 'laugh', 'dance', 'stairs', 'crazy', 'smile']
  },
  {
    id: 'baby-giggle',
    name: 'Cute Baby Giggle Laugh',
    category: 'laughing',
    url: 'https://i.giphy.com/GpyS1lJXJYupG.gif',
    tags: ['baby', 'giggle', 'cute', 'sweet', 'chuckle', 'adorable']
  },
  {
    id: 'muttley-wheeze',
    name: 'Muttley Dog Wheezing Laugh',
    category: 'laughing',
    url: 'https://i.giphy.com/3oEjHAUOqG3lSS0f1C.gif',
    tags: ['muttley', 'dog', 'wheeze', 'laugh', 'snicker', 'cartoon']
  },

  // --- LOVE & AFFECTION ---
  {
    id: 'anime-blush',
    name: 'Anime Blush Sparkle',
    category: 'love',
    url: 'https://i.giphy.com/eHpWHuEUxHIre.gif',
    tags: ['anime', 'blush', 'shy', 'cute', 'hearts', 'sparkle', 'uwu']
  },
  {
    id: 'sending-love-heart',
    name: 'Sending Big Heart Flying',
    category: 'love',
    url: 'https://i.giphy.com/M90mJvfWfd5mbUuULX.gif',
    tags: ['heart', 'love', 'sending', 'kiss', 'affection', 'warmth', 'flying']
  },
  {
    id: 'bear-hug',
    name: 'Warm Bear Hug',
    category: 'love',
    url: 'https://i.giphy.com/EvYHHSntaIl5m.gif',
    tags: ['hug', 'bear', 'cozy', 'squeeze', 'comfort', 'love', 'cuddle']
  },
  {
    id: 'puppy-eyes',
    name: 'Puppy Eyes Begging Please',
    category: 'love',
    url: 'https://i.giphy.com/BBi3jY2bub3X2.gif',
    tags: ['puppy', 'eyes', 'please', 'beg', 'cute', 'dog', 'pouting']
  },
  {
    id: 'bunny-kisses',
    name: 'Cute Bunny Blowing Kisses',
    category: 'love',
    url: 'https://i.giphy.com/MDJ9IbxxvDUQM.gif',
    tags: ['bunny', 'kiss', 'mwah', 'cute', 'kisses', 'love', 'sweet']
  },
  {
    id: 'heart-exploding',
    name: 'Heart Exploding Love Explosion',
    category: 'love',
    url: 'https://i.giphy.com/3o7TKoWXm3okO1kgHC.gif',
    tags: ['heart', 'explosion', 'love', 'burst', 'affection', 'sparkles']
  },

  // --- SHOCKED & SURPRISED ---
  {
    id: 'dramatic-shock',
    name: 'Dramatic Shock Gasp',
    category: 'shocked',
    url: 'https://i.giphy.com/3o72F8t9TDi2xVnxOE.gif',
    tags: ['gasp', 'shock', 'omg', 'what', 'unbelievable', 'surprised']
  },
  {
    id: 'dramatic-cat',
    name: 'Dramatic Cat Stare',
    category: 'shocked',
    url: 'https://i.giphy.com/l0MYt5jPR6QX5pnqM.gif',
    tags: ['cat', 'stare', 'dramatic', 'shock', 'eyes', 'realization']
  },
  {
    id: 'shocked-pikachu',
    name: 'Shocked Pikachu Face',
    category: 'shocked',
    url: 'https://i.giphy.com/5VKbvrjxpVJCM.gif',
    tags: ['pikachu', 'pokemon', 'shocked', 'surprised', 'mouth open', 'meme']
  },
  {
    id: 'chris-pratt-wow',
    name: 'Andy Dwyer Wow Shock',
    category: 'shocked',
    url: 'https://i.giphy.com/5VKbvrjxpVJCM.gif',
    tags: ['chris pratt', 'parks and rec', 'wow', 'excited', 'jaw drop', 'shock']
  },
  {
    id: 'steve-harvey-shock',
    name: 'Steve Harvey Disbelief Stare',
    category: 'shocked',
    url: 'https://i.giphy.com/ghuvaCOI6GOoTX0RmH.gif',
    tags: ['steve harvey', 'family feud', 'disbelief', 'speechless', 'stare', 'stunned']
  },
  {
    id: 'eyes-popping-out',
    name: 'Cartoon Eyes Popping Out',
    category: 'shocked',
    url: 'https://i.giphy.com/26gspipWnu59srmM0.gif',
    tags: ['eyes popping', 'jaw drop', 'cartoon', 'stunned', 'hot', 'shocked']
  },

  // --- DANCING & CELEBRATION ---
  {
    id: 'dancing-parrot',
    name: 'Dancing Party Parrot',
    category: 'dancing',
    url: 'https://i.giphy.com/13GIgrGdslD9oQ.gif',
    tags: ['parrot', 'party', 'rave', 'fast', 'groove', 'bird', 'disco']
  },
  {
    id: 'snoopy-dance',
    name: 'Snoopy Happy Dance',
    category: 'dancing',
    url: 'https://i.giphy.com/j3gsT2RsH9K0w.gif',
    tags: ['snoopy', 'dance', 'happy', 'peanuts', 'spin', 'joy', 'celebrate']
  },
  {
    id: 'carlton-dance',
    name: 'Carlton Dance Fresh Prince',
    category: 'dancing',
    url: 'https://i.giphy.com/WmkqburJqXziM.gif',
    tags: ['carlton', 'dance', 'fresh prince', 'groove', 'classic', 'happy']
  },
  {
    id: 'crab-rave',
    name: 'Crab Rave Island Dance',
    category: 'dancing',
    url: 'https://i.giphy.com/L9AqjFr6H4iaY.gif',
    tags: ['crab rave', 'dance', 'beach', 'music', 'bop', 'celebrate']
  },
  {
    id: 'happy-dog-dance',
    name: 'Happy Golden Dog Dancing',
    category: 'dancing',
    url: 'https://i.giphy.com/mCRJDo24UvJMA.gif',
    tags: ['dog', 'dance', 'tippy taps', 'golden retriever', 'cute', 'excited']
  },
  {
    id: 'champagne-pop',
    name: 'Champagne Pop Celebrate',
    category: 'dancing',
    url: 'https://i.giphy.com/g9582DNuQppxC.gif',
    tags: ['champagne', 'celebrate', 'cheers', 'win', 'party', 'pop', 'sparkle']
  },

  // --- YES & NO ---
  {
    id: 'terminator-thumbs-up',
    name: 'Terminator Lava Thumbs Up',
    category: 'yesno',
    url: 'https://i.giphy.com/7TtvTUMm9mp20.gif',
    tags: ['thumbs up', 'terminator', 'yes', 'good', 'sacrifice', 'ok', 'legend']
  },
  {
    id: 'absolute-cinema',
    name: 'Absolute Cinema Hands Up',
    category: 'yesno',
    url: 'https://i.giphy.com/VIPfTy8y1Lc5iREYDS.gif',
    tags: ['absolute cinema', 'cinema', 'writing', 'fire', 'peak', 'masterpiece', 'yes']
  },
  {
    id: 'head-shake-no',
    name: 'Head Shake Disapproval No',
    category: 'yesno',
    url: 'https://i.giphy.com/15aGGXfSlat2dP6ohs.gif',
    tags: ['no', 'nope', 'refuse', 'head shake', 'disagree', 'denied']
  }
];

// Helper to encode SVG into safe data URI
const encodeSvg = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export const STICKER_DATABASE: StickerItem[] = [
  // --- PEPE & MEMES ---
  {
    id: 'pepe-feels-good',
    name: 'Pepe Feels Good',
    pack: 'pepe',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <radialGradient id="pg" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#80cc38"/>
            <stop offset="100%" stop-color="#4d8c1e"/>
          </radialGradient>
        </defs>
        <path d="M 20 60 C 20 25, 100 25, 100 60 C 100 95, 20 95, 20 60 Z" fill="url(#pg)" stroke="#2d5910" stroke-width="3"/>
        <ellipse cx="42" cy="40" rx="16" ry="14" fill="#ffffff" stroke="#2d5910" stroke-width="3"/>
        <ellipse cx="44" cy="40" rx="6" ry="8" fill="#111111"/>
        <ellipse cx="78" cy="40" rx="16" ry="14" fill="#ffffff" stroke="#2d5910" stroke-width="3"/>
        <ellipse cx="80" cy="40" rx="6" ry="8" fill="#111111"/>
        <path d="M 28 34 Q 42 28 56 34" fill="none" stroke="#2d5910" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M 64 34 Q 78 28 92 34" fill="none" stroke="#2d5910" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M 22 66 Q 60 92 98 66 Q 60 76 22 66 Z" fill="#b84535" stroke="#2d5910" stroke-width="3"/>
        <path d="M 24 66 Q 60 72 96 66" fill="none" stroke="#781d12" stroke-width="2"/>
      </svg>
    `),
    tags: ['pepe', 'feels good', 'frog', 'meme', 'satisfied', 'happy']
  },
  {
    id: 'pepe-cry',
    name: 'Pepe Sad Cry',
    pack: 'pepe',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <radialGradient id="pc" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#72b535"/>
            <stop offset="100%" stop-color="#3f7318"/>
          </radialGradient>
        </defs>
        <path d="M 20 60 C 20 25, 100 25, 100 60 C 100 95, 20 95, 20 60 Z" fill="url(#pc)" stroke="#24470c" stroke-width="3"/>
        <path d="M 28 30 Q 42 42 56 36" fill="none" stroke="#24470c" stroke-width="4" stroke-linecap="round"/>
        <path d="M 92 30 Q 78 42 64 36" fill="none" stroke="#24470c" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="42" cy="44" rx="14" ry="12" fill="#e8f4fc" stroke="#24470c" stroke-width="2.5"/>
        <ellipse cx="78" cy="44" rx="14" ry="12" fill="#e8f4fc" stroke="#24470c" stroke-width="2.5"/>
        <circle cx="43" cy="46" r="6" fill="#182c0b"/>
        <circle cx="77" cy="46" r="6" fill="#182c0b"/>
        <path d="M 40 56 C 36 62, 44 68, 40 74 C 36 68, 44 62, 40 56 Z" fill="#38a8e8"/>
        <path d="M 76 56 C 72 62, 80 68, 76 74 C 72 68, 80 62, 76 56 Z" fill="#38a8e8"/>
        <path d="M 26 78 Q 60 62 94 78 Q 60 70 26 78 Z" fill="#9e392b" stroke="#24470c" stroke-width="3"/>
      </svg>
    `),
    tags: ['pepe', 'sad', 'cry', 'frog', 'tears', 'alone']
  },
  {
    id: 'pepe-love',
    name: 'Pepe In Love',
    pack: 'pepe',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <path d="M 20 60 C 20 25, 100 25, 100 60 C 100 95, 20 95, 20 60 Z" fill="#68bf36" stroke="#24470c" stroke-width="3"/>
        <path d="M 42 34 C 42 28, 32 28, 32 36 C 32 46, 42 52, 42 54 C 42 52, 52 46, 52 36 C 52 28, 42 28, 42 34 Z" fill="#ff2e55" stroke="#990022" stroke-width="1.5"/>
        <path d="M 78 34 C 78 28, 68 28, 68 36 C 68 46, 78 52, 78 54 C 78 52, 88 46, 88 36 C 88 28, 78 28, 78 34 Z" fill="#ff2e55" stroke="#990022" stroke-width="1.5"/>
        <ellipse cx="28" cy="56" rx="8" ry="5" fill="#ff708d" opacity="0.6"/>
        <ellipse cx="92" cy="56" rx="8" ry="5" fill="#ff708d" opacity="0.6"/>
        <path d="M 26 68 Q 60 88 94 68" fill="none" stroke="#24470c" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M 60 76 C 60 66, 42 66, 42 80 C 42 94, 60 106, 60 110 C 60 106, 78 94, 78 80 C 78 66, 60 66, 60 76 Z" fill="#ff1744" stroke="#ffffff" stroke-width="2.5"/>
      </svg>
    `),
    tags: ['pepe', 'love', 'heart', 'hug', 'kiss', 'crush']
  },
  {
    id: 'pepe-sweat',
    name: 'Pepe MonkaS Sweat',
    pack: 'pepe',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <path d="M 20 60 C 20 25, 100 25, 100 60 C 100 95, 20 95, 20 60 Z" fill="#60ad2b" stroke="#24470c" stroke-width="3"/>
        <ellipse cx="40" cy="42" rx="18" ry="16" fill="#ffffff" stroke="#24470c" stroke-width="3"/>
        <circle cx="44" cy="42" r="7" fill="#000000"/>
        <ellipse cx="80" cy="42" rx="18" ry="16" fill="#ffffff" stroke="#24470c" stroke-width="3"/>
        <circle cx="76" cy="42" r="7" fill="#000000"/>
        <!-- Giant sweat drop -->
        <path d="M 98 32 C 92 40, 104 46, 98 54 C 92 46, 104 40, 98 32 Z" fill="#00b0ff" stroke="#0077c2" stroke-width="1.5"/>
        <path d="M 30 74 Q 60 66 90 74" fill="none" stroke="#24470c" stroke-width="3.5" stroke-linecap="round"/>
      </svg>
    `),
    tags: ['pepe', 'monkas', 'sweat', 'nervous', 'scared', 'panic', 'stress']
  },
  {
    id: 'pepe-coffee',
    name: 'Pepe Cozy Coffee',
    pack: 'pepe',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <path d="M 20 54 C 20 20, 100 20, 100 54 C 100 88, 20 88, 20 54 Z" fill="#75ba38" stroke="#24470c" stroke-width="3"/>
        <ellipse cx="42" cy="38" rx="12" ry="10" fill="#ffffff" stroke="#24470c" stroke-width="2"/>
        <circle cx="44" cy="38" r="4" fill="#111"/>
        <ellipse cx="78" cy="38" rx="12" ry="10" fill="#ffffff" stroke="#24470c" stroke-width="2"/>
        <circle cx="76" cy="38" r="4" fill="#111"/>
        <!-- Coffee Mug -->
        <rect x="44" y="68" width="32" height="36" rx="6" fill="#ff5252" stroke="#b71c1c" stroke-width="2.5"/>
        <path d="M 76 76 C 88 76, 88 92, 76 92" fill="none" stroke="#b71c1c" stroke-width="3"/>
        <text x="60" y="90" font-family="Arial, sans-serif" font-weight="bold" font-size="12" fill="#fff" text-anchor="middle">☕</text>
      </svg>
    `),
    tags: ['pepe', 'coffee', 'morning', 'tea', 'relax', 'cozy', 'sip']
  },

  // --- CUTE CATS ---
  {
    id: 'bongo-cat',
    name: 'Bongo Cat',
    pack: 'cats',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <path d="M 30 75 C 30 35, 90 35, 90 75 Z" fill="#ffffff" stroke="#1f2c34" stroke-width="3.5"/>
        <polygon points="36,46 32,24 50,38" fill="#ffffff" stroke="#1f2c34" stroke-width="3.5"/>
        <polygon points="36,44 34,28 48,38" fill="#ffb4c8"/>
        <polygon points="84,46 88,24 70,38" fill="#ffffff" stroke="#1f2c34" stroke-width="3.5"/>
        <polygon points="84,44 86,28 72,38" fill="#ffb4c8"/>
        <path d="M 42 54 Q 48 48 54 54" fill="none" stroke="#1f2c34" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M 66 54 Q 72 48 78 54" fill="none" stroke="#1f2c34" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M 54 62 Q 60 67 60 62 Q 60 67 66 62" fill="none" stroke="#1f2c34" stroke-width="2.5" stroke-linecap="round"/>
        <rect x="12" y="76" width="96" height="34" rx="6" fill="#ebaa6a" stroke="#1f2c34" stroke-width="3"/>
        <ellipse cx="38" cy="74" rx="10" ry="7" fill="#ffffff" stroke="#1f2c34" stroke-width="3"/>
        <ellipse cx="82" cy="74" rx="10" ry="7" fill="#ffffff" stroke="#1f2c34" stroke-width="3"/>
        <path d="M 38 62 L 38 56" stroke="#21c063" stroke-width="3" stroke-linecap="round"/>
        <path d="M 82 62 L 82 56" stroke="#21c063" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `),
    tags: ['bongo', 'cat', 'kitten', 'drums', 'cute', 'music', 'bop']
  },
  {
    id: 'cat-heart',
    name: 'Fluffy Cat Heart',
    pack: 'cats',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="62" r="38" fill="#fffaf2" stroke="#202c33" stroke-width="3"/>
        <polygon points="32,40 24,18 48,32" fill="#fffaf2" stroke="#202c33" stroke-width="3"/>
        <polygon points="32,38 27,24 44,32" fill="#ffa1b8"/>
        <polygon points="88,40 96,18 72,32" fill="#fffaf2" stroke="#202c33" stroke-width="3"/>
        <polygon points="88,38 93,24 76,32" fill="#ffa1b8"/>
        <path d="M 44 54 C 44 48, 34 48, 34 56 C 34 66, 44 72, 44 74 C 44 72, 54 66, 54 56 C 54 48, 44 48, 44 54 Z" fill="#ff1744"/>
        <path d="M 76 54 C 76 48, 66 48, 66 56 C 66 66, 76 72, 76 74 C 76 72, 86 66, 86 56 C 86 48, 76 48, 76 54 Z" fill="#ff1744"/>
        <polygon points="57,75 63,75 60,79" fill="#ffa1b8"/>
        <path d="M 54 81 Q 60 85 60 81 Q 60 85 66 81" fill="none" stroke="#202c33" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse cx="30" cy="74" rx="7" ry="4" fill="#ff8aa5" opacity="0.6"/>
        <ellipse cx="90" cy="74" rx="7" ry="4" fill="#ff8aa5" opacity="0.6"/>
      </svg>
    `),
    tags: ['cat', 'heart', 'love', 'blush', 'cute', 'kawaii']
  },
  {
    id: 'cat-loading',
    name: 'Cat Thinking Loading',
    pack: 'cats',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="68" r="36" fill="#f0f2f5" stroke="#1f2c34" stroke-width="3"/>
        <polygon points="34,46 26,24 50,38" fill="#f0f2f5" stroke="#1f2c34" stroke-width="3"/>
        <polygon points="86,46 94,24 70,38" fill="#f0f2f5" stroke="#1f2c34" stroke-width="3"/>
        <circle cx="46" cy="64" r="8" fill="#ffffff" stroke="#1f2c34" stroke-width="2"/>
        <circle cx="44" cy="64" r="3" fill="#1f2c34"/>
        <circle cx="74" cy="64" r="8" fill="#ffffff" stroke="#1f2c34" stroke-width="2"/>
        <circle cx="76" cy="64" r="3" fill="#1f2c34"/>
        <ellipse cx="60" cy="80" rx="4" ry="5" fill="#1f2c34"/>
        <circle cx="60" cy="22" r="14" fill="none" stroke="#21c063" stroke-width="4" stroke-dasharray="24 16" stroke-linecap="round"/>
      </svg>
    `),
    tags: ['cat', 'loading', 'buffering', 'thinking', 'derp', 'blank']
  },
  {
    id: 'cat-paw-highfive',
    name: 'Cat Paw High Five',
    pack: 'cats',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <!-- Paw Pad Base -->
        <ellipse cx="60" cy="74" rx="28" ry="24" fill="#ffffff" stroke="#202c33" stroke-width="3"/>
        <ellipse cx="60" cy="76" rx="16" ry="13" fill="#ff80ab"/>
        <!-- 4 Toe Beans -->
        <circle cx="36" cy="44" r="10" fill="#ffffff" stroke="#202c33" stroke-width="2.5"/>
        <circle cx="36" cy="44" r="6" fill="#ff80ab"/>
        <circle cx="52" cy="34" r="11" fill="#ffffff" stroke="#202c33" stroke-width="2.5"/>
        <circle cx="52" cy="34" r="7" fill="#ff80ab"/>
        <circle cx="68" cy="34" r="11" fill="#ffffff" stroke="#202c33" stroke-width="2.5"/>
        <circle cx="68" cy="34" r="7" fill="#ff80ab"/>
        <circle cx="84" cy="44" r="10" fill="#ffffff" stroke="#202c33" stroke-width="2.5"/>
        <circle cx="84" cy="44" r="6" fill="#ff80ab"/>
        <!-- Sparkle Lines -->
        <line x1="16" y1="28" x2="26" y2="34" stroke="#ffca28" stroke-width="3" stroke-linecap="round"/>
        <line x1="104" y1="28" x2="94" y2="34" stroke="#ffca28" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `),
    tags: ['cat', 'paw', 'beans', 'toe beans', 'high five', 'cute', 'pink']
  },

  // --- 3D EXPRESSIONS ---
  {
    id: '3d-mind-blown',
    name: '3D Mind Blown',
    pack: '3d',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <radialGradient id="egg" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#fff59d"/>
            <stop offset="60%" stop-color="#fbc02d"/>
            <stop offset="100%" stop-color="#f57f17"/>
          </radialGradient>
        </defs>
        <path d="M 28 32 C 16 20, 40 4, 60 8 C 80 4, 104 20, 92 32 C 104 42, 86 52, 76 46 L 44 46 C 34 52, 16 42, 28 32 Z" fill="#ff7043" stroke="#d84315" stroke-width="2.5"/>
        <circle cx="42" cy="20" r="10" fill="#ffa726"/>
        <circle cx="76" cy="18" r="9" fill="#ffca28"/>
        <circle cx="60" cy="16" r="12" fill="#ffeb3b"/>
        <circle cx="60" cy="68" r="38" fill="url(#egg)" stroke="#e65100" stroke-width="3"/>
        <circle cx="44" cy="64" r="9" fill="#ffffff" stroke="#bf360c" stroke-width="2"/>
        <circle cx="44" cy="64" r="4" fill="#212121"/>
        <circle cx="76" cy="64" r="9" fill="#ffffff" stroke="#bf360c" stroke-width="2"/>
        <circle cx="76" cy="64" r="4" fill="#212121"/>
        <ellipse cx="60" cy="88" rx="12" ry="10" fill="#212121"/>
        <ellipse cx="60" cy="91" rx="8" ry="4" fill="#b71c1c"/>
      </svg>
    `),
    tags: ['mind blown', 'shock', 'explosion', 'wow', '3d', 'epic']
  },
  {
    id: '3d-laugh-tears',
    name: '3D Laughing Tears',
    pack: '3d',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <radialGradient id="lg" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#fff176"/>
            <stop offset="70%" stop-color="#fbc02d"/>
            <stop offset="100%" stop-color="#f57f17"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="46" fill="url(#lg)" stroke="#e65100" stroke-width="3"/>
        <path d="M 28 48 L 44 56 L 28 64" fill="none" stroke="#6d4c41" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 92 48 L 76 56 L 92 64" fill="none" stroke="#6d4c41" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 32 66 Q 60 112 88 66 Z" fill="#3e2723" stroke="#d84315" stroke-width="3"/>
        <path d="M 44 88 Q 60 78 76 88 Q 60 106 44 88 Z" fill="#e53935"/>
        <path d="M 14 56 C 14 42, 28 42, 28 56 C 28 66, 14 74, 14 74 C 14 74, 0 66, 0 56 Z" fill="#29b6f6" stroke="#0288d1" stroke-width="2" transform="rotate(-25 14 56)"/>
        <path d="M 106 56 C 106 42, 120 42, 120 56 C 120 66, 106 74, 106 74 C 106 74, 92 66, 92 56 Z" fill="#29b6f6" stroke="#0288d1" stroke-width="2" transform="rotate(25 106 56)"/>
      </svg>
    `),
    tags: ['laugh', 'tears', 'crying laugh', 'rofl', 'haha', 'funny', '3d']
  },
  {
    id: '3d-fire-100',
    name: '3D Lit Flame 100',
    pack: '3d',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id="flm" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#d50000"/>
            <stop offset="50%" stop-color="#ff6d00"/>
            <stop offset="100%" stop-color="#ffd600"/>
          </linearGradient>
        </defs>
        <path d="M 60 6 C 66 26, 84 34, 84 50 C 84 56, 80 62, 74 62 C 86 70, 96 82, 96 96 C 96 114, 78 120, 60 120 C 42 120, 24 114, 24 96 C 24 80, 36 68, 44 58 C 44 48, 38 42, 38 34 C 38 24, 52 14, 60 6 Z" fill="url(#flm)"/>
        <path d="M 60 48 C 66 60, 76 68, 76 80 C 76 96, 68 106, 60 106 C 52 106, 44 96, 44 80 C 44 70, 52 64, 60 48 Z" fill="#fff9c4"/>
        <text x="60" y="96" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="28" fill="#d50000" text-anchor="middle" stroke="#ffffff" stroke-width="1.5">100</text>
        <line x1="34" y1="102" x2="86" y2="102" stroke="#d50000" stroke-width="4" stroke-linecap="round"/>
        <line x1="34" y1="108" x2="86" y2="108" stroke="#d50000" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `),
    tags: ['fire', 'flame', 'lit', '100', 'hot', 'slay', 'hype']
  },
  {
    id: '3d-party-popper',
    name: '3D Party Popper',
    pack: '3d',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <!-- Cone -->
        <polygon points="20,100 48,36 94,82" fill="#ffd600" stroke="#f57f17" stroke-width="3"/>
        <polygon points="20,100 38,58 72,92" fill="#ff6d00"/>
        <!-- Confetti bursts -->
        <circle cx="80" cy="30" r="6" fill="#00e676"/>
        <circle cx="98" cy="46" r="5" fill="#d500f9"/>
        <circle cx="64" cy="18" r="7" fill="#ff1744"/>
        <circle cx="106" cy="22" r="5" fill="#2979ff"/>
        <!-- Streamers -->
        <path d="M 52 32 Q 62 12 78 22" fill="none" stroke="#ff1744" stroke-width="4" stroke-linecap="round"/>
        <path d="M 72 44 Q 92 24 104 38" fill="none" stroke="#2979ff" stroke-width="3.5" stroke-linecap="round"/>
      </svg>
    `),
    tags: ['party', 'popper', 'celebrate', 'birthday', 'congrats', 'cheers', 'yay']
  },

  // --- ANIME & CHIBI ---
  {
    id: 'anya-heh',
    name: 'Anya Heh Smug',
    pack: 'anime',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <path d="M 20 60 C 14 20, 106 20, 100 60 C 104 90, 80 110, 60 110 C 40 110, 16 90, 20 60 Z" fill="#ff80ab"/>
        <polygon points="24,34 34,16 42,32" fill="#ffd54f" stroke="#212121" stroke-width="2"/>
        <polygon points="96,34 86,16 78,32" fill="#ffd54f" stroke="#212121" stroke-width="2"/>
        <ellipse cx="60" cy="66" rx="34" ry="30" fill="#fff8e1" stroke="#212121" stroke-width="2.5"/>
        <path d="M 38 60 Q 48 56 52 62 Q 44 64 38 60 Z" fill="#2e7d32" stroke="#212121" stroke-width="2"/>
        <path d="M 82 60 Q 72 56 68 62 Q 76 64 82 60 Z" fill="#2e7d32" stroke="#212121" stroke-width="2"/>
        <path d="M 46 76 Q 60 86 74 74" fill="none" stroke="#212121" stroke-width="3" stroke-linecap="round"/>
        <line x1="34" y1="72" x2="42" y2="70" stroke="#f06292" stroke-width="2"/>
        <line x1="34" y1="75" x2="42" y2="73" stroke="#f06292" stroke-width="2"/>
        <line x1="78" y1="70" x2="86" y2="72" stroke="#f06292" stroke-width="2"/>
        <line x1="78" y1="73" x2="86" y2="75" stroke="#f06292" stroke-width="2"/>
        <text x="60" y="104" font-family="Comic Sans MS, sans-serif" font-weight="bold" font-size="16" fill="#880e4f" text-anchor="middle">heh</text>
      </svg>
    `),
    tags: ['anya', 'heh', 'smug', 'anime', 'spy x family', 'funny', 'chibi']
  },
  {
    id: 'chibi-wave',
    name: 'Chibi Wave Hello',
    pack: 'anime',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="56" r="38" fill="#5c6bc0" stroke="#1a237e" stroke-width="2.5"/>
        <circle cx="60" cy="62" r="32" fill="#fff9c4" stroke="#1a237e" stroke-width="2.5"/>
        <ellipse cx="46" cy="60" rx="7" ry="10" fill="#283593"/>
        <circle cx="48" cy="56" r="3.5" fill="#ffffff"/>
        <circle cx="44" cy="64" r="1.5" fill="#ffffff"/>
        <ellipse cx="74" cy="60" rx="7" ry="10" fill="#283593"/>
        <circle cx="76" cy="56" r="3.5" fill="#ffffff"/>
        <circle cx="72" cy="64" r="1.5" fill="#ffffff"/>
        <path d="M 55 74 Q 60 78 65 74" fill="none" stroke="#d81b60" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse cx="36" cy="68" rx="6" ry="4" fill="#ff80ab" opacity="0.6"/>
        <ellipse cx="84" cy="68" rx="6" ry="4" fill="#ff80ab" opacity="0.6"/>
        <circle cx="98" cy="46" r="9" fill="#fff9c4" stroke="#1a237e" stroke-width="2"/>
        <path d="M 104 38 L 108 34" stroke="#ffd600" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M 108 44 L 114 44" stroke="#ffd600" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `),
    tags: ['chibi', 'anime', 'wave', 'hello', 'hi', 'cute', 'kawaii']
  },

  // --- CLASSIC MEMES ---
  {
    id: 'doge-wow',
    name: 'Doge Much Wow',
    pack: 'memes',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="60" r="44" fill="#e8a848" stroke="#8c5812" stroke-width="3"/>
        <polygon points="26,30 40,8 52,26" fill="#ba7c27" stroke="#8c5812" stroke-width="2.5"/>
        <polygon points="94,30 80,8 68,26" fill="#ba7c27" stroke="#8c5812" stroke-width="2.5"/>
        <ellipse cx="60" cy="72" rx="28" ry="20" fill="#fff5e3"/>
        <ellipse cx="60" cy="62" rx="7" ry="5" fill="#241604"/>
        <path d="M 60 67 L 60 74 Q 52 78 48 74" fill="none" stroke="#241604" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M 60 74 Q 68 78 72 74" fill="none" stroke="#241604" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse cx="44" cy="50" rx="6" ry="7" fill="#1a1103"/>
        <circle cx="46" cy="48" r="2" fill="#ffffff"/>
        <ellipse cx="76" cy="50" rx="6" ry="7" fill="#1a1103"/>
        <circle cx="78" cy="48" r="2" fill="#ffffff"/>
        <text x="12" y="32" font-family="Comic Sans MS, cursive, sans-serif" font-weight="bold" font-size="13" fill="#e024c3">wow</text>
        <text x="82" y="86" font-family="Comic Sans MS, cursive, sans-serif" font-weight="bold" font-size="12" fill="#15a6e8">so text</text>
      </svg>
    `),
    tags: ['doge', 'shiba', 'dog', 'wow', 'meme', 'coin']
  },
  {
    id: 'stonks-up',
    name: 'Stonks Going Up',
    pack: 'memes',
    dataUrl: encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <!-- Stock Graph Grid Background -->
        <rect x="10" y="10" width="100" height="100" rx="8" fill="#111b21" stroke="#202c33" stroke-width="2"/>
        <line x1="10" y1="40" x2="110" y2="40" stroke="#233138" stroke-width="1"/>
        <line x1="10" y1="70" x2="110" y2="70" stroke="#233138" stroke-width="1"/>
        <!-- Rising Orange Arrow -->
        <path d="M 18 92 L 48 72 L 72 82 L 100 24" fill="none" stroke="#ff5722" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <polygon points="100,24 86,28 96,38" fill="#ff5722"/>
        <!-- STONKS Text -->
        <text x="60" y="102" font-family="Impact, Arial Black, sans-serif" font-size="16" fill="#00e676" text-anchor="middle" letter-spacing="1">STONKS ↗</text>
      </svg>
    `),
    tags: ['stonks', 'stocks', 'win', 'up', 'finance', 'meme', 'rich']
  }
];

/**
 * Searches online GIFs using the GIPHY API endpoint.
 * Fallback to local database if network or key is unavailable.
 */
export async function searchGifsOnline(query: string, apiKey?: string): Promise<{ ok: boolean; results: GifItem[]; isOnline?: boolean; error?: string }> {
  const cleanQ = query.trim();

  // Try server proxy first
  try {
    const url = `/api/giphy/search?type=gifs&q=${encodeURIComponent(cleanQ)}&apiKey=${encodeURIComponent(apiKey || '')}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
        return { ok: true, results: data.data, isOnline: true };
      }
    }
  } catch (e) {
    // Silent proxy fallback
  }

  // If user provided a direct client apiKey, try calling Giphy directly from browser
  if (apiKey && apiKey.trim()) {
    try {
      const directUrl = cleanQ
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey.trim())}&q=${encodeURIComponent(cleanQ)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(apiKey.trim())}&limit=24&rating=g`;
      
      const res = await fetch(directUrl);
      if (res.ok) {
        const json = await res.json();
        const items: GifItem[] = (json.data || []).map((item: any) => ({
          id: item.id,
          name: item.title?.replace(/ GIF$/i, '').trim() || 'GIF',
          category: 'trending',
          url: item.images?.fixed_height?.url || item.images?.original?.url || item.images?.downsized?.url || item.url,
          previewUrl: item.images?.fixed_height_small?.url || item.images?.fixed_height?.url,
          tags: [item.title || 'giphy'],
        }));
        if (items.length > 0) {
          return { ok: true, results: items, isOnline: true };
        }
      }
    } catch (e) {
      // Direct API fetch failed
    }
  }

  // Fallback to local database fuzzy filter
  const lower = cleanQ.toLowerCase();
  const localMatches = GIF_DATABASE.filter(g => 
    !lower || 
    g.name.toLowerCase().includes(lower) || 
    g.tags.some(t => t.toLowerCase().includes(lower))
  );

  return { ok: true, results: localMatches, isOnline: false };
}

/**
 * Searches online stickers using the GIPHY Stickers API endpoint.
 * Fallback to local sticker database if network or key is unavailable.
 */
export async function searchStickersOnline(query: string, apiKey?: string): Promise<{ ok: boolean; results: StickerItem[]; isOnline?: boolean; error?: string }> {
  const cleanQ = query.trim();

  // Try server proxy first
  try {
    const url = `/api/giphy/search?type=stickers&q=${encodeURIComponent(cleanQ)}&apiKey=${encodeURIComponent(apiKey || '')}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
        const stickers: StickerItem[] = data.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          pack: 'memes',
          dataUrl: item.url,
          tags: item.tags || [],
        }));
        return { ok: true, results: stickers, isOnline: true };
      }
    }
  } catch (e) {
    // Silent proxy fallback
  }

  // If user provided a direct client apiKey, try calling Giphy Stickers directly from browser
  if (apiKey && apiKey.trim()) {
    try {
      const directUrl = cleanQ
        ? `https://api.giphy.com/v1/stickers/search?api_key=${encodeURIComponent(apiKey.trim())}&q=${encodeURIComponent(cleanQ)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/stickers/trending?api_key=${encodeURIComponent(apiKey.trim())}&limit=24&rating=g`;

      const res = await fetch(directUrl);
      if (res.ok) {
        const json = await res.json();
        const stickers: StickerItem[] = (json.data || []).map((item: any) => ({
          id: item.id,
          name: item.title?.replace(/ Sticker$/i, '').trim() || 'Sticker',
          pack: 'memes',
          dataUrl: item.images?.fixed_height?.url || item.images?.original?.url || item.url,
          tags: [item.title || 'sticker'],
        }));
        if (stickers.length > 0) {
          return { ok: true, results: stickers, isOnline: true };
        }
      }
    } catch (e) {
      // Direct API fetch failed
    }
  }

  // Fallback to local database fuzzy filter
  const lower = cleanQ.toLowerCase();
  const localMatches = STICKER_DATABASE.filter(s => 
    !lower || 
    s.name.toLowerCase().includes(lower) || 
    s.tags.some(t => t.toLowerCase().includes(lower))
  );

  return { ok: true, results: localMatches, isOnline: false };
}
