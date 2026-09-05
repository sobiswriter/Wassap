
import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, MoreVertical, Users, UserPlus, Camera, ScanLine, MessageSquarePlus, X, SendHorizontal, ExternalLink, QrCode, Settings } from 'lucide-react';
import { Chat, FilterType } from '../types';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string;
  onChatSelect: (id: string) => void;
  onAddPersona: () => void;
  onAddGroup: () => void;
  onOpenSettings?: () => void;
  onSendPhotoToChat?: (chatId: string, fileData: string, caption?: string) => void;
  onMetaAIClick?: () => void;
  isMobile?: boolean;
}

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onSelect: (id: string) => void;
}

const ChatListItem = React.memo<ChatListItemProps>(({ chat, isActive, onSelect }) => (
  <div
    onClick={() => onSelect(chat.id)}
    className={`flex items-center px-4 py-3 cursor-pointer border-b app-border transition-colors ${
      isActive ? 'app-header' : 'hover:bg-black/5'
    }`}
  >
    <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full mr-4 object-cover" />
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline">
        <h3 className="text-[calc(var(--msg-font-size)+2.5px)] text-primary font-normal truncate">{chat.name}</h3>
        <span className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">{chat.lastMessageTime}</span>
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <p className={`text-[calc(var(--msg-font-size)-0.5px)] truncate flex-1 ${chat.unreadCount ? 'text-primary font-semibold' : 'text-secondary'}`}>
          {chat.lastMessage}
        </p>
        {chat.unreadCount ? (
          <span className="bg-[#25d366] text-white text-[calc(var(--msg-font-size)-2.5px)] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
            {chat.unreadCount}
          </span>
        ) : null}
      </div>
    </div>
  </div>
));

export const ChatList: React.FC<ChatListProps> = ({ 
  chats, 
  activeChatId, 
  onChatSelect, 
  onAddPersona, 
  onAddGroup, 
  onOpenSettings,
  onSendPhotoToChat,
  onMetaAIClick, 
  isMobile 
}) => {
  const [filter, setFilter] = useState<FilterType>('All');
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [photoToShare, setPhotoToShare] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(activeChatId || chats[0]?.id || '');
  const [photoCaption, setPhotoCaption] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCameraFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoToShare(dataUrl);
      setSelectedRecipientId(activeChatId || chats[0]?.id || '');
      setPhotoCaption('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendSharedPhoto = () => {
    if (!photoToShare) return;
    const targetId = selectedRecipientId || activeChatId || chats[0]?.id;
    if (targetId && onSendPhotoToChat) {
      onSendPhotoToChat(targetId, photoToShare, photoCaption.trim() || undefined);
    }
    setPhotoToShare(null);
    setPhotoCaption('');
  };

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
      {/* Hidden camera file input for mobile header */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraFileChange}
      />

      {isMobile ? (
        <div className="p-3 flex justify-between items-center shrink-0">
          <h1 className="text-[calc(var(--msg-font-size)+9.5px)] font-semibold text-[#25d366] dark:text-white tracking-tight">WhatsApp</h1>
          <div className="flex gap-4 items-center relative" ref={mobileMenuRef}>
             <button
               onClick={() => setShowScannerModal(true)}
               className="text-primary hover:text-[#00a884] p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
               title="Scan code"
             >
               <ScanLine className="w-6 h-6 stroke-[1.5px]" />
             </button>
             <button
               onClick={() => cameraInputRef.current?.click()}
               className="text-primary hover:text-[#00a884] p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
               title="Camera / Gallery"
             >
               <Camera className="w-6 h-6 stroke-[1.5px]" />
             </button>
             <button
               onClick={() => setShowMobileMenu(!showMobileMenu)}
               className="text-primary hover:text-[#00a884] p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
               title="More options"
             >
               <MoreVertical className="w-6 h-6 stroke-[1.5px]" />
             </button>

             {/* Mobile WhatsApp 3-Dots Dropdown */}
             {showMobileMenu && (
               <div className="absolute right-0 top-9 w-[190px] bg-white dark:bg-[#202c33] shadow-2xl rounded-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right border app-border">
                 <button
                   onClick={() => { onAddPersona(); setShowMobileMenu(false); }}
                   className="w-full text-left px-4 py-2.5 text-[length:var(--msg-font-size)] text-primary hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors cursor-pointer"
                 >
                   <UserPlus size={18} className="text-[#00a884]" />
                   <span>New contact</span>
                 </button>
                 <button
                   onClick={() => { onAddGroup(); setShowMobileMenu(false); }}
                   className="w-full text-left px-4 py-2.5 text-[length:var(--msg-font-size)] text-primary hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors cursor-pointer"
                 >
                   <Users size={18} className="text-[#00a884]" />
                   <span>New group</span>
                 </button>
                 {onOpenSettings && (
                   <button
                     onClick={() => { onOpenSettings(); setShowMobileMenu(false); }}
                     className="w-full text-left px-4 py-2.5 text-[length:var(--msg-font-size)] text-primary hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors border-t app-border mt-1 pt-2 cursor-pointer"
                   >
                     <Settings size={18} className="text-secondary" />
                     <span>Settings</span>
                   </button>
                 )}
               </div>
             )}
          </div>
        </div>
      ) : (
        <div className="p-4 flex justify-between items-center shrink-0">
          <h1 className="text-[calc(var(--msg-font-size)+7.5px)] font-bold text-primary">Chats</h1>
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
                  className="w-full text-left px-4 py-3 text-[length:var(--msg-font-size)] text-primary hover:bg-black/5 flex items-center gap-3 transition-colors"
                >
                  <UserPlus size={18} className="text-secondary" /> New Contact
                </button>
                <button
                  onClick={() => { onAddGroup(); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 text-[length:var(--msg-font-size)] text-primary hover:bg-black/5 flex items-center gap-3 transition-colors"
                >
                  <Users size={18} className="text-secondary" /> New Group
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-3 pb-2 pt-1">
        <div className={`relative flex items-center ${isMobile ? 'bg-[#f0f2f5] dark:bg-[#202c33] rounded-full' : 'app-header rounded-lg'} px-3 py-1.5`}>
          {isMobile ? (
             <div className="mr-3 w-[22px] h-[22px] rounded-full border-[3px] p-[1px] bg-clip-border flex-shrink-0"
                  style={{ background: 'linear-gradient(45deg, #00d2ff 0%, #3a7bd5 50%, #8e2de2 100%)', borderColor: 'transparent' }}>
                <div className="w-full h-full rounded-full bg-[#f0f2f5] dark:bg-[#202c33]"></div>
             </div>
          ) : (
             <Search className="text-secondary w-4 h-4 mr-4" />
          )}
          <input
            type="text"
            placeholder={isMobile ? "Ask Meta AI or Search" : "Search or start new chat"}
            className="bg-transparent text-[calc(var(--msg-font-size)+0.5px)] outline-none flex-1 placeholder-secondary text-primary py-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-3 py-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-[calc(var(--msg-font-size)-0.5px)] font-medium transition-colors ${filter === f
              ? 'bg-[#d8fdd2] text-[#105e4b] dark:bg-[#0a332c] dark:text-[#25d366]'
              : 'bg-[#f0f2f5] dark:bg-[#202c33] text-secondary hover:bg-black/5 dark:hover:bg-white/5'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isActive={activeChatId === chat.id}
            onSelect={onChatSelect}
          />
        ))}
      </div>

      {/* Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black/80 z-[3000] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#111b21] rounded-2xl overflow-hidden shadow-2xl border app-border flex flex-col">
            <div className="p-4 border-b app-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <QrCode size={20} className="text-[#00a884]" />
                <span>Scan code</span>
              </div>
              <button 
                onClick={() => setShowScannerModal(false)}
                className="p-1 rounded-full text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center justify-center">
              <div className="relative w-52 h-52 rounded-2xl border-2 border-dashed border-[#00a884]/60 bg-black/5 dark:bg-black/40 flex flex-col items-center justify-center overflow-hidden">
                <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-[#00a884] rounded-tl" />
                <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-[#00a884] rounded-tr" />
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-[#00a884] rounded-bl" />
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-[#00a884] rounded-br" />
                
                <ScanLine size={48} className="text-[#00a884] animate-pulse mb-2" />
                <p className="text-[11px] text-secondary text-center px-4">Align QR code within frame</p>
              </div>
              <p className="text-xs text-secondary text-center mt-4">
                Scan WhatsApp QR codes or open your device scanner
              </p>
            </div>

            <div className="p-4 pt-0 flex flex-col gap-2">
              <button
                onClick={() => {
                  window.open('https://lens.google.com/', '_blank');
                  setShowScannerModal(false);
                }}
                className="w-full py-2.5 px-4 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
              >
                <ExternalLink size={16} />
                <span>Open Google Lens / Scanner</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Share Modal from Camera Icon */}
      {photoToShare && (
        <div className="fixed inset-0 bg-black/85 z-[3000] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#111b21] rounded-2xl overflow-hidden shadow-2xl border app-border flex flex-col max-h-[90vh]">
            <div className="p-4 border-b app-border flex items-center justify-between">
              <h3 className="text-primary font-semibold text-base">Send photo</h3>
              <button 
                onClick={() => setPhotoToShare(null)} 
                className="p-1 rounded-full text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-black/5 dark:bg-black/40 flex items-center justify-center overflow-hidden max-h-[300px]">
              <img src={photoToShare} alt="Camera capture" className="max-h-[260px] w-auto rounded-xl object-contain shadow-md" />
            </div>

            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-1.5">
                  Send to
                </label>
                <select
                  value={selectedRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="w-full bg-white dark:bg-[#202c33] border app-border rounded-xl px-3 py-2 text-sm text-primary outline-none cursor-pointer"
                >
                  {chats.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isGroup ? '(Group)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="Add a caption..."
                  className="w-full bg-black/5 dark:bg-[#202c33] border app-border rounded-xl px-4 py-2.5 text-sm text-primary outline-none placeholder-secondary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSendSharedPhoto();
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setPhotoToShare(null)}
                  className="px-4 py-2 text-sm text-secondary hover:text-primary rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendSharedPhoto}
                  className="px-5 py-2 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-xl text-sm font-medium flex items-center gap-2 shadow-md transition-colors cursor-pointer"
                >
                  <span>Send</span>
                  <SendHorizontal size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

