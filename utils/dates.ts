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
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (dateKey?: string | null): Date => {
  if (!dateKey || typeof dateKey !== 'string') {
    return new Date();
  }
  if (dateKey === 'old' || dateKey.toLowerCase().includes('old')) {
    return new Date(2026, 0, 1);
  }
  const parts = dateKey.split('-').map(Number);
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const fallback = new Date(dateKey);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return new Date();
};

export const normalizeDateKey = (value?: string, fallback = getLocalDateKey()): string => {
  if (!value || typeof value !== 'string') return fallback;
  if (value === 'old' || value === 'Older Messages') return 'old';

  if (DATE_KEY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
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

export const formatChatDividerLabel = (dateKey: string, settings?: AppSettings): string => {
  try {
    if (!dateKey || typeof dateKey !== 'string' || dateKey === 'old' || dateKey === 'Older Messages') {
      return 'Older Messages';
    }

    if (dateKey === 'Today') return 'Today';
    if (dateKey === 'Yesterday') return 'Yesterday';

    const normalized = normalizeDateKey(dateKey);
    if (normalized === 'old') return 'Older Messages';

    const date = parseDateKey(normalized);
    if (Number.isNaN(date.getTime())) return 'Older Messages';

    const appNow = getAppNow(settings);
    const todayKey = getAppDateKey(settings);
    const today = parseDateKey(todayKey);
    const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);

    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    
    // Older dates: Day Month Year (e.g., 15 May or 15 May 2024)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: appNow.getFullYear() === date.getFullYear() ? undefined : 'numeric'
    });
  } catch (err) {
    console.warn("Failed to format chat divider label safely:", err);
    return 'Older Messages';
  }
};

/**
 * Strict comparator for date keys:
 * 'old' is strictly before any ISO date (e.g., 'old' < '2024-01-01' < '2026-08-01').
 */
const compareDateKeys = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a === 'old') return -1;
  if (b === 'old') return 1;
  return a.localeCompare(b);
};

/**
 * Resolves and heals chat messages so that:
 * 1. Historical messages without an explicit date are cleanly categorized as 'old' (rendered as "Older Messages").
 * 2. Earlier messages are never newer than subsequent messages.
 * 3. Dates are strictly monotonic non-decreasing (Date(i) <= Date(i+1)).
 * 4. "Today", "Yesterday", or any specific date will NEVER appear in multiple places.
 * 5. Complete data preservation: all user messages and properties remain intact.
 */
export const resolveChatMessagesDates = (messages: Message[], settings?: AppSettings): Message[] => {
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) return [];

    const appTodayKey = getAppDateKey(settings);
    const validMessages = messages.filter((m): m is Message => Boolean(m && typeof m === 'object'));
    if (validMessages.length === 0) return [];

    const n = validMessages.length;
    const resolvedDateKeys: string[] = new Array(n);

    // Step 1: Identify explicit valid dates
    for (let i = 0; i < n; i++) {
      const rawDate = validMessages[i]?.date;
      if (rawDate === 'old' || rawDate === 'Older Messages') {
        resolvedDateKeys[i] = 'old';
      } else if (rawDate && DATE_KEY_PATTERN.test(rawDate)) {
        resolvedDateKeys[i] = rawDate;
      } else {
        resolvedDateKeys[i] = '';
      }
    }

    // Step 2: Backward pass - If an earlier message has no date, it cannot be newer
    // than the next known date in the conversation history!
    let nextKnownDate = '';
    for (let i = n - 1; i >= 0; i--) {
      if (resolvedDateKeys[i]) {
        nextKnownDate = resolvedDateKeys[i];
      } else if (nextKnownDate) {
        if (nextKnownDate === 'old') {
          resolvedDateKeys[i] = 'old';
        } else {
          const currTime = validMessages[i]?.timestamp || '00:00';
          const nextTime = validMessages[i + 1]?.timestamp || '23:59';
          if (currTime > nextTime && i + 1 < n) {
            // Timestamp boundary indicates a day transition backward
            const nextD = parseDateKey(nextKnownDate);
            nextD.setDate(nextD.getDate() - 1);
            nextKnownDate = getLocalDateKey(nextD);
          }
          resolvedDateKeys[i] = nextKnownDate;
        }
      }
    }

    // Step 3: Forward pass - For any messages that still have no date:
    // If preceded by a known date, anchor forward; otherwise mark as legacy 'old'!
    let prevKnownDate = '';
    for (let i = 0; i < n; i++) {
      if (resolvedDateKeys[i]) {
        prevKnownDate = resolvedDateKeys[i];
      } else if (prevKnownDate) {
        if (prevKnownDate === 'old') {
          resolvedDateKeys[i] = 'old';
        } else {
          const currTime = validMessages[i]?.timestamp || '00:00';
          const prevTime = validMessages[i - 1]?.timestamp || '00:00';
          if (currTime < prevTime && i > 0) {
            const prevD = parseDateKey(prevKnownDate);
            prevD.setDate(prevD.getDate() + 1);
            prevKnownDate = getLocalDateKey(prevD);
          }
          resolvedDateKeys[i] = prevKnownDate;
        }
      } else {
        // Legacy message prior to this update with no date context: declare cleanly as 'old'
        resolvedDateKeys[i] = 'old';
      }
    }

    // Step 4: Strict Monotonic Non-Decreasing Guarantee
    // Backward clamp: dateKeys[i] <= dateKeys[i+1]
    for (let i = n - 2; i >= 0; i--) {
      if (compareDateKeys(resolvedDateKeys[i], resolvedDateKeys[i + 1]) > 0) {
        resolvedDateKeys[i] = resolvedDateKeys[i + 1];
      }
    }

    // Forward cap at app today
    for (let i = 0; i < n; i++) {
      if (resolvedDateKeys[i] !== 'old' && compareDateKeys(resolvedDateKeys[i], appTodayKey) > 0) {
        resolvedDateKeys[i] = appTodayKey;
      }
    }

    // Final forward check: date[i] <= date[i+1]
    for (let i = 0; i < n - 1; i++) {
      if (compareDateKeys(resolvedDateKeys[i], resolvedDateKeys[i + 1]) > 0) {
        resolvedDateKeys[i + 1] = resolvedDateKeys[i];
      }
    }

    // Step 5: Return messages with healed date and synchronized epoch
    return validMessages.map((msg, i) => {
      const finalDateKey = resolvedDateKeys[i] || 'old';
      const timeStr = msg.timestamp || '00:00';

      let calculatedEpoch = msg.timestampEpoch;
      if (!calculatedEpoch || Number.isNaN(calculatedEpoch)) {
        if (finalDateKey === 'old') {
          calculatedEpoch = 1704067200000 + i * 60000; // Jan 1, 2024 sequential
        } else {
          const [year, month, day] = finalDateKey.split('-').map(Number);
          const [hours, minutes] = (timeStr.includes(':') ? timeStr : '00:00').split(':').map(Number);
          const d = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
          calculatedEpoch = !Number.isNaN(d.getTime()) ? d.getTime() : Date.now();
        }
      }

      if (msg.date === finalDateKey && msg.timestampEpoch === calculatedEpoch) {
        return msg;
      }

      return {
        ...msg,
        date: finalDateKey,
        timestampEpoch: calculatedEpoch
      };
    });
  } catch (err) {
    console.error("resolveChatMessagesDates caught error safely:", err);
    return messages;
  }
};

export const getMessageTimestampEpoch = (message?: Message | null, settings?: AppSettings): number => {
  if (!message) return Date.now();
  if (typeof message.timestampEpoch === 'number' && !Number.isNaN(message.timestampEpoch)) {
    return message.timestampEpoch;
  }
  
  if (message.id && /^\d+(\.\d+)?$/.test(message.id)) {
    const parsedId = parseInt(message.id.split('-')[0], 10);
    if (parsedId > 1577836800000) {
      return parsedId;
    }
  }

  const dateKey = (message.date && message.date !== 'old') ? message.date : getAppDateKey(settings);
  const timeStr = message.timestamp || '00:00';
  const parts = dateKey.split('-').map(Number);
  const timeParts = (timeStr.includes(':') ? timeStr : '00:00').split(':').map(Number);
  
  const year = parts[0] || 2026;
  const month = parts[1] || 1;
  const day = parts[2] || 1;
  const hours = timeParts[0] || 0;
  const minutes = timeParts[1] || 0;

  const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const epoch = d.getTime();
  return Number.isNaN(epoch) ? Date.now() : epoch;
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
