import { Message, AppSettings } from '../types';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const getAppNow = (settings?: AppSettings): Date => {
  if (settings?.timeMode === 'custom' && typeof settings.customTimeOffsetMs === 'number') {
    return new Date(Date.now() + settings.customTimeOffsetMs);
  }
  return new Date();
};

export const getAppDateKey = (settings?: AppSettings): string => {
  return getLocalDateKey(getAppNow(settings));
};

export const getAppFormattedTime = (settings?: AppSettings): string => {
  return getAppNow(settings).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const getAppTimeContext = (settings?: AppSettings): string => {
  const now = getAppNow(settings);
  return `It is currently ${now.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })}.`;
};

export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const normalizeDateKey = (value?: string, fallback = getLocalDateKey()) => {
  if (!value) return fallback;

  if (DATE_KEY_PATTERN.test(value)) {
    const parsed = parseDateKey(value);
    if (
      parsed.getFullYear() === Number(value.slice(0, 4)) &&
      parsed.getMonth() === Number(value.slice(5, 7)) - 1 &&
      parsed.getDate() === Number(value.slice(8, 10))
    ) {
      return value;
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return getLocalDateKey(parsed);
  }

  return fallback;
};

export const getMessageDateKey = (message: Message) => normalizeDateKey(message.date);

export const getDaysBetween = (startDate: string, endDate: string) => {
  const start = parseDateKey(normalizeDateKey(startDate));
  const end = parseDateKey(normalizeDateKey(endDate));
  return Math.round((end.getTime() - start.getTime()) / 86400000);
};

export const isDateInRange = (dateKey: string, startDate: string, endDate: string) => {
  const date = normalizeDateKey(dateKey);
  const start = normalizeDateKey(startDate);
  const end = normalizeDateKey(endDate);
  return date >= start && date <= end;
};

export const formatDateRangeLabel = (startDate: string, endDate: string) => {
  const start = normalizeDateKey(startDate);
  const end = normalizeDateKey(endDate);
  const format = (dateKey: string) => parseDateKey(dateKey).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return start === end ? format(start) : `${format(start)} - ${format(end)}`;
};

export const formatChatDividerLabel = (dateKey: string) => {
  const normalized = normalizeDateKey(dateKey);
  const date = parseDateKey(normalized);
  const today = parseDateKey(getLocalDateKey());
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  
  // Older dates: Day Month Year (e.g., 15 May 2024)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: today.getFullYear() === date.getFullYear() ? undefined : 'numeric'
  });
};

export const getMessageTimestampEpoch = (message: Message): number => {
  if (message.timestampEpoch) return message.timestampEpoch;
  
  if (message.id && /^\d+(\.\d+)?$/.test(message.id)) {
    const parsedId = parseInt(message.id.split('-')[0], 10);
    if (parsedId > 1577836800000) {
      return parsedId;
    }
  }

  const dateKey = message.date || getLocalDateKey();
  const timeStr = message.timestamp || '00:00';
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  const d = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
  return d.getTime();
};

export const getTimeGapAndFrequencyContext = (messages: Message[], isInitiationTrigger: boolean, settings?: AppSettings): string | undefined => {
  if (messages.length < 2) return undefined;

  const prevMessage = isInitiationTrigger 
    ? messages[messages.length - 1] 
    : messages[messages.length - 2];

  if (!prevMessage) return undefined;

  const prevMs = getMessageTimestampEpoch(prevMessage);
  const currentMs = getAppNow(settings).getTime();
  const diffMs = currentMs - prevMs;

  if (diffMs <= 0) return undefined;

  const diffMinutes = diffMs / 60000;
  const diffHours = diffMinutes / 60;
  const diffDays = diffHours / 24;

  const todayKey = getAppDateKey(settings);
  const messagesTodayList = messages.filter(m => m.date === todayKey);
  const messagesToday = messagesTodayList.length;

  if (diffHours < 2) {
    // Short gap. No time gap acknowledgement.
    // Check if we should comment on high chat frequency.
    // Only prompt if >= 15 messages today AND the AI has not already responded today since the 15-message mark was crossed.
    if (messagesToday >= 15 && !isInitiationTrigger) {
      const fifteenthMsg = messagesTodayList[14];
      const indexInAll = messages.findIndex(m => m.id === fifteenthMsg.id);
      const subsequentMessages = messages.slice(indexInAll + 1);
      const aiAlreadyResponded = subsequentMessages.some(m => m.sender === 'other');
      
      if (!aiAlreadyResponded) {
        return `[CHAT FREQUENCY INFO]
You and the user have been chatting very actively today, with ${messagesToday} messages exchanged.
CRITICAL PERSONA DIRECTION: If it fits your persona's mood and relationship, you may make a casual, lighthearted comment about how much you've been chatting today (e.g., "Wow, you're quite active today..." or "We've been chatting a lot today!"). Keep it natural, subtle, and optional.`;
      }
    }
    return undefined;
  }

  if (diffHours >= 2 && diffHours < 12) {
    return `[TIME GAP DETECTED]
It has been about ${Math.round(diffHours)} hours since your last chat exchange.
CRITICAL PERSONA DIRECTION: Acknowledge this return to chat naturally. You might comment on the transition of time (e.g., greeting them for the evening after chatting earlier, or asking how the rest of their day went), matching your persona's style.`;
  }

  if (diffHours >= 12 && diffHours < 24) {
    return `[TIME GAP DETECTED]
You last chatted yesterday (about ${Math.round(diffHours)} hours ago).
CRITICAL PERSONA DIRECTION: You MUST acknowledge this gap. React to their return after a day. Depending on your persona, you could express pleasure to hear from them again, ask about their yesterday/today, or reflect it in your tone (e.g., "Hey! Back again?").`;
  }

  if (diffHours >= 24 && diffHours < 168) {
    const days = Math.max(2, Math.round(diffDays));
    return `[TIME GAP DETECTED]
It has been ${days} days since you last chatted.
CRITICAL PERSONA DIRECTION: You MUST explicitly acknowledge this multi-day gap. React according to your relationship/persona: be excited they are back, complain that they ignored you/went silent, say you missed them, or act indifferent but acknowledge the gap.`;
  }

  // Over a week
  const days = Math.round(diffDays);
  return `[TIME GAP DETECTED]
It has been ${days} days (over a week) since you last chatted.
CRITICAL PERSONA DIRECTION: You MUST acknowledge this very long silence. React strongly according to your persona's relationship (e.g., show surprise, ask where they have been all this time, complain about being neglected, etc.).`;
};
