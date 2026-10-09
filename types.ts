
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'pending';

export interface FileAttachment {
  name: string;
  data: string; // Base64 (original or preview)
  type: 'image' | 'document' | 'audio' | 'video';
  size?: number;
  mediaId?: string; // ID for IndexedDB storage
  isGif?: boolean;
}

export interface Message {
  id: string;
  text: string;
  date?: string; // Local date key (YYYY-MM-DD) used for chat day dividers and memories
  timestamp: string;
  sender: 'me' | 'other';
  senderName?: string; // For groups
  senderId?: string;   // For groups
  status?: MessageStatus;
  isDeleted?: boolean;
  image?: string; // Base64 image data (fall back or small previews)
  mediaId?: string; // ID for IndexedDB storage (image / primary media)
  attachment?: FileAttachment;
  voiceAttachment?: FileAttachment; // Attached voice note (when paired with image or standalone)
  voiceMediaId?: string; // ID for IndexedDB storage for attached voice note
  voiceDuration?: number; // Duration of attached voice note in seconds
  replyToMessage?: Message;
  isEvent?: boolean;
  eventTitle?: string;
  timestampEpoch?: number;
  isImageRequest?: boolean;
  isMemoryRecall?: boolean;
  reactions?: string[];
  isStarred?: boolean;
  isSticker?: boolean;
  isGif?: boolean;
}

export interface MemoryBubble {
  id: string;
  chatId: string;
  title: string;
  startDate: string;
  endDate: string;
  summary: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TimeTrigger {
  id: string;
  context: string; // e.g. "Morning greeting"
  startTime: string; // e.g. "08:00"
  endTime: string;   // e.g. "09:00"
  lastTriggered?: string; // Date string (YYYY-MM-DD)
  lastTriggerType?: 'normal' | 'catchup';
}

export interface InactivityTrigger {
  enabled: boolean;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface PersonaAutomation {
  enabled: boolean;
  timeTriggers: TimeTrigger[];
  inactivity: InactivityTrigger;
  lastInactivityTriggered?: number; // Timestamp
  lastInactivityType?: 'inactivity';
}

export interface PersonaScheduleBlock {
  id: string;
  startTime: string;
  endTime: string;
  context: string;
}

export interface PersonaSchedule {
  enabled: boolean;
  weekday: PersonaScheduleBlock[];
  weekend: PersonaScheduleBlock[];
  holidayDates?: string[];
  weekendDays?: number[]; // 0 for Sunday, 1 for Monday, etc.
}

export interface HumaneSettings {
  enabled: boolean;
  banRoboticLanguage: boolean;
  humanImperfections: boolean;
  varyMessageLength: boolean;
  varyMessageLengthPrompt?: string;
  moodSliderEnabled: boolean;
  moodValue: number; // 0 to 100
}

export type VoiceNoteFrequency = 'off' | 'occasional' | 'frequent' | 'always';
export type VoiceSourceType = 'prebuilt' | 'designed' | 'replicated';

export interface CustomVoiceItem {
  id: string; // voice_... or voicekey_...
  name: string;
  type: 'designed' | 'replicated';
  createdAt: number;
  model: string; // e.g. 'gemini-3.8-flash-tts'
  gender?: 'female' | 'male' | 'neutral';
  languageCode?: string;
  promptDescription?: string; // If designed
  sampleAudioDataUrl?: string; // Cached audio preview for instantaneous browser audition
  storageMode?: 'stored' | 'ephemeral';
}

export interface PersonaVoiceSettings {
  voiceName: string; // e.g. 'Aoede' or 'Fenrir' (Prebuilt fallback)
  voiceModel?: string; // e.g. '' (app default) | 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts' | 'gemini-3.1-flash-tts-preview'
  frequency: VoiceNoteFrequency;
  voiceForVoice: boolean; // default: true

  // Feature A: Voice Design (Togglable)
  enableVoiceDesign?: boolean;
  designedVoiceId?: string;
  designedVoiceName?: string;

  // Feature B: Voice Replication (Togglable)
  enableVoiceReplication?: boolean;
  replicatedVoiceId?: string;
  replicatedVoiceName?: string;
  replicationStorageMode?: 'stored' | 'ephemeral';

  // Feature C: Voice Prompting & Acting Styles (Togglable)
  enableVoicePrompting?: boolean; // Toggles whether pitch, pacing, and emotional acting style directives influence voice notes
  stylePrompt?: string; // Custom turn-level delivery style directive (for 3.8 models, e.g. "whispering", "cheerful and energetic")
  pitchTone?: string; // e.g. 'high pitch', 'deep tone', 'soft & breathy'
  paceSpeed?: string; // 'default' | 'speaking slowly' | 'speaking rapidly'
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount?: number;
  status?: 'online' | 'offline' | 'typing...';
  lastSeenTime?: string;
  messages: Message[];
  about?: string;
  role?: string;
  speechStyle?: string;
  systemInstruction?: string;
  isGroup?: boolean;
  memberIds?: string[]; // IDs of personas in the group
  memoryEnabled?: boolean;
  memoryBubbles?: MemoryBubble[];
  schedule?: PersonaSchedule;
  automation?: PersonaAutomation;
  humaneSettings?: HumaneSettings;
  voiceSettings?: PersonaVoiceSettings;
  imageModel?: string; // e.g. 'gemini-3.1-flash-lite-image' or 'gemini-3.1-flash-image'
  voiceModel?: string; // e.g. 'gemini-3.8-flash-tts' or 'gemini-3.8-flash-lite-tts'
}

export interface UserProfile {
  name: string;
  about: string;
  status: string;
  avatar: string;
}

export interface PersonaTemplate {
  id: string;
  name: string;
  prompt: string;
}

export type AiProvider = 'vertex' | 'studio';
export type TimeMode = 'device' | 'custom';

export interface AppSettings {
  aiProvider?: AiProvider; // 'vertex' (Built-in Server Credits) | 'studio' (Custom API Key)
  theme: 'light' | 'dark';
  shareUserInfo: boolean;
  apiKey?: string;
  shareTimeContext?: boolean;
  shareCalendarNotes?: boolean;
  useSearchGrounding?: boolean;
  selectedModel?: string;
  selectedImageModel?: string; // 'gemini-3.1-flash-lite-image' | 'gemini-3.1-flash-image'
  selectedVoiceModel?: string; // 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts' | 'gemini-3.1-flash-tts-preview'
  calendarNotes?: string;
  enableNotifications?: boolean;
  fontSize?: number;
  customTemplates?: PersonaTemplate[];
  enableTextStacking?: boolean;
  textStackingDelay?: number;
  enableDynamicOnlinePresence?: boolean;
  chatWallpaper?: string;
  chatWallpaperOpacity?: number;
  isVertexUnlocked?: boolean;
  timeMode?: TimeMode;
  customTimeOffsetMs?: number;
  clientTimeContext?: string;
  giphyApiKey?: string;
}

export type FilterType = 'All' | 'Unread' | 'Favourites' | 'Groups';

export interface PersonaBackupData {
  version: 1;
  type: 'wassap-persona-backup';
  exportedAt: string;
  persona: {
    name: string;
    avatar: string;
    about?: string;
    role?: string;
    speechStyle?: string;
    systemInstruction?: string;
    voiceSettings?: PersonaVoiceSettings;
    schedule?: PersonaSchedule;
    automation?: PersonaAutomation;
    humaneSettings?: HumaneSettings;
    memoryEnabled?: boolean;
    memoryBubbles?: MemoryBubble[];
    imageModel?: string;
    voiceModel?: string;
  };
}
