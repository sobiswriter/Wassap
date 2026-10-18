import React from 'react';
import { MessageSquareText, CircleDashed, BookOpen, Settings } from 'lucide-react';

interface MobileNavigationProps {
  unreadCount?: number;
  onGuideClick?: () => void;
  onUpdatesClick?: () => void;
  onSettingsClick?: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ unreadCount = 0, onGuideClick, onUpdatesClick, onSettingsClick }) => (
  <nav aria-label="Main navigation" className="mobile-navigation md:hidden flex app-panel border-t app-border w-full justify-around shrink-0 select-none">
    <button type="button" aria-current="page" aria-label={unreadCount ? `Chats, ${unreadCount} unread` : 'Chats'} className="mobile-nav-item text-[#105e4b] dark:text-[#21c063]">
      <span className="mobile-nav-icon bg-[#d8fdd2] dark:bg-[#103629] relative">
        <MessageSquareText size={24} strokeWidth={1.8} />
        {unreadCount > 0 && <span className="absolute -top-1 right-0 bg-[#21c063] text-[#0b1014] text-[10px] font-semibold rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </span>
      <span className="font-semibold">Chats</span>
    </button>
    <button type="button" onClick={onUpdatesClick} aria-label="App updates" className="mobile-nav-item text-secondary">
      <span className="mobile-nav-icon"><CircleDashed size={24} strokeWidth={1.8} /></span><span>Updates</span>
    </button>
    <button type="button" onClick={onGuideClick} className="mobile-nav-item text-secondary">
      <span className="mobile-nav-icon"><BookOpen size={23} strokeWidth={1.8} /></span><span>Guide</span>
    </button>
    <button type="button" onClick={onSettingsClick} className="mobile-nav-item text-secondary">
      <span className="mobile-nav-icon"><Settings size={24} strokeWidth={1.8} /></span><span>Settings</span>
    </button>
  </nav>
);
