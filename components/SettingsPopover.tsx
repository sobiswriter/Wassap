
import React from 'react';
import { Moon, Sun, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsPopoverProps {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({ settings, onUpdate, onClose }) => {
  return (
    <div className="absolute left-[70px] bottom-16 w-[300px] app-panel rounded-lg shadow-2xl border app-border z-[100] animate-in slide-in-from-bottom-2 duration-200 overflow-hidden">
      <div className="p-4 border-b app-border flex justify-between items-center app-header">
        <h3 className="font-medium text-[#111b21] text-[16px]">Settings</h3>
        <X size={18} className="text-[#54656f] cursor-pointer hover:bg-black/5 rounded-full" onClick={onClose} />
      </div>
      
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.theme === 'light' ? <Sun size={20} className="text-[#00a884]" /> : <Moon size={20} className="text-[#00a884]" />}
            <div>
              <p className="text-[14.5px] text-[#111b21] font-medium">App Theme</p>
              <p className="text-[12px] text-[#667781]">Current: {settings.theme === 'light' ? 'Light' : 'Dark'}</p>
            </div>
          </div>
          <button 
            onClick={() => onUpdate({ ...settings, theme: settings.theme === 'light' ? 'dark' : 'light' })}
            className="text-[13px] text-[#00a884] font-medium uppercase hover:bg-black/5 px-2 py-1 rounded transition-colors"
          >
            Change
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.shareUserInfo ? <ShieldCheck size={20} className="text-[#00a884]" /> : <ShieldAlert size={20} className="text-red-400" />}
            <div>
              <p className="text-[14.5px] text-[#111b21] font-medium">Share AI Context</p>
              <p className="text-[12px] text-[#667781]">Let personas see your bio</p>
            </div>
          </div>
          <div 
            onClick={() => onUpdate({ ...settings, shareUserInfo: !settings.shareUserInfo })}
            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${settings.shareUserInfo ? 'bg-[#00a884]' : 'bg-gray-400'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${settings.shareUserInfo ? 'left-5.5' : 'left-0.5'}`} />
          </div>
        </div>
      </div>

      <div className="app-header p-3 text-[11px] text-[#667781] text-center italic border-t app-border">
        Personas respect your privacy settings in real-time.
      </div>
    </div>
  );
};
