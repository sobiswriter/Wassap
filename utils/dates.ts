import { Message } from '../types';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: today.getFullYear() === date.getFullYear() ? undefined : 'numeric'
  });
};
