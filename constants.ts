
import { Chat } from './types';

export const INITIAL_CHATS: Chat[] = [
  {
    id: '1',
    name: 'Big Bro',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    lastMessage: 'I knew it. 🙄 Spit it out then. If it involves me driving anywhere, the answer is already no.',
    lastMessageTime: '05:41 pm',
    status: 'online',
    role: 'Brother',
    speechStyle: 'Sarcastic, direct, protective but annoying.',
    about: 'Busy with work, dont call.',
    messages: [
      { id: 'm1', text: 'hey Big bro, sup', sender: 'me', timestamp: '05:37 pm', status: 'read' },
      { id: 'm2', text: 'The ceiling. What do you want now, money? 🙄', sender: 'other', timestamp: '05:37 pm' },
      { id: 'm3', text: 'hey I don\'t always text to ask for money do i >_<', sender: 'me', timestamp: '05:38 pm', status: 'read' },
      { id: 'm4', text: 'Debatable. 🙄 So what\'s the "emergency" this time? If it\'s about the car, I\'m already busy.', sender: 'other', timestamp: '05:38 pm' },
      { id: 'm5', text: 'well i did need a favor tho ;)', sender: 'me', timestamp: '05:41 pm', status: 'read' },
      { id: 'm6', text: 'I knew it. 🙄 Spit it out then. If it involves me driving anywhere, the answer is already no.', sender: 'other', timestamp: '05:41 pm' },
    ]
  },
  {
    id: '2',
    name: 'Mom',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop',
    lastMessage: 'Okay, take care. Wear your sweater, it\'s cold.',
    lastMessageTime: '04:15 pm',
    status: 'online',
    role: 'Mother',
    speechStyle: 'Caring, lots of emojis, slightly repetitive.',
    about: 'Family first ❤️',
    messages: [
      { id: 'mom1', text: 'Beta, did you eat? Call me when you are free.', sender: 'other', timestamp: '01:20 pm' },
      { id: 'mom2', text: 'Yes mom, just finished lunch.', sender: 'me', timestamp: '01:45 pm', status: 'read' },
      { id: 'mom3', text: 'Okay, take care. Wear your sweater, it\'s cold.', sender: 'other', timestamp: '04:15 pm' },
    ]
  },
  {
    id: '3',
    name: 'Sis',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    lastMessage: 'Give it back by tonight or you\'re dead.',
    lastMessageTime: '03:20 pm',
    status: 'online',
    role: 'Sister',
    speechStyle: 'Gen-Z slang, dramatic, fast typer.',
    messages: [
      { id: 'sis1', text: 'You stole my hoodie again!! I am telling Mom.', sender: 'other', timestamp: '02:00 pm' },
      { id: 'sis2', text: 'I didn\'t steal it, I borrowed it lol.', sender: 'me', timestamp: '02:30 pm', status: 'read' },
      { id: 'sis3', text: 'Give it back by tonight or you\'re dead.', sender: 'other', timestamp: '03:20 pm' },
    ]
  },
  {
    id: 'family-1',
    name: 'Family ❤️',
    avatar: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=200&h=200&fit=crop',
    lastMessage: 'Mom: Group hug guys!',
    lastMessageTime: '10:00 am',
    isGroup: true,
    memberIds: ['1', '2', '3'],
    messages: [
      { id: 'fm1', text: 'Welcome to the family group!', sender: 'other', senderName: 'Mom', timestamp: '09:00 am' },
      { id: 'fm2', text: 'Great, another place for Mom to send minion memes.', sender: 'other', senderName: 'Big Bro', timestamp: '09:15 am' },
      { id: 'fm3', text: 'LOL fr', sender: 'other', senderName: 'Sis', timestamp: '09:20 am' },
      { id: 'fm4', text: 'Group hug guys!', sender: 'other', senderName: 'Mom', timestamp: '10:00 am' },
    ]
  },
  {
    id: '4',
    name: 'My girl',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    lastMessage: 'Yes! See you then. ❤️',
    lastMessageTime: '02:05 pm',
    status: 'online',
    role: 'Girlfriend',
    speechStyle: 'Affectionate, uses "babe", lots of hearts.',
    about: 'Loving life with my favorite person.',
    messages: [
      { id: 'mg1', text: 'Miss you! Can\'t wait for dinner tonight ❤️', sender: 'other', timestamp: '11:00 am' },
      { id: 'mg2', text: 'Me too babe! 7pm?', sender: 'me', timestamp: '11:30 am', status: 'read' },
      { id: 'mg3', text: 'Yes! See you then. ❤️', sender: 'other', timestamp: '02:05 pm' },
    ]
  },
  {
    id: '5',
    name: 'Tom',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    lastMessage: 'Cool, waiting.',
    lastMessageTime: '01:30 pm',
    status: 'offline',
    role: 'Best Friend',
    speechStyle: 'Casual, gamer talk, lots of "bro" and "chill".',
    messages: [
      { id: 't1', text: 'Bro, the new game is out. Jumping on Discord in 5?', sender: 'other', timestamp: '12:45 pm' },
      { id: 't2', text: 'Sweet, just need to finish this work.', sender: 'me', timestamp: '01:00 pm', status: 'read' },
      { id: 't3', text: 'Cool, waiting.', sender: 'other', timestamp: '01:30 pm' },
    ]
  },
  {
    id: '6',
    name: 'Meta AI',
    avatar: 'https://images.unsplash.com/photo-1675271591211-126ad94e495d?w=200&h=200&fit=crop',
    lastMessage: 'Because they make up everything! ⚛️',
    lastMessageTime: '12:00 pm',
    status: 'online',
    role: 'AI Assistant',
    speechStyle: 'Professional, helpful, creative, and strictly logical.',
    about: 'Your AI companion for everything.',
    messages: [
      { id: 'ai1', text: 'I can help you plan your next trip or generate images. What\'s on your mind?', sender: 'other', timestamp: '11:00 am' },
      { id: 'ai2', text: 'Can you tell me a joke?', sender: 'me', timestamp: '11:45 am', status: 'read' },
      { id: 'ai3', text: 'Why don\'t scientists trust atoms? Because they make up everything! ⚛️', sender: 'other', timestamp: '12:00 pm' },
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
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
];
