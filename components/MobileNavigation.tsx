import React from 'react';
import { MessageSquareText, CircleDashed, Users, Phone } from 'lucide-react';

interface MobileNavigationProps {
  unreadCount?: number;
  onGuideClick?: () => void;
  onUpdatesClick?: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ unreadCount = 0, onGuideClick, onUpdatesClick }) => {
  return (
    <div className="md:hidden flex h-auto min-h-[62px] bg-white dark:bg-[#0b1014] border-t border-[#e9edef] dark:border-[#1f2c34] z-40 w-full justify-around items-center px-2 shrink-0 select-none pt-1 pb-[max(env(safe-area-inset-bottom),8px)] transition-colors">
      {/* Chats Tab */}
      <div className="flex flex-col items-center justify-center cursor-pointer w-16 text-primary relative">
        <div className="relative bg-[#d8fdd2] dark:bg-[#103629] px-4 py-1 rounded-full mb-0.5 mt-0.5 transition-colors">
          <MessageSquareText size={22} className="text-[#105e4b] dark:text-[#21c063] fill-[#105e4b] dark:fill-[#21c063]" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1.5 bg-[#21c063] text-[#0b1014] text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[19px] h-[18px] flex items-center justify-center border-2 border-white dark:border-[#0b1014]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </div>
        <span className="text-[12px] font-bold text-[#105e4b] dark:text-white">Chats</span>
      </div>

      {/* Updates Tab */}
      <div className="flex flex-col items-center justify-center cursor-pointer w-16 text-secondary hover:text-primary transition-colors" onClick={onUpdatesClick}>
        <div className="relative px-4 py-1 mb-0.5 mt-0.5">
          <CircleDashed size={22} />
          <div className="absolute top-1.5 right-3 bg-[#21c063] w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0b1014] animate-pulse"></div>
        </div>
        <span className="text-[12px] font-medium text-secondary">Updates</span>
      </div>

      {/* Communities Tab (Guide) */}
      <div className="flex flex-col items-center justify-center cursor-pointer w-16 text-secondary hover:text-primary transition-colors" onClick={onGuideClick}>
        <div className="px-4 py-1 mb-0.5 mt-0.5">
          <Users size={22} strokeWidth={1.8} />
        </div>
        <span className="text-[12px] font-medium text-secondary">Guide</span>
      </div>

      {/* Calls Tab */}
      <div className="flex flex-col items-center justify-center cursor-pointer w-16 text-secondary hover:text-primary transition-colors">
        <div className="px-4 py-1 mb-0.5 mt-0.5">
          <Phone size={22} strokeWidth={1.8} />
        </div>
        <span className="text-[12px] font-medium text-secondary">Calls</span>
      </div>
    </div>
  );
};
