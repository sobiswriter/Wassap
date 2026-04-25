import React from 'react';
import { MessageSquareText, CircleDashed, Users, Phone } from 'lucide-react';

interface MobileNavigationProps {
  unreadCount?: number;
  onGuideClick?: () => void;
  onUpdatesClick?: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ unreadCount = 0, onGuideClick, onUpdatesClick }) => {
  return (
    <div className="md:hidden flex h-[60px] bg-white dark:bg-[#0b141a] border-t app-border z-40 w-full justify-around items-center px-2 shrink-0 select-none pb-1">
      {/* Chats Tab */}
      <div className="flex flex-col items-center justify-center cursor-pointer w-16 h-full text-primary relative">
        <div className="relative bg-[#d8fdd2] dark:bg-[#1f2c33] px-4 py-1 rounded-full mb-0.5 mt-1 transition-colors">
          <MessageSquareText size={22} className="text-[#105e4b] dark:text-[#00a884] fill-[#105e4b] dark:fill-[#00a884]" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-[#25d366] text-white text-[calc(var(--msg-font-size)-4.5px)] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] flex items-center justify-center border-2 border-[#d8fdd2] dark:border-[#1f2c33]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </div>
        <span className="text-[calc(var(--msg-font-size)-2.5px)] font-semibold text-[#105e4b] dark:text-[#d1d7db]">Chats</span>
      </div>

      {/* Updates Tab */}
      <div className="flex flex-col items-center justify-center cursor-pointer w-16 h-full text-secondary hover:text-primary transition-colors" onClick={onUpdatesClick}>
        <div className="relative px-4 py-1 mb-0.5 mt-1">
          <CircleDashed size={22} />
          <div className="absolute top-1 right-3 bg-[#00a884] w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0b141a] animate-pulse"></div>
        </div>
        <span className="text-[calc(var(--msg-font-size)-2.5px)] font-medium">Updates</span>
      </div>

      {/* Communities Tab (Guide) */}
      <div className="flex flex-col items-center justify-center cursor-pointer w-16 h-full text-secondary hover:text-primary transition-colors" onClick={onGuideClick}>
        <div className="px-4 py-1 mb-0.5 mt-1">
          <Users size={22} strokeWidth={1.8} />
        </div>
        <span className="text-[calc(var(--msg-font-size)-2.5px)] font-medium">Guide</span>
      </div>

      {/* Calls Tab */}
      <div className="flex flex-col items-center justify-center cursor-pointer w-16 h-full text-secondary hover:text-primary transition-colors">
        <div className="px-4 py-1 mb-0.5 mt-1">
          <Phone size={22} strokeWidth={1.8} />
        </div>
        <span className="text-[calc(var(--msg-font-size)-2.5px)] font-medium">Calls</span>
      </div>
    </div>
  );
};
