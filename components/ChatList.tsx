
import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, MoreVertical, Users, UserPlus } from 'lucide-react';
import { Chat, FilterType } from '../types';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string;
  onChatSelect: (id: string) => void;
  onAddPersona: () => void;
  onAddGroup: () => void;
  onMetaAIClick?: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({ chats, activeChatId, onChatSelect, onAddPersona, onAddGroup, onMetaAIClick }) => {
  const [filter, setFilter] = useState<FilterType>('All');
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(search.toLowerCase());
    if (filter === 'All') return matchesSearch;
    if (filter === 'Unread') return matchesSearch && (chat.unreadCount || 0) > 0;
    if (filter === 'Groups') return matchesSearch && chat.isGroup;
    return matchesSearch;
  });

  const filters: FilterType[] = ['All', 'Unread', 'Favourites', 'Groups'];

  return (
    <div className="flex-1 app-panel flex flex-col h-full border-r app-border relative z-20 transition-colors duration-300 overflow-hidden">
      <div className="p-4 flex justify-between items-center shrink-0">
        <h1 className="text-[22px] font-bold text-primary">Chats</h1>
        <div className="hidden md:flex gap-4 items-center relative" ref={menuRef}>
          <Plus
            className="text-secondary w-5 h-5 cursor-pointer hover:bg-black/5 rounded-full"
            onClick={() => setShowMenu(!showMenu)}
          />
          <MoreVertical className="text-secondary w-5 h-5 cursor-pointer" onClick={() => setShowMenu(!showMenu)} />

          {showMenu && (
            <div className="absolute right-0 top-8 w-[180px] app-panel shadow-xl rounded-md py-2 z-50 animate-in fade-in zoom-in duration-200 origin-top-right border app-border">
              <button
                onClick={() => { onAddPersona(); setShowMenu(false); }}
                className="w-full text-left px-4 py-3 text-[14.5px] text-primary hover:bg-black/5 flex items-center gap-3 transition-colors"
              >
                <UserPlus size={18} className="text-secondary" /> New Persona
              </button>
              <button
                onClick={() => { onAddGroup(); setShowMenu(false); }}
                className="w-full text-left px-4 py-3 text-[14.5px] text-primary hover:bg-black/5 flex items-center gap-3 transition-colors"
              >
                <Users size={18} className="text-secondary" /> New Group
              </button>
            </div>
          )}
        </div>

        {/* Mobile Meta AI Shortcut */}
        <div
          className="md:hidden p-1.5 cursor-pointer hover:bg-black/5 rounded-full transition-colors flex items-center justify-center active:scale-95"
          onClick={onMetaAIClick}
        >
          <div className="w-6 h-6 rounded-full border-[2.5px] p-[1px] bg-clip-border"
            style={{
              background: 'linear-gradient(45deg, #00d2ff 0%, #3a7bd5 50%, #8e2de2 100%)',
              borderColor: 'transparent'
            }}>
            <div className="w-full h-full rounded-full bg-white dark:bg-[#111b21]"></div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative flex items-center app-header rounded-lg px-3 py-1.5">
          <Search className="text-secondary w-4 h-4 mr-4" />
          <input
            type="text"
            placeholder="Search or start new chat"
            className="bg-transparent text-[15px] outline-none flex-1 placeholder-secondary text-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 py-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-[13px] font-medium transition-colors ${filter === f
              ? 'bg-[#e7fce3] text-[#008069]'
              : 'app-header text-secondary hover:bg-black/5'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onChatSelect(chat.id)}
            className={`flex items-center px-4 py-3 cursor-pointer border-b app-border transition-colors ${activeChatId === chat.id ? 'app-header' : 'hover:bg-black/5'
              }`}
          >
            <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full mr-4 object-cover" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className="text-[17px] text-primary font-normal truncate">{chat.name}</h3>
                <span className="text-[12px] text-secondary">{chat.lastMessageTime}</span>
              </div>
              <div className="flex justify-between items-center mt-0.5">
                <p className={`text-[14px] truncate flex-1 ${chat.unreadCount ? 'text-primary font-semibold' : 'text-secondary'}`}>
                  {chat.lastMessage}
                </p>
                {chat.unreadCount ? (
                  <span className="bg-[#25d366] text-white text-[12px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                    {chat.unreadCount}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
