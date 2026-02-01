import React, { useState } from 'react';
import { Moon, Sun, ShieldCheck, ShieldAlert, X, Key, Eye, EyeOff } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsPopoverProps {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({ settings, onUpdate, onClose }) => {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="absolute left-[80px] bottom-20 w-[320px] app-panel rounded-lg shadow-2xl border app-border z-[1000] animate-in slide-in-from-bottom-2 duration-200 overflow-hidden text-primary">
      <div className="p-4 border-b app-border flex justify-between items-center app-header">
        <h3 className="font-medium text-[16px]">Settings</h3>
        <X size={18} className="text-secondary cursor-pointer hover:bg-black/5 rounded-full" onClick={onClose} />
      </div>

      <div className="p-4 space-y-6">
        {/* API Key Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Key size={20} className="text-[#00a884]" />
            <div>
              <p className="text-[14.5px] font-medium">Gemini API Key</p>
              <p className="text-[12px] text-secondary">Required for AI responses</p>
            </div>
          </div>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={settings.apiKey || ''}
              onChange={(e) => onUpdate({ ...settings, apiKey: e.target.value })}
              placeholder="Paste your key here..."
              className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#00a884] transition-all pr-10"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[11px] text-secondary leading-tight">
            Independent mode: Keys are stored locally in your browser.
          </p>
        </div>

        <div className="h-[1px] bg-gray-200 dark:bg-gray-800" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.theme === 'light' ? <Sun size={20} className="text-[#00a884]" /> : <Moon size={20} className="text-[#00a884]" />}
            <div>
              <p className="text-[14.5px] font-medium">App Theme</p>
              <p className="text-[12px] text-secondary">Current: {settings.theme === 'light' ? 'Light' : 'Dark'}</p>
            </div>
          </div>
          <button
            onClick={() => onUpdate({ ...settings, theme: settings.theme === 'light' ? 'dark' : 'light' })}
            className="text-[13px] text-[#00a884] font-medium uppercase hover:bg-black/10 px-2 py-1 rounded transition-colors"
          >
            Change
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.shareUserInfo ? <ShieldCheck size={20} className="text-[#00a884]" /> : <ShieldAlert size={20} className="text-red-400" />}
            <div>
              <p className="text-[14.5px] font-medium">Share AI Context</p>
              <p className="text-[12px] text-secondary">Let personas see your bio</p>
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

      <div className="app-header p-3 text-[11px] text-secondary text-center italic border-t app-border">
        Personas respect your privacy settings in real-time.
      </div>
    </div>
  );
};
