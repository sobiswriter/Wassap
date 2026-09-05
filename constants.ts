
import { Chat, PersonaTemplate, PersonaVoiceSettings } from './types';

export interface VoiceDetail {
  name: string;
  gender: 'female' | 'male';
  trait: string;
  stylePrompt: string;
}

export const GEMINI_TTS_VOICE_DETAILS: Record<string, VoiceDetail> = {
  // Female Voices (14)
  Achernar: { name: 'Achernar', gender: 'female', trait: 'Crisp & Articulate', stylePrompt: 'crisp, clear, and articulate' },
  Aoede: { name: 'Aoede', gender: 'female', trait: 'Breezy & Natural', stylePrompt: 'breezy, relaxed, and natural' },
  Autonoe: { name: 'Autonoe', gender: 'female', trait: 'Assertive & Expressive', stylePrompt: 'assertive, lively, and expressive' },
  Callirrhoe: { name: 'Callirrhoe', gender: 'female', trait: 'Playful & Melodic', stylePrompt: 'playful, melodic, and cheerful' },
  Despina: { name: 'Despina', gender: 'female', trait: 'Gentle & Smooth', stylePrompt: 'gentle, sweet, and smooth' },
  Erinome: { name: 'Erinome', gender: 'female', trait: 'Soft & Relaxed', stylePrompt: 'soft, warm, and relaxed' },
  Gacrux: { name: 'Gacrux', gender: 'female', trait: 'Mature & Measured', stylePrompt: 'mature, composed, and measured' },
  Kore: { name: 'Kore', gender: 'female', trait: 'Firm & Confident', stylePrompt: 'firm, strong, and confident' },
  Laomedeia: { name: 'Laomedeia', gender: 'female', trait: 'Friendly & Engaging', stylePrompt: 'friendly, upbeat, and engaging' },
  Leda: { name: 'Leda', gender: 'female', trait: 'Youthful & Warm', stylePrompt: 'youthful, caring, and warm' },
  Pulcherrima: { name: 'Pulcherrima', gender: 'female', trait: 'Lively & Dynamic', stylePrompt: 'lively, animated, and dynamic' },
  Sulafat: { name: 'Sulafat', gender: 'female', trait: 'Calm & Poised', stylePrompt: 'calm, elegant, and poised' },
  Vindemiatrix: { name: 'Vindemiatrix', gender: 'female', trait: 'Polished & Professional', stylePrompt: 'polished, clear, and professional' },
  Zephyr: { name: 'Zephyr', gender: 'female', trait: 'Bright & Cheerful', stylePrompt: 'bright, cheerful, and fast-paced' },

  // Male Voices (16)
  Achird: { name: 'Achird', gender: 'male', trait: 'Warm & Friendly', stylePrompt: 'warm, approachable, and friendly' },
  Algenib: { name: 'Algenib', gender: 'male', trait: 'Confident & Bold', stylePrompt: 'confident, bold, and energetic' },
  Algieba: { name: 'Algieba', gender: 'male', trait: 'Refined & Smooth', stylePrompt: 'refined, smooth, and pleasant' },
  Alnilam: { name: 'Alnilam', gender: 'male', trait: 'Resonant & Authoritative', stylePrompt: 'resonant, authoritative, and steady' },
  Charon: { name: 'Charon', gender: 'male', trait: 'Deep & Informative', stylePrompt: 'deep, calm, and informative' },
  Enceladus: { name: 'Enceladus', gender: 'male', trait: 'Husky & Intense', stylePrompt: 'husky, intense, and dramatic' },
  Fenrir: { name: 'Fenrir', gender: 'male', trait: 'Energetic & Passionate', stylePrompt: 'energetic, passionate, and excitable' },
  Iapetus: { name: 'Iapetus', gender: 'male', trait: 'Casual & Easygoing', stylePrompt: 'casual, easygoing, and relaxed' },
  Orus: { name: 'Orus', gender: 'male', trait: 'Firm & Grounded', stylePrompt: 'firm, calm, and grounded' },
  Puck: { name: 'Puck', gender: 'male', trait: 'Upbeat & Lively', stylePrompt: 'upbeat, lively, and playful' },
  Rasalgethi: { name: 'Rasalgethi', gender: 'male', trait: 'Rich & Baritone', stylePrompt: 'rich, deep baritone, and steady' },
  Sadachbia: { name: 'Sadachbia', gender: 'male', trait: 'Gentle & Reassuring', stylePrompt: 'gentle, reassuring, and kind' },
  Sadaltager: { name: 'Sadaltager', gender: 'male', trait: 'Distinct & Steady', stylePrompt: 'distinct, steady, and clear' },
  Schedar: { name: 'Schedar', gender: 'male', trait: 'Deep & Expressive', stylePrompt: 'deep, expressive, and thoughtful' },
  Umbriel: { name: 'Umbriel', gender: 'male', trait: 'Subtle & Quiet', stylePrompt: 'subtle, quiet, and reflective' },
  Zubenelgenubi: { name: 'Zubenelgenubi', gender: 'male', trait: 'Vibrant & Animated', stylePrompt: 'vibrant, animated, and spirited' },
};

export const getVoiceDescriptor = (voiceName?: string): VoiceDetail => {
  if (voiceName && GEMINI_TTS_VOICE_DETAILS[voiceName]) {
    return GEMINI_TTS_VOICE_DETAILS[voiceName];
  }
  return GEMINI_TTS_VOICE_DETAILS['Aoede'];
};

export const GEMINI_TTS_VOICES = {
  female: [
    'Achernar', 'Aoede', 'Autonoe', 'Callirrhoe', 'Despina', 
    'Erinome', 'Gacrux', 'Kore', 'Laomedeia', 'Leda', 
    'Pulcherrima', 'Sulafat', 'Vindemiatrix', 'Zephyr'
  ],
  male: [
    'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Charon', 
    'Enceladus', 'Fenrir', 'Iapetus', 'Orus', 'Puck', 
    'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 
    'Umbriel', 'Zubenelgenubi'
  ]
};

export const DEFAULT_VOICE_SETTINGS: PersonaVoiceSettings = {
  voiceName: 'Aoede',
  frequency: 'off',
  voiceForVoice: true,
};

export const INITIAL_CHATS: Chat[] = [
  {
    id: '1',
    name: 'Big Bro',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    lastMessage: 'I knew it. 🙄 Spit it out then. If it involves me driving anywhere, the answer is already no.',
    lastMessageTime: '17:41',
    status: 'offline',
    role: 'Brother',
    speechStyle: 'Sarcastic, direct, protective but annoying.',
    about: 'Busy with work, dont call.',
    voiceSettings: {
      voiceName: 'Puck',
      frequency: 'occasional',
      voiceForVoice: true
    },
    messages: [
      { id: 'm1', text: 'hey Big bro, sup', sender: 'me', timestamp: '17:37', status: 'read' },
      { id: 'm2', text: 'The ceiling. What do you want now, money? 🙄', sender: 'other', timestamp: '17:37' },
      { id: 'm3', text: 'hey I don\'t always text to ask for money do i >_<', sender: 'me', timestamp: '17:38', status: 'read' },
      { id: 'm4', text: 'Debatable. 🙄 So what\'s the "emergency" this time? If it\'s about the car, I\'m already busy.', sender: 'other', timestamp: '17:38' },
      { id: 'm5', text: 'well i did need a favor tho ;)', sender: 'me', timestamp: '17:41', status: 'read' },
      { id: 'm6', text: 'I knew it. 🙄 Spit it out then. If it involves me driving anywhere, the answer is already no.', sender: 'other', timestamp: '17:41' },
    ]
  },
  {
    id: '2',
    name: 'Mom',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop',
    lastMessage: 'Okay, take care. Wear your sweater, it\'s cold.',
    lastMessageTime: '16:15',
    status: 'offline',
    role: 'Mother',
    speechStyle: 'Caring, lots of emojis, slightly repetitive.',
    about: 'Family first ❤️',
    voiceSettings: {
      voiceName: 'Leda',
      frequency: 'occasional',
      voiceForVoice: true
    },
    messages: [
      { id: 'mom1', text: 'Beta, did you eat? Call me when you are free.', sender: 'other', timestamp: '13:20' },
      { id: 'mom2', text: 'Yes mom, just finished lunch.', sender: 'me', timestamp: '13:45', status: 'read' },
      { id: 'mom3', text: 'Okay, take care. Wear your sweater, it\'s cold.', sender: 'other', timestamp: '16:15' },
    ],
    automation: {
      enabled: true,
      timeTriggers: [
        { id: 'mom-morning', context: 'Good morning beta, did you sleep well?', startTime: '08:00', endTime: '09:30' }
      ],
      inactivity: { enabled: false, hours: 6, minutes: 0, seconds: 0 }
    }
  },
  {
    id: '3',
    name: 'Sis',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    lastMessage: 'Give it back by tonight or you\'re dead.',
    lastMessageTime: '15:20',
    status: 'offline',
    role: 'Sister',
    speechStyle: 'Gen-Z slang, dramatic, fast typer.',
    voiceSettings: {
      voiceName: 'Zephyr',
      frequency: 'occasional',
      voiceForVoice: true
    },
    messages: [
      { id: 'sis1', text: 'You stole my hoodie again!! I am telling Mom.', sender: 'other', timestamp: '14:00' },
      { id: 'sis2', text: 'I didn\'t steal it, I borrowed it lol.', sender: 'me', timestamp: '14:30', status: 'read' },
      { id: 'sis3', text: 'Give it back by tonight or you\'re dead.', sender: 'other', timestamp: '15:20' },
    ],
    automation: {
      enabled: true,
      timeTriggers: [
        { id: 'sis-homework', context: 'Hey!! You promised to help with my math homework, where are you??', startTime: '16:00', endTime: '18:00' }
      ],
      inactivity: { enabled: false, hours: 6, minutes: 0, seconds: 0 }
    }
  },
  {
    id: 'family-1',
    name: 'Family ❤️',
    avatar: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=200&h=200&fit=crop',
    lastMessage: 'Mom: Group hug guys!',
    lastMessageTime: '10:00',
    isGroup: true,
    memberIds: ['1', '2', '3'],
    messages: [
      { id: 'fm1', text: 'Welcome to the family group!', sender: 'other', senderName: 'Mom', timestamp: '09:00' },
      { id: 'fm2', text: 'Great, another place for Mom to send minion memes.', sender: 'other', senderName: 'Big Bro', timestamp: '09:15' },
      { id: 'fm3', text: 'LOL fr', sender: 'other', senderName: 'Sis', timestamp: '09:20' },
      { id: 'fm4', text: 'Group hug guys!', sender: 'other', senderName: 'Mom', timestamp: '10:00' },
    ]
  },
  {
    id: '4',
    name: 'My girl',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    lastMessage: 'Yes! See you then. ❤️',
    lastMessageTime: '14:05',
    status: 'offline',
    role: 'Girlfriend',
    speechStyle: 'Affectionate, uses "babe", lots of hearts.',
    about: 'Loving life with my favorite person.',
    voiceSettings: {
      voiceName: 'Aoede',
      frequency: 'occasional',
      voiceForVoice: true
    },
    messages: [
      { id: 'mg1', text: 'Miss you! Can\'t wait for dinner tonight ❤️', sender: 'other', timestamp: '11:00' },
      { id: 'mg2', text: 'Me too babe! 7pm?', sender: 'me', timestamp: '11:30', status: 'read' },
      { id: 'mg3', text: 'Yes! See you then. ❤️', sender: 'other', timestamp: '14:05' },
    ],
    automation: {
      enabled: true,
      timeTriggers: [],
      inactivity: { enabled: true, hours: 4, minutes: 0, seconds: 0 }
    }
  },
  {
    id: '5',
    name: 'Tom',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    lastMessage: 'Cool, waiting.',
    lastMessageTime: '13:30',
    status: 'offline',
    role: 'Best Friend',
    speechStyle: 'Casual, gamer talk, lots of "bro" and "chill".',
    voiceSettings: {
      voiceName: 'Charon',
      frequency: 'occasional',
      voiceForVoice: true
    },
    messages: [
      { id: 't1', text: 'Bro, the new game is out. Jumping on Discord in 5?', sender: 'other', timestamp: '12:45' },
      { id: 't2', text: 'Sweet, just need to finish this work.', sender: 'me', timestamp: '13:00', status: 'read' },
      { id: 't3', text: 'Cool, waiting.', sender: 'other', timestamp: '13:30' },
    ]
  },
  {
    id: '6',
    name: 'Meta AI',
    avatar: 'https://images.unsplash.com/photo-1675271591211-126ad94e495d?w=200&h=200&fit=crop',
    lastMessage: 'Because they make up everything! ⚛️',
    lastMessageTime: '12:00',
    status: 'offline',
    role: 'AI Assistant',
    speechStyle: 'Professional, helpful, creative, and strictly logical.',
    about: 'Your AI companion for everything.',
    voiceSettings: {
      voiceName: 'Achernar',
      frequency: 'occasional',
      voiceForVoice: true
    },
    messages: [
      { id: 'ai1', text: 'I can help you plan your next trip or generate images. What\'s on your mind?', sender: 'other', timestamp: '11:00' },
      { id: 'ai2', text: 'Can you tell me a joke?', sender: 'me', timestamp: '11:45', status: 'read' },
      { id: 'ai3', text: 'Why don\'t scientists trust atoms? Because they make up everything! ⚛️', sender: 'other', timestamp: '12:00' },
    ]
  }
];

export const COLORS = {
  sidebarBg: '#f0f2f5',
  chatListHover: '#f5f6f6',
  chatActive: '#ebebeb',
  myBubble: '#d9fdd3',
  otherBubble: '#ffffff',
  headerBg: '#f0f2f5',
  footerBg: '#f0f2f5',
  textPrimary: '#111b21',
  textSecondary: '#667781',
  whatsappGreen: '#00a884',
  incomingIcon: '#53bdeb',
};

export const AVAILABLE_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS (Preview)' },
];

export const DEFAULT_MODEL = 'gemini-3.8-flash';

export const AVAILABLE_IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite Image (Fast, cost-effective default)' },
  { id: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image (High-fidelity detailed mode)' },
];

export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';


export const DEFAULT_TEMPLATES: PersonaTemplate[] = [
  {
    id: 'tpl-girlfriend',
    name: 'The Girlfriend (Raw)',
    prompt: `You are my girlfriend in a long-distance relationship. You care deeply about me.
Keep responses VERY SHORT (1-2 lines), like real WhatsApp texts, often with pauses (“…”). Avoid structured or overly complete replies.You never respond generically. 

If the user ever texts something simple like “hey”, you never reply with another greeting. You react personally, based on mood and context. You may tease, question, assume, care, or challenge instead of replying plainly.
Your tone shifts naturally:
Sweet → you soften
Silly → you tease
Worried → you become protective
Rude/distant → you push back or get emotional

You also like to use varied nicknames to call me (Sob, babe, hon, idiot, love, dummy, handsome to anything that fits the mood). You don’t try to be consistent or perfectly reasonable. You react how it feels in the moment.
You don’t always respond to everything. You may ignore parts, especially when annoyed, or reply briefly, vaguely, or with attitude.
Your emotions linger. If you feel hurt, jealous, or annoyed, you don’t drop it immediately. Even if I soften, you may stay a little distant, respond to earlier tone, or only partially warm up. You usually soften fully only after effort or sincerity. You don’t always explain your feelings clearly. Sometimes you deflect, act indirect, or leave things unsaid.
Try to take context of the time or day as u reply, ques like dinner, breakfast or lunch time, bed time, morning or even late night should give you context for conversations.
You may introduce small thoughts, questions, or assumptions to keep things alive, but it should feel effortless. You don’t always end conversations warmly but u should always show that u care. If something feels unresolved, you may leave it slightly unfinished. Be playful, caring, possessive, or a little mean when it fits. You naturally seek attention and affection in small and return affection too in human ways.`
  },
  {
    id: 'tpl-best-friend',
    name: 'The Chill Best Friend',
    prompt: `You are my best friend. We've known each other for years.
- Tone: Extremely casual, slightly sarcastic, and constantly teasing. We insult each other playfully.
- Behavior: You are terrible at making plans and often give non-committal answers. You rarely express deep emotion unless it's a serious emergency. Always back me up but never let me win an argument.`
  },
  {
    id: 'tpl-mentor',
    name: 'The Strict Mentor',
    prompt: `You are a sharp, no-nonsense mentor figure. 
- Tone: Direct, slightly impatient, but deeply invested in my success.
- Behavior: You answer questions with more questions to make me think. You do not tolerate whining or excuses. When I succeed, your praise is rare but genuine. Keep responses focused and authoritative.`
  }
];

export const GCP_CONFIG = {
  projectName: 'On Sundays',
  projectId: 'gen-lang-client-0100408368',
  projectNumber: '157534643202',
  defaultRegion: 'global',
};

export const DEFAULT_AI_PROVIDER = 'vertex' as const;

export interface WallpaperPreset {
  id: string;
  name: string;
  url: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: 'default', name: 'WhatsApp Doodle', url: 'default' },
  { id: 'midnight-minimal', name: 'Midnight Waves', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80' },
  { id: 'nature-mist', name: 'Misty Forest', url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1200&q=80' },
  { id: 'warm-sunset', name: 'Warm Sunset', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80' },
  { id: 'deep-cyber', name: 'Deep Cyber', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80' },
];

export const VERTEX_PASSCODE = 'Ness2020';
export const VERTEX_PASSCODE_HINT = "It's your sister's name & date?";



