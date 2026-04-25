import React, { useState } from 'react';
import { Moon, Sun, ShieldCheck, ShieldAlert, X, Key, Eye, EyeOff, Clock, CalendarDays, Sparkles, Globe, Bell, ALargeSmall } from 'lucide-react';
import { AppSettings } from '../types';
import { AVAILABLE_MODELS } from '../constants';

interface SettingsPopoverProps {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({ settings, onUpdate, onClose }) => {
  const [showKey, setShowKey] = useState(false);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);

  const handleSave = () => {
    onUpdate(draftSettings);
    onClose();
  };

  return (
    <div className="absolute left-0 md:left-[80px] bottom-0 md:bottom-20 w-full md:w-[320px] h-[calc(100%-80px)] md:h-auto max-h-[calc(100vh-140px)] app-panel md:rounded-lg shadow-2xl border app-border z-[1000] animate-in slide-in-from-bottom-2 duration-200 flex flex-col text-primary">
      <div className="p-4 border-b app-border flex justify-between items-center app-header shrink-0">
        <h3 className="font-medium text-[calc(var(--msg-font-size)+1.5px)]">Settings</h3>
        <X size={18} className="text-secondary cursor-pointer hover:bg-black/5 rounded-full" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {/* API Key Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Key size={20} className="text-[#00a884]" />
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">Gemini API Key</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Required for AI responses</p>
            </div>
          </div>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={draftSettings.apiKey || ''}
              onChange={(e) => setDraftSettings({ ...draftSettings, apiKey: e.target.value })}
              placeholder="Paste your key here..."
              className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none focus:border-[#00a884] transition-all pr-10"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[calc(var(--msg-font-size)-3.5px)] text-secondary leading-tight">
            Independent mode: Keys are stored locally in your browser.
          </p>
        </div>

        {/* Font Size Selector */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <ALargeSmall size={20} className="text-[#00a884]" />
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">Message Font Size</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Adjust chat readability: {draftSettings.fontSize?.toFixed(1) || '14.5'}px</p>
            </div>
          </div>
          <div className="px-1 flex items-center gap-3">
            <span className="text-[calc(var(--msg-font-size)-3.5px)] text-secondary font-bold">A</span>
            <input
              type="range"
              min="12"
              max="24"
              step="0.5"
              value={draftSettings.fontSize || 14.5}
              onChange={(e) => setDraftSettings({ ...draftSettings, fontSize: parseFloat(e.target.value) })}
              className="flex-1 h-1.5 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg appearance-none cursor-pointer accent-[#00a884]"
            />
            <span className="text-[calc(var(--msg-font-size)+3.5px)] text-secondary font-bold">A</span>
          </div>
        </div>

        <div className="h-[1px] bg-gray-200 dark:bg-gray-800" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.theme === 'light' ? <Sun size={20} className="text-[#00a884]" /> : <Moon size={20} className="text-[#00a884]" />}
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">App Theme</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Current: {settings.theme === 'light' ? 'Light' : 'Dark'}</p>
            </div>
          </div>
          <button
            onClick={() => setDraftSettings({ ...draftSettings, theme: draftSettings.theme === 'light' ? 'dark' : 'light' })}
            className="text-[calc(var(--msg-font-size)-1.5px)] text-[#00a884] font-medium uppercase hover:bg-black/10 px-2 py-1 rounded transition-colors"
          >
            Change
          </button>
        </div>

        {/* Model Selection */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-[#00a884]" />
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">AI Model</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Select the Gemini engine</p>
            </div>
          </div>
          <div className="ml-[32px]">
            <select
              value={draftSettings.selectedModel || 'gemini-3-flash-preview'}
              onChange={(e) => setDraftSettings({ ...draftSettings, selectedModel: e.target.value })}
              className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none focus:border-[#00a884] transition-all cursor-pointer appearance-none"
            >
              {AVAILABLE_MODELS.map(model => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {draftSettings.shareUserInfo ? <ShieldCheck size={20} className="text-[#00a884]" /> : <ShieldAlert size={20} className="text-red-400" />}
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">Share AI Context</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Let personas see your bio</p>
            </div>
          </div>
          <div
            onClick={() => setDraftSettings({ ...draftSettings, shareUserInfo: !draftSettings.shareUserInfo })}
            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${draftSettings.shareUserInfo ? 'bg-[#00a884]' : 'bg-gray-400'}`}
          >
            <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${draftSettings.shareUserInfo ? 'left-[22px]' : 'left-[2px]'}`} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {draftSettings.shareTimeContext !== false ? <Clock size={20} className="text-[#00a884]" /> : <Clock size={20} className="text-gray-400" />}
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">Share Time & Date</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">AI knows current system time</p>
            </div>
          </div>
          <div
            onClick={() => setDraftSettings({ ...draftSettings, shareTimeContext: draftSettings.shareTimeContext === false ? true : false })}
            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${draftSettings.shareTimeContext !== false ? 'bg-[#00a884]' : 'bg-gray-400'}`}
          >
            <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${draftSettings.shareTimeContext !== false ? 'left-[22px]' : 'left-[2px]'}`} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays size={20} className={draftSettings.shareCalendarNotes ? "text-[#00a884]" : "text-gray-400"} />
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">Share Calendar Notes</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">AI accesses your custom notes</p>
            </div>
          </div>
          <div
            onClick={() => setDraftSettings({ ...draftSettings, shareCalendarNotes: !draftSettings.shareCalendarNotes })}
            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${draftSettings.shareCalendarNotes ? 'bg-[#00a884]' : 'bg-gray-400'}`}
          >
            <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${draftSettings.shareCalendarNotes ? 'left-[22px]' : 'left-[2px]'}`} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe size={20} className={draftSettings.useSearchGrounding ? "text-[#00a884]" : "text-gray-400"} />
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">Google Search</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">AI grounds itself with live web access</p>
            </div>
          </div>
          <div
            onClick={() => setDraftSettings({ ...draftSettings, useSearchGrounding: !draftSettings.useSearchGrounding })}
            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${draftSettings.useSearchGrounding ? 'bg-[#00a884]' : 'bg-gray-400'}`}
          >
            <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${draftSettings.useSearchGrounding ? 'left-[22px]' : 'left-[2px]'}`} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell size={20} className={draftSettings.enableNotifications ? "text-[#00a884]" : "text-gray-400"} />
              <div>
                <p className="text-[length:var(--msg-font-size)] font-medium">Desktop Notifications</p>
                <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Get notified of background messages</p>
              </div>
            </div>
            <div
              onClick={async () => {
                if (!draftSettings.enableNotifications) {
                  if (Notification.permission === 'default') {
                    const perm = await Notification.requestPermission();
                    if (perm === 'granted') {
                      setDraftSettings({ ...draftSettings, enableNotifications: true });
                    }
                  } else if (Notification.permission === 'granted') {
                    setDraftSettings({ ...draftSettings, enableNotifications: true });
                  }
                } else {
                  setDraftSettings({ ...draftSettings, enableNotifications: false });
                }
              }}
              className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${draftSettings.enableNotifications ? 'bg-[#00a884]' : 'bg-gray-400'}`}
            >
              <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${draftSettings.enableNotifications ? 'left-[22px]' : 'left-[2px]'}`} />
            </div>
          </div>
          {draftSettings.enableNotifications && (
            <button
              onClick={async () => {
                const title = 'Wassap Verified';
                const options = { 
                  body: 'Desktop and Mobile Drawer notifications are fully working!',
                  icon: '/favicon.svg',
                  badge: '/favicon.svg',
                  tag: 'test-notification'
                };

                // Try Service Worker first
                if ('serviceWorker' in navigator) {
                  try {
                    const reg = await navigator.serviceWorker.ready;
                    if (reg && reg.showNotification) {
                      reg.showNotification(title, options);
                      return;
                    }
                  } catch (e) { console.error("SW test failed", e); }
                }

                // Fallback to standard
                if ('Notification' in window && Notification.permission === 'granted') {
                  const n = new Notification(title, options);
                  setTimeout(() => n.close(), 6000);
                } else {
                  alert('Your browser is currently blocking notifications from this site. Please click the lock icon in the URL bar and allow notifications.');
                }
              }}
              className="w-full text-[calc(var(--msg-font-size)-2.5px)] py-1.5 bg-[#00a884]/10 text-[#00a884] font-medium rounded mt-1 hover:bg-[#00a884]/20 transition-colors uppercase tracking-tight"
            >
              Send Test Notification
            </button>
          )}
        </div>
      </div>

      <div className="p-4 border-t app-border bg-white dark:bg-[#111b21] rounded-b-lg shrink-0 space-y-3">
        <button
          onClick={handleSave}
          className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-medium py-2.5 rounded-lg transition-colors shadow-sm active:scale-[0.98]"
        >
          Save Settings
        </button>
        <div className="text-[calc(var(--msg-font-size)-3.5px)] text-secondary text-center italic">
          Changes will apply instantly after saving.
        </div>
      </div>
    </div>
  );
};
