
import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, MoreVertical, Users, UserPlus, Camera, ScanLine, MessageSquarePlus, X, SendHorizontal, ExternalLink, QrCode, Settings, Mic, User, CalendarDays, Archive, ArchiveRestore, ArrowLeft, Pin, PinOff, Check } from 'lucide-react';
import { Chat, FilterType } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { triggerHaptic } from '../utils/haptics';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string;
  onChatSelect: (id: string) => void;
  onSetChatFlags: (ids: string[], flags: { archived?: boolean; pinned?: boolean }) => void;
  onAddPersona: () => void;
  onAddGroup: () => void;
  onOpenSettings?: () => void;
  onProfileClick?: () => void;
  onCalendarClick?: () => void;
  onSendPhotoToChat?: (chatId: string, fileData: string, caption?: string) => void;
  onMetaAIClick?: () => void;
  isMobile?: boolean;
  isActive?: boolean;
}

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onSelect: (id: string) => void;
  onLongSelect: (id: string) => void;
  selected: boolean;
}

const ChatListItem = React.memo<ChatListItemProps>(({ chat, isActive, onSelect, onLongSelect, selected }) => {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const cancelHold = () => clearTimeout(timer.current);
  useEffect(() => cancelHold, []);
  return (
  <div
    role="button"
    tabIndex={0}
    aria-label={`Open chat with ${chat.name}${chat.unreadCount ? `, ${chat.unreadCount} unread` : ''}`}
    aria-pressed={selected}
    style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none', userSelect: 'none' }}
    onPointerDown={(event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      cancelHold(); suppressClick.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => { suppressClick.current = true; onLongSelect(chat.id); triggerHaptic('selection'); }, 450);
    }}
    onPointerMove={(event) => { if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) { cancelHold(); suppressClick.current = true; } }}
    onPointerUp={cancelHold}
    onPointerCancel={() => { cancelHold(); suppressClick.current = true; }}
    onPointerLeave={cancelHold}
    onContextMenu={(event) => { event.preventDefault(); cancelHold(); suppressClick.current = true; onLongSelect(chat.id); }}
    onKeyDown={(event) => {
      if (event.key === ' ' || event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); if (selected && event.key === ' ') onSelect(chat.id); else onLongSelect(chat.id); }
      else if (event.key === 'Enter') { event.preventDefault(); onSelect(chat.id); }
    }}
    onClick={(event) => { if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); return; } onSelect(chat.id); }}
    className={`chat-list-row flex items-center px-4 py-3 cursor-pointer transition-colors ${
      selected ? 'bg-[#d8fdd2] dark:bg-[#103629]' : isActive ? 'app-header' : 'hover:bg-black/5'
    }`}
  >
    <span className="relative shrink-0 mr-4"><img src={chat.avatar} draggable={false} alt={chat.name} className="w-12 h-12 rounded-full object-cover" />{selected && <span className="absolute -bottom-1 -right-1 rounded-full bg-[#21c063] text-white border-2 border-white dark:border-[#103629] p-0.5"><Check size={14} strokeWidth={3} /></span>}</span>
    <div className="chat-list-copy flex-1 min-w-0">
      <div className="flex justify-between items-baseline">
        <h3 className="text-[calc(var(--msg-font-size)+2.5px)] text-primary font-medium truncate">{chat.name}</h3>
        <span className={`text-[calc(var(--msg-font-size)-2.5px)] ${chat.unreadCount ? 'text-[#1fa855] dark:text-[#21c063] font-semibold' : 'text-secondary'}`}>{chat.lastMessageTime}</span>
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <p className={`text-[calc(var(--msg-font-size)-0.5px)] truncate flex-1 ${chat.unreadCount ? 'text-primary font-semibold' : 'text-secondary'}`}>
          {chat.status === 'typing...' ? (
            <span className="text-[#21c063] font-medium italic animate-pulse">typing...</span>
          ) : chat.status === 'recording audio...' ? (
            <span className="text-[#21c063] font-medium italic animate-pulse flex items-center gap-1">
              <Mic className="w-3 h-3 inline animate-bounce" /> recording audio...
            </span>
          ) : (
            chat.lastMessage
          )}
        </p>
        {chat.pinned && <Pin size={14} className="text-secondary shrink-0 mx-2" aria-label="Pinned chat" />}
        {chat.unreadCount ? (
          <span className="bg-[#21c063] text-white text-[11px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center leading-none">
            {chat.unreadCount}
          </span>
        ) : null}
      </div>
    </div>
  </div>
);
});

export const ChatList: React.FC<ChatListProps> = ({ 
  chats, 
  activeChatId, 
  onChatSelect,
  onSetChatFlags,
  onAddPersona, 
  onAddGroup, 
  onOpenSettings,
  onProfileClick,
  onCalendarClick,
  onSendPhotoToChat,
  onMetaAIClick, 
  isMobile,
  isActive = true
}) => {
  const [filter, setFilter] = useState<FilterType>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectionMode = selectedIds.length > 0;
  const selectChat = (id: string) => setSelectedIds(previous => previous.includes(id) ? previous : [...previous, id]);
  const selectedChats = chats.filter(chat => selectedIds.includes(chat.id));
  const allPinned = selectedChats.length > 0 && selectedChats.every(chat => chat.pinned);
  const [showArchived, setShowArchived] = useState(() => !!isMobile && window.history.state?.archiveOpen === true);
  const closeArchived = () => {
    if (isMobile && window.history.state?.archiveOpen) window.history.back();
    else setShowArchived(false);
  };
  useEffect(() => {
    if (!isMobile || !isActive || !showArchived) return;
    const back = (event: PopStateEvent) => {
      if (event.state?.archiveOpen) return; // A child chat/panel is returning to this screen.
      event.stopImmediatePropagation(); setShowArchived(false);
    };
    window.addEventListener('popstate', back, true);
    return () => window.removeEventListener('popstate', back, true);
  }, [isMobile, isActive, showArchived]);
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

  useEffect(() => { setSelectedIds([]); }, [filter, search, showArchived, isActive]);
  useEffect(() => {
    if (!selectionMode || !isActive) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); setSelectedIds([]); } };
    window.addEventListener('keydown', dismiss);
    if (isMobile) window.history.pushState({ ...window.history.state, chatSelection: true }, '');
    const back = (event: PopStateEvent) => {
      if (event.state?.chatSelection) return;
      event.stopImmediatePropagation(); setSelectedIds([]);
    };
    if (isMobile) window.addEventListener('popstate', back, true);
    return () => {
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('popstate', back, true);
      if (isMobile && window.history.state?.chatSelection && !window.history.state?.panelOpen) {
        window.addEventListener('popstate', event => event.stopImmediatePropagation(), { capture: true, once: true });
        window.history.back();
      }
    };
  }, [selectionMode, isMobile, isActive]);


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

  const handleCameraFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 1280, 0.78);
      setPhotoToShare(dataUrl);
      setSelectedRecipientId(activeChatId || chats[0]?.id || '');
      setPhotoCaption('');
    } catch (err) {
      console.warn("Falling back to uncompressed image read:", err);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPhotoToShare(dataUrl);
        setSelectedRecipientId(activeChatId || chats[0]?.id || '');
        setPhotoCaption('');
      };
      reader.readAsDataURL(file);
    }
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
    if (!!chat.archived !== showArchived) return false;
    const matchesSearch = chat.name.toLowerCase().includes(search.toLowerCase());
    if (filter === 'All') return matchesSearch;
    if (filter === 'Unread') return matchesSearch && (chat.unreadCount || 0) > 0;
    if (filter === 'Groups') return matchesSearch && chat.isGroup;
    return matchesSearch;
  }).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  // Favourites returns when contacts can actually be marked as favourites.
  const filters: FilterType[] = ['All', 'Unread', 'Groups'];

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

      {selectionMode ? (
        <div role="toolbar" aria-label="Selected chats" className="flex items-center gap-2 px-3 py-2 pt-[max(env(safe-area-inset-top),8px)] app-header shrink-0 min-h-[64px]">
          <button type="button" aria-label="Cancel chat selection" className="icon-button" onClick={() => setSelectedIds([])}><ArrowLeft size={24} /></button>
          <span role="status" className="flex-1 text-xl font-medium">{selectedIds.length}</span>
          <button type="button" aria-label={allPinned ? 'Unpin selected chats' : 'Pin selected chats'} title={allPinned ? 'Unpin' : 'Pin'} className="icon-button" onClick={() => { onSetChatFlags(selectedIds, { pinned: !allPinned }); setSelectedIds([]); }}>{allPinned ? <PinOff size={23} strokeWidth={1.8} /> : <Pin size={23} strokeWidth={1.8} />}</button>
          <button type="button" aria-label={showArchived ? 'Unarchive selected chats' : 'Archive selected chats'} title={showArchived ? 'Unarchive' : 'Archive'} className="icon-button" onClick={() => { onSetChatFlags(selectedIds, { archived: !showArchived }); setSelectedIds([]); }}>{showArchived ? <ArchiveRestore size={23} strokeWidth={1.8} /> : <Archive size={23} strokeWidth={1.8} />}</button>
        </div>
      ) : isMobile ? (
        <div className="pt-[max(env(safe-area-inset-top),10px)] pb-3 px-4 flex justify-between items-center shrink-0 bg-white dark:bg-[#0b1014] transition-colors">
          {showArchived ? <div className="flex items-center min-w-0"><button type="button" aria-label="Back from archived" className="icon-button text-primary" onClick={closeArchived}><ArrowLeft size={24} /></button><h1 className="text-xl font-medium text-primary">Archived</h1></div> : <h1 className="text-[22px] font-semibold text-[#21c063] dark:text-white tracking-tight">WhatsApp</h1>}
          <div className={`${showArchived ? 'hidden' : 'flex'} items-center relative -mr-2`} ref={mobileMenuRef}>
             <button
               onClick={() => setShowScannerModal(true)}
               className="icon-button text-primary transition-colors cursor-pointer"
               title="Scan code"
             >
               <ScanLine className="w-6 h-6 stroke-[1.5px]" />
             </button>
             <button
               onClick={() => cameraInputRef.current?.click()}
               className="icon-button text-primary transition-colors cursor-pointer"
               title="Camera / Gallery"
             >
               <Camera className="w-6 h-6 stroke-[1.5px]" />
             </button>
             <button
               onClick={() => setShowMobileMenu(!showMobileMenu)}
               aria-expanded={showMobileMenu}
               className="icon-button text-primary transition-colors cursor-pointer"
               title="More options"
             >
               <MoreVertical className="w-6 h-6 stroke-[1.5px]" />
             </button>

             {/* Mobile WhatsApp 3-Dots Dropdown */}
             {showMobileMenu && (
               <div className="absolute right-0 top-9 w-[190px] bg-white dark:bg-[#182229] shadow-2xl rounded-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right border border-[#e9edef] dark:border-[#1f2c34]">
                 <button
                   onClick={() => { onAddPersona(); setShowMobileMenu(false); }}
                   className="w-full text-left px-4 py-2.5 text-[length:var(--msg-font-size)] text-primary hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors cursor-pointer"
                 >
                   <UserPlus size={18} className="text-[#21c063]" />
                   <span>New contact</span>
                 </button>
                 <button
                   onClick={() => { onAddGroup(); setShowMobileMenu(false); }}
                   className="w-full text-left px-4 py-2.5 text-[length:var(--msg-font-size)] text-primary hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors cursor-pointer"
                 >
                   <Users size={18} className="text-[#21c063]" />
                   <span>New group</span>
                 </button>
                 {onProfileClick && <button onClick={() => { onProfileClick(); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-primary flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5"><User size={18} className="text-secondary" />Your profile</button>}
                 {onCalendarClick && <button onClick={() => { onCalendarClick(); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-primary flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5"><CalendarDays size={18} className="text-secondary" />Calendar notes</button>}
                 {onOpenSettings && (
                   <button
                     onClick={() => { onOpenSettings(); setShowMobileMenu(false); }}
                     className="w-full text-left px-4 py-2.5 text-[length:var(--msg-font-size)] text-primary hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors border-t border-[#e9edef] dark:border-[#1f2c34] mt-1 pt-2 cursor-pointer"
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
          <div className="flex items-center">{showArchived && <button type="button" className="icon-button" aria-label="Back from archived" onClick={closeArchived}><ArrowLeft size={22} /></button>}<h1 className="text-[calc(var(--msg-font-size)+7.5px)] font-bold text-primary">{showArchived ? 'Archived' : 'Chats'}</h1></div>
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
        <div className={`relative flex items-center ${isMobile ? 'bg-[#f0f2f5] dark:bg-[#182229] rounded-full' : 'app-header rounded-lg'} px-3 py-1.5`}>
          {isMobile ? (
             <button type="button" onClick={onMetaAIClick} aria-label="Ask Meta AI" className="mr-3 shrink-0 rounded-full p-1"><span className="meta-ai-ring block" aria-hidden="true" /></button>
          ) : (
             <Search className="text-secondary w-4 h-4 mr-4" />
          )}
          <input
            type="text"
            placeholder={isMobile ? "Search chats" : "Search or start new chat"}
            aria-label="Search chats"
            className="bg-transparent text-[calc(var(--msg-font-size)+0.5px)] outline-none flex-1 min-w-0 placeholder-secondary text-primary py-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto shrink-0" aria-label="Chat filters">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[calc(var(--msg-font-size)-0.5px)] font-medium transition-colors ${filter === f
              ? 'bg-[#d8fdd2] text-[#105e4b] dark:bg-[#103629] dark:text-[#21c063] font-semibold'
              : 'bg-[#f0f2f5] dark:bg-[#182229] text-secondary hover:bg-black/5 dark:hover:bg-white/5'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-36 md:pb-0">
        {!showArchived && <button type="button" onClick={() => { if (isMobile) window.history.pushState({ archiveOpen: true }, ''); setShowArchived(true); setFilter('All'); setSearch(''); }} className="w-full flex items-center gap-6 px-6 py-4 text-primary text-left hover:bg-black/5 dark:hover:bg-white/5"><Archive size={22} strokeWidth={1.8} className="text-secondary" /><span className="flex-1 text-base font-medium">Archived</span><span className="text-sm text-[#008069] dark:text-[#21c063]">{chats.filter(chat => chat.archived).length}</span></button>}
        {showArchived && <p className="text-xs text-secondary text-center px-6 py-3">Archived chats stay here when new messages arrive. Open a chat’s menu to unarchive it.</p>}
        {filteredChats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isActive={activeChatId === chat.id}
            selected={selectedIds.includes(chat.id)}
            onLongSelect={selectChat}
            onSelect={(id) => {
              if (selectionMode) setSelectedIds(previous => previous.includes(id) ? previous.filter(selectedId => selectedId !== id) : [...previous, id]);
              else onChatSelect(id);
            }}
          />
        ))}
        {filteredChats.length === 0 && <p role="status" className="text-secondary text-sm text-center px-6 py-10">{search ? 'No chats found. Try another name.' : showArchived ? 'No archived chats.' : filter === 'Unread' ? 'You’re all caught up.' : filter === 'Groups' ? 'No group chats yet.' : 'No chats yet.'}</p>}
      </div>

      {/* Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black/80 z-[3000] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#182229] rounded-2xl overflow-hidden shadow-2xl border app-border flex flex-col">
            <div className="p-4 border-b app-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <QrCode size={20} className="text-[#21c063]" />
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
              <div className="relative w-52 h-52 rounded-2xl border-2 border-dashed border-[#21c063]/60 bg-black/5 dark:bg-black/40 flex flex-col items-center justify-center overflow-hidden">
                <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-[#21c063] rounded-tl" />
                <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-[#21c063] rounded-tr" />
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-[#21c063] rounded-bl" />
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-[#21c063] rounded-br" />
                
                <ScanLine size={48} className="text-[#21c063] animate-pulse mb-2" />
                <p className="text-[11px] text-secondary text-center px-4">Use your device’s QR scanner</p>
              </div>
              <p className="text-xs text-secondary text-center mt-4">
                In-app QR scanning is unavailable. Open an external scanner to scan a code.
              </p>
            </div>

            <div className="p-4 pt-0 flex flex-col gap-2">
              <button
                onClick={() => {
                  window.open('https://lens.google.com/', '_blank');
                  setShowScannerModal(false);
                }}
                className="w-full py-2.5 px-4 bg-[#21c063] hover:bg-[#1eb05b] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
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
          <div className="w-full max-w-md bg-white dark:bg-[#182229] rounded-2xl overflow-hidden shadow-2xl border app-border flex flex-col max-h-[90vh]">
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
                  className="w-full bg-white dark:bg-[#233138] border app-border rounded-xl px-3 py-2 text-sm text-primary outline-none cursor-pointer"
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
                  className="w-full bg-black/5 dark:bg-[#233138] border app-border rounded-xl px-4 py-2.5 text-sm text-primary outline-none placeholder-secondary"
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
                  className="px-5 py-2 bg-[#21c063] hover:bg-[#1eb05b] text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md transition-colors cursor-pointer"
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

