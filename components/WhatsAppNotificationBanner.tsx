import React, { useEffect, useState } from 'react';

export interface ToastNotification {
  id: string;
  chatId: string;
  senderName: string;
  avatar: string;
  message: string;
  timestamp?: string;
}

interface WhatsAppNotificationBannerProps {
  notification: ToastNotification | null;
  onClose: () => void;
  onReply: (chatId: string) => void;
  onMarkAsRead: (chatId: string) => void;
  theme?: 'light' | 'dark';
}

export const WhatsAppNotificationBanner: React.FC<WhatsAppNotificationBannerProps> = ({
  notification,
  onClose,
  onReply,
  onMarkAsRead,
  theme = 'dark'
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Allow slide-up exit transition
      }, 7000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [notification, onClose]);

  if (!notification && !isVisible) return null;

  const isDark = theme === 'dark';

  return (
    <div
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-1.5rem)] max-w-[420px] transition-all duration-300 ease-out select-none ${
        isVisible
          ? 'translate-y-0 opacity-100 scale-100'
          : '-translate-y-10 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div className="relative group">
        {/* Layer 2 (Bottom stacked shadow card) */}
        <div
          className={`absolute left-6 right-6 -bottom-2.5 h-full rounded-[24px] -z-20 transition-colors duration-300 ${
            isDark ? 'bg-[#151516]/80' : 'bg-[#d8d8dc]/80'
          }`}
        />

        {/* Layer 1 (Middle stacked shadow card) */}
        <div
          className={`absolute left-3 right-3 -bottom-1.25 h-full rounded-[24px] -z-10 transition-colors duration-300 ${
            isDark ? 'bg-[#222224]/90' : 'bg-[#e5e5ea]/90'
          }`}
        />

        {/* Main Banner Card */}
        <div
          className={`relative z-10 rounded-[26px] p-3.5 pl-3.5 pr-4 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
            isDark
              ? 'bg-[#2c2c2e]/95 text-white border border-white/10 shadow-black/50'
              : 'bg-[#f6f6f8]/95 text-[#1c1c1e] border border-black/5 shadow-black/15'
          }`}
        >
          {/* Top Main Section */}
          <div
            className="flex items-start gap-3.5 cursor-pointer"
            onClick={() => {
              if (notification) {
                onReply(notification.chatId);
                setIsVisible(false);
                setTimeout(onClose, 300);
              }
            }}
          >
            {/* Avatar Container with WhatsApp Green Border Ring & Badge */}
            <div className="relative shrink-0 w-11 h-11">
              <img
                src={notification?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                alt={notification?.senderName || 'Notification'}
                className="w-11 h-11 rounded-full object-cover bg-neutral-300 dark:bg-neutral-700 ring-2 ring-[#25D366] shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
                }}
              />

              {/* WhatsApp Green Icon Badge */}
              <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-[5px] bg-[#25D366] flex items-center justify-center shadow-md ring-2 ring-[#f6f6f8] dark:ring-[#2c2c2e]">
                <svg className="w-2.5 h-2.5 fill-white" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="50" fill="#25D366"/>
                  <path d="M50 20C33.4315 20 20 33.4315 20 50C20 56.413 22.0335 62.351 25.503 67.202L22 80L35.215 76.536C39.734 78.751 44.75 80 50 80C66.5685 80 80 66.5685 80 50C80 33.4315 66.5685 20 50 20Z" fill="white"/>
                  <path d="M62 55.5C61.2 55.1 57.2 53.1 56.5 52.8C55.8 52.5 55.3 52.4 54.8 53.2C54.3 54 52.8 55.8 52.4 56.3C52 56.8 51.6 56.8 50.8 56.4C50 56 47.4 55.1 44.3 52.3C41.9 50.2 40.3 47.6 39.8 46.8C39.3 46 39.8 45.6 40.2 45.2C40.6 44.8 41.1 44.2 41.3 43.8C41.5 43.4 41.4 43 41.2 42.6C41 42.2 40 39.8 39.2 37.8C38.4 35.8 37.6 36.1 37.1 36.1H36.3C35.8 36.1 35 36.3 34.3 37.1C33.6 37.9 31.6 39.8 31.6 43.6C31.6 47.4 34.4 51.1 34.8 51.6C35.2 52.1 40 59.4 47.4 62.6C49.2 63.4 50.5 63.8 51.6 64.1C53.4 64.7 55 64.6 56.3 64.4C57.7 64.2 60.6 62.6 61.6 57.4C61.4 57.1 61 56.9 60.2 56.5H62V55.5Z" fill="#25D366"/>
                </svg>
              </div>
            </div>

            {/* Header & Message Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`font-semibold text-[15px] leading-tight truncate ${isDark ? 'text-white' : 'text-[#1c1c1e]'}`}>
                  {notification?.senderName || 'Notification'}
                </span>
                <span className={`text-[12px] font-normal shrink-0 ${isDark ? 'text-[#8e8e93]' : 'text-[#8e8e93]'}`}>
                  {notification?.timestamp || 'now'}
                </span>
              </div>
              <p className={`text-[13.5px] leading-snug line-clamp-2 ${isDark ? 'text-[#e5e5ea]' : 'text-[#3a3a3c]'}`}>
                {notification?.message}
              </p>
            </div>
          </div>

          {/* Action Row matching WhatsApp standard */}
          <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/10 flex items-center justify-start gap-6 px-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (notification) {
                  onReply(notification.chatId);
                  setIsVisible(false);
                  setTimeout(onClose, 300);
                }
              }}
              className="text-[12.5px] font-bold text-[#00a884] dark:text-[#25d366] hover:opacity-80 transition-opacity tracking-wider uppercase"
            >
              REPLY
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (notification) {
                  onMarkAsRead(notification.chatId);
                  setIsVisible(false);
                  setTimeout(onClose, 300);
                }
              }}
              className="text-[12.5px] font-bold text-[#00a884] dark:text-[#25d366] hover:opacity-80 transition-opacity tracking-wider uppercase"
            >
              MARK AS READ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
