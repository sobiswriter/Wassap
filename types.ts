
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface FileAttachment {
  name: string;
  data: string; // Base64
  type: 'image' | 'document';
  size?: number;
}

export interface Message {
  id: string;
  text: string;
  timestamp: string;
  sender: 'me' | 'other';
  senderName?: string; // For groups
  senderId?: string;   // For groups
  status?: MessageStatus;
  isDeleted?: boolean;
  image?: string; // Base64 image data
  attachment?: FileAttachment;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount?: number;
  status?: 'online' | 'offline' | 'typing...';
  messages: Message[];
  about?: string;
  role?: string;
  speechStyle?: string;
  systemInstruction?: string;
  isGroup?: boolean;
  memberIds?: string[]; // IDs of personas in the group
}

export interface UserProfile {
  name: string;
  about: string;
  status: string;
  avatar: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  shareUserInfo: boolean;
  apiKey?: string;
}

export type FilterType = 'All' | 'Unread' | 'Favourites' | 'Groups';
