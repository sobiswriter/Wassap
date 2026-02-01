
import React from 'react';
import {
  Users,
  Settings,
  MessageSquareText,
  Phone,
  CircleDashed,
  Radio,
  Archive,
  Images
} from 'lucide-react';

interface SidebarProps {
  userAvatar: string;
  onUserProfileClick: () => void;
  onSettingsClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ userAvatar, onUserProfileClick, onSettingsClick }) => {
  return (
    <div className="w-[64px] app-header border-r app-border flex flex-col justify-between py-3 items-center h-full transition-colors duration-300">
      {/* Top Section */}
      <div className="flex flex-col gap-2 items-center w-full">
        {/* Chats */}
        <div className="p-2 relative cursor-pointer group hover:bg-black/5 rounded-lg transition-colors">
          <div className="bg-black/5 dark:bg-white/10 p-2 rounded-full">
            <MessageSquareText className="text-primary w-6 h-6" />
          </div>
          <div className="absolute top-1 right-1 bg-[#25d366] text-white text-[10px] rounded-full w-[18px] h-[18px] flex items-center justify-center font-bold border-2 border-[#f0f2f5] dark:border-[#202c33]">28</div>
        </div>

        {/* Calls */}
        <div className="p-2 relative cursor-pointer group hover:bg-black/5 rounded-lg transition-colors">
          <Phone className="text-secondary w-6 h-6" />
          <div className="absolute top-1 right-1 bg-[#ea0038] text-white text-[10px] rounded-full w-[18px] h-[18px] flex items-center justify-center font-bold border-2 border-[#f0f2f5] dark:border-[#202c33]">3</div>
        </div>

        {/* Status */}
        <div className="p-2 relative cursor-pointer group hover:bg-black/5 rounded-lg transition-colors">
          <CircleDashed className="text-secondary w-6 h-6" />
          <div className="absolute top-2 right-2 bg-[#25d366] w-2.5 h-2.5 rounded-full border-2 border-[#f0f2f5] dark:border-[#202c33]"></div>
        </div>

        {/* Channels */}
        <div className="p-2 relative cursor-pointer group hover:bg-black/5 rounded-lg transition-colors">
          <Radio className="text-secondary w-6 h-6" />
          <div className="absolute top-2 right-2 bg-[#25d366] w-2.5 h-2.5 rounded-full border-2 border-[#f0f2f5] dark:border-[#202c33]"></div>
        </div>

        {/* Communities */}
        <div className="p-2 cursor-pointer group hover:bg-black/5 rounded-lg transition-colors">
          <Users className="text-secondary w-6 h-6" />
        </div>

        <div className="w-8 h-[1px] bg-gray-300 dark:bg-gray-700 my-1"></div>

        {/* Archive */}
        <div className="p-2 relative cursor-pointer group hover:bg-black/5 rounded-lg transition-colors">
          <Archive className="text-secondary w-6 h-6" />
          <div className="absolute top-1 right-1 bg-[#25d366] text-white text-[10px] rounded-full w-[18px] h-[18px] flex items-center justify-center font-bold border-2 border-[#f0f2f5] dark:border-[#202c33]">12</div>
        </div>

        {/* Meta AI Ring */}
        <div className="p-2 cursor-pointer group hover:bg-black/5 rounded-lg transition-colors flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-[2.5px] p-[1px] bg-clip-border"
            style={{
              background: 'linear-gradient(45deg, #00d2ff 0%, #3a7bd5 50%, #8e2de2 100%)',
              borderColor: 'transparent'
            }}>
            <div className="w-full h-full rounded-full bg-[#f0f2f5] dark:bg-[#202c33]"></div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col gap-2 items-center w-full pb-2">
        {/* Starred/Photos */}
        <div className="p-2 cursor-pointer group hover:bg-black/5 rounded-lg transition-colors mb-1">
          <Images className="text-secondary w-6 h-6" />
        </div>

        <div className="w-8 h-[1px] bg-gray-300 dark:bg-gray-700 my-1"></div>

        {/* Settings */}
        <div className="p-2 cursor-pointer group hover:bg-black/5 rounded-lg transition-colors" onClick={onSettingsClick}>
          <Settings className="text-secondary w-6 h-6" />
        </div>

        {/* Profile */}
        <div
          className="w-8 h-8 rounded-full overflow-hidden cursor-pointer border-2 border-transparent hover:border-[#00a884] transition-all active:scale-95 mt-2"
          onClick={onUserProfileClick}
        >
          <img
            src={userAvatar}
            alt="My Profile"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  );
};
