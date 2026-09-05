import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, ShieldCheck, ShieldAlert, X, Key, Eye, EyeOff, Clock, CalendarDays, Sparkles, Globe, Bell, ALargeSmall, Cloud, Check, AlertCircle, Image as ImageIcon, Upload, RotateCcw, Lock, Unlock, HelpCircle, Smartphone, RotateCw, Camera } from 'lucide-react';
import { AppSettings, AiProvider } from '../types';
import { AVAILABLE_MODELS, AVAILABLE_IMAGE_MODELS, GCP_CONFIG, DEFAULT_MODEL, DEFAULT_IMAGE_MODEL, WALLPAPER_PRESETS, VERTEX_PASSCODE, VERTEX_PASSCODE_HINT } from '../constants';
import { compressWallpaperImage } from '../utils/imageCompressor';
import { checkVertexConnectionStatus } from '../services/geminiService';
import { getLocalDateKey } from '../utils/dates';

interface SettingsPopoverProps {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  onClose: () => void;
  onTestNotification?: () => void;
}

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({ settings, onUpdate, onClose, onTestNotification }) => {
  const [showKey, setShowKey] = useState(false);
  const [passcodeDraft, setPasscodeDraft] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [showPasscodeHint, setShowPasscodeHint] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftSettings, setDraftSettings] = useState<AppSettings>({
    ...settings,
    aiProvider: settings.aiProvider || 'vertex',
    chatWallpaper: settings.chatWallpaper || 'default',
    chatWallpaperOpacity: settings.chatWallpaperOpacity ?? 0.85,
    isVertexUnlocked: settings.isVertexUnlocked ?? false,
  });
  const [testingVertex, setTestingVertex] = useState(false);
  const [vertexTestResult, setVertexTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [, setTicker] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTicker(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const effectiveTimeMode = draftSettings.timeMode || 'device';
  const effectiveOffset = draftSettings.customTimeOffsetMs || 0;
  const currentAppDate = new Date(Date.now() + (effectiveTimeMode === 'custom' ? effectiveOffset : 0));
  const digitalClockStr = currentAppDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const digitalDateStr = currentAppDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const inputDateVal = getLocalDateKey(currentAppDate);
  const inputTimeVal = currentAppDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const handleSetDeviceTime = () => {
    const updated: AppSettings = {
      ...draftSettings,
      timeMode: 'device',
      customTimeOffsetMs: 0,
    };
    setDraftSettings(updated);
    onUpdate(updated);
  };

  const handleSetCustomTimeMode = () => {
    const updated: AppSettings = {
      ...draftSettings,
      timeMode: 'custom',
      customTimeOffsetMs: draftSettings.customTimeOffsetMs ?? 0,
    };
    setDraftSettings(updated);
    onUpdate(updated);
  };

  const handleCustomDateTimeChange = (newDateStr: string, newTimeStr: string) => {
    try {
      if (!newDateStr || !newTimeStr) return;
      const [year, month, day] = newDateStr.split('-').map(Number);
      const [hours, minutes] = newTimeStr.split(':').map(Number);
      const targetDate = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
      if (!isNaN(targetDate.getTime())) {
        const offset = targetDate.getTime() - Date.now();
        const updated: AppSettings = {
          ...draftSettings,
          timeMode: 'custom',
          customTimeOffsetMs: offset,
        };
        setDraftSettings(updated);
        onUpdate(updated);
      }
    } catch (e) {
      console.warn("Invalid date/time inputs:", e);
    }
  };

  const handleTestVertex = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingVertex(true);
    setVertexTestResult(null);
    try {
      const res = await checkVertexConnectionStatus();
      if (res.ok) {
        const credDesc = res.hasCredentials ? `Credentials: ${res.credentialsType || 'Detected'}` : 'Warning: No GCP service key detected';
        setVertexTestResult({
          ok: true,
          message: `Connected to ${res.platform || 'Cloud Serverless'}. ${credDesc}`,
        });
      } else {
        setVertexTestResult({
          ok: false,
          message: res.error || 'Connection failed',
        });
      }
    } catch (err: any) {
      setVertexTestResult({
        ok: false,
        message: err.message || 'Unable to contact backend endpoint',
      });
    } finally {
      setTestingVertex(false);
    }
  };

  const handleUnlockVertex = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passcodeDraft.trim() === VERTEX_PASSCODE) {
      const updated: AppSettings = {
        ...draftSettings,
        isVertexUnlocked: true,
        aiProvider: 'vertex',
      };
      setDraftSettings(updated);
      setPasscodeError(null);
      setPasscodeDraft('');
      setShowPasscodeHint(false);
      onUpdate(updated);
    } else {
      setPasscodeError("Incorrect password. Please try again.");
    }
  };

  const handleLockVertex = (e: React.MouseEvent) => {
    e.stopPropagation();
    const updated: AppSettings = {
      ...draftSettings,
      isVertexUnlocked: false,
    };
    setDraftSettings(updated);
    setPasscodeError(null);
    onUpdate(updated);
  };

  const handleToggleTheme = () => {
    const nextTheme = draftSettings.theme === 'light' ? 'dark' : 'light';
    const updated = { ...draftSettings, theme: nextTheme };
    setDraftSettings(updated);

    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    onUpdate(updated);
  };

  const handleSelectWallpaper = (url: string) => {
    const updated = {
      ...draftSettings,
      chatWallpaper: url,
      chatWallpaperOpacity: draftSettings.chatWallpaperOpacity ?? 0.85,
    };
    setDraftSettings(updated);
    onUpdate(updated);
  };

  const handleUploadWallpaper = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressWallpaperImage(file);
      const updated = {
        ...draftSettings,
        chatWallpaper: dataUrl,
        chatWallpaperOpacity: draftSettings.chatWallpaperOpacity ?? 0.85,
      };
      setDraftSettings(updated);
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to compress wallpaper:", err);
    }
  };

  const handleResetWallpaper = () => {
    const updated = {
      ...draftSettings,
      chatWallpaper: 'default',
      chatWallpaperOpacity: 0.85,
    };
    setDraftSettings(updated);
    onUpdate(updated);
  };

  const handleOpacityChange = (opacity: number) => {
    const updated = { ...draftSettings, chatWallpaperOpacity: opacity };
    setDraftSettings(updated);
    onUpdate(updated);
  };

  const handleSave = () => {
    onUpdate(draftSettings);
    onClose();
  };

  const currentProvider: AiProvider = draftSettings.aiProvider || 'vertex';
  const currentWallpaper = draftSettings.chatWallpaper || 'default';
  const isPreset = WALLPAPER_PRESETS.some(p => p.url === currentWallpaper);
  const isUploadedCustom = currentWallpaper !== 'default' && !isPreset;

  return (
    <div className="absolute left-0 md:left-[80px] bottom-0 md:bottom-20 w-full md:w-[340px] h-[calc(100%-80px)] md:h-auto max-h-[calc(100vh-140px)] app-panel md:rounded-lg shadow-2xl border app-border z-[1000] animate-in slide-in-from-bottom-2 duration-200 flex flex-col text-primary">
      <div className="p-4 border-b app-border flex justify-between items-center app-header shrink-0">
        <h3 className="font-medium text-[calc(var(--msg-font-size)+1.5px)]">Settings</h3>
        <X size={18} className="text-secondary cursor-pointer hover:bg-black/5 rounded-full" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {/* Dual AI Provider Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Cloud size={20} className="text-[#00a884]" />
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">AI Provider & Credits</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Choose how AI responses are powered</p>
            </div>
          </div>

          {/* Provider Selection Cards */}
          <div className="space-y-2">
            {/* Option A: Built-in / Server Credits (Vertex AI) */}
            <div
              onClick={() => {
                const updated = { ...draftSettings, aiProvider: 'vertex' as const };
                setDraftSettings(updated);
                onUpdate(updated);
              }}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                currentProvider === 'vertex'
                  ? 'border-[#00a884] bg-[#00a884]/10 dark:bg-[#00a884]/15'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-black/[0.02] dark:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    currentProvider === 'vertex' ? 'border-[#00a884] bg-[#00a884]' : 'border-gray-400'
                  }`}>
                    {currentProvider === 'vertex' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-[calc(var(--msg-font-size)-1px)] font-medium">Built-in Cloud (Vertex AI)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {draftSettings.isVertexUnlocked ? (
                    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#00a884]/20 text-[#00a884] flex items-center gap-1">
                      <Unlock size={10} /> Unlocked
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Lock size={10} /> Locked
                    </span>
                  )}
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#00a884]/20 text-[#00a884]">
                    Default
                  </span>
                </div>
              </div>
              <p className="text-[calc(var(--msg-font-size)-3px)] text-secondary mt-1.5 ml-6">
                Uses our server credits. Protected behind password.
              </p>

              {/* If Unlocked: Show Active Cloud Details & Option to Re-lock */}
              {draftSettings.isVertexUnlocked ? (
                currentProvider === 'vertex' && (
                  <div className="mt-2.5 ml-6 p-2 rounded bg-black/[0.03] dark:bg-white/[0.04] border border-[#00a884]/30 text-[11px] space-y-1 text-secondary animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[#00a884] font-medium">
                        <Check size={12} />
                        <span>Google Cloud Vertex AI Active</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleLockVertex}
                        className="text-[10px] text-secondary hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        title="Lock Built-in Cloud"
                      >
                        <Lock size={10} /> Lock
                      </button>
                    </div>
                    <div>Project: <span className="font-mono text-primary font-medium">{GCP_CONFIG.projectId}</span></div>
                    <div>Location: <span className="font-mono text-primary">{GCP_CONFIG.defaultRegion}</span></div>

                    <div className="pt-1.5 flex items-center justify-between border-t border-black/5 dark:border-white/5">
                      <button
                        type="button"
                        onClick={handleTestVertex}
                        disabled={testingVertex}
                        className="text-[10.5px] font-medium text-[#00a884] hover:underline flex items-center gap-1 disabled:opacity-50"
                      >
                        {testingVertex ? 'Verifying Cloud Connection...' : '⚡ Verify Cloud Connection'}
                      </button>
                    </div>
                    {vertexTestResult && (
                      <div className={`text-[10px] p-1.5 rounded leading-tight ${vertexTestResult.ok ? 'bg-[#00a884]/15 text-[#00a884]' : 'bg-red-500/15 text-red-500'}`}>
                        {vertexTestResult.message}
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* If Locked: Show Passcode Input & Hint */
                <div 
                  className="mt-2.5 ml-6 p-2.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-[11px] space-y-2 animate-in fade-in duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                    <Lock size={13} />
                    <span>Enter password to unlock Built-in Cloud:</span>
                  </div>

                  <form onSubmit={handleUnlockVertex} className="space-y-2">
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type={showPasscode ? "text" : "password"}
                          value={passcodeDraft}
                          onChange={(e) => {
                            setPasscodeDraft(e.target.value);
                            if (passcodeError) setPasscodeError(null);
                          }}
                          placeholder="Enter password..."
                          className="w-full bg-white dark:bg-[#202c33] border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1 text-[calc(var(--msg-font-size)-2px)] outline-none focus:border-[#00a884] pr-7 font-mono text-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasscode(!showPasscode)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                          title={showPasscode ? "Hide password" : "Show password"}
                        >
                          {showPasscode ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-[#00a884] hover:bg-[#02906f] text-white rounded font-medium text-[11px] flex items-center gap-1 shrink-0 transition-colors shadow-sm"
                      >
                        <Unlock size={11} /> Unlock
                      </button>
                    </div>

                    {passcodeError && (
                      <div className="flex items-center gap-1 text-red-500 text-[10.5px]">
                        <AlertCircle size={11} className="shrink-0" />
                        <span>{passcodeError}</span>
                      </div>
                    )}

                    <div className="pt-0.5 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPasscodeHint(!showPasscodeHint)}
                        className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 self-start font-medium"
                      >
                        <HelpCircle size={12} />
                        {showPasscodeHint ? "Hide hint" : "Need a hint?"}
                      </button>

                      {showPasscodeHint && (
                        <div className="p-2 rounded bg-white/70 dark:bg-black/30 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200 animate-in fade-in duration-150">
                          <span className="font-semibold">Hint:</span> {VERTEX_PASSCODE_HINT}
                        </div>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Option B: Custom API Key (Gemini AI Studio) */}
            <div
              onClick={() => {
                const updated = { ...draftSettings, aiProvider: 'studio' as const };
                setDraftSettings(updated);
                onUpdate(updated);
              }}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                currentProvider === 'studio'
                  ? 'border-[#00a884] bg-[#00a884]/10 dark:bg-[#00a884]/15'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-black/[0.02] dark:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    currentProvider === 'studio' ? 'border-[#00a884] bg-[#00a884]' : 'border-gray-400'
                  }`}>
                    {currentProvider === 'studio' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-[calc(var(--msg-font-size)-1px)] font-medium">Custom API Key (AI Studio)</span>
                </div>
                <Key size={14} className="text-secondary" />
              </div>
              <p className="text-[calc(var(--msg-font-size)-3px)] text-secondary mt-1.5 ml-6">
                Use your personal Google Gemini AI Studio API key.
              </p>
            </div>
          </div>

          {/* Custom API Key Input Field (shown when Custom API Key is selected) */}
          {currentProvider === 'studio' && (
            <div className="pt-1 space-y-2 animate-in fade-in duration-150">
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={draftSettings.apiKey || ''}
                  onChange={(e) => setDraftSettings({ ...draftSettings, apiKey: e.target.value })}
                  placeholder="Paste your Gemini AI Studio API key..."
                  className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none focus:border-[#00a884] transition-all pr-10 font-mono"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
                  title={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {!draftSettings.apiKey?.trim() ? (
                <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 text-[calc(var(--msg-font-size)-3.5px)]">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>Please enter your Gemini AI Studio key to chat in custom mode.</span>
                </div>
              ) : (
                <p className="text-[calc(var(--msg-font-size)-3.5px)] text-secondary leading-tight">
                  Independent mode: Keys are stored securely in your browser localStorage.
                </p>
              )}
            </div>
          )}
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
            {draftSettings.theme === 'light' ? (
              <Sun size={20} className="text-amber-500" />
            ) : (
              <Moon size={20} className="text-[#00a884]" />
            )}
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">App Theme</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">
                {draftSettings.theme === 'light' ? 'Light Mode' : 'Dark Mode'}
              </p>
            </div>
          </div>
          <div
            onClick={handleToggleTheme}
            className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors p-0.5 flex items-center ${
              draftSettings.theme === 'dark' ? 'bg-[#00a884]' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            title="Toggle Light/Dark Theme"
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transition-all flex items-center justify-center transform ${
                draftSettings.theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
              }`}
            >
              {draftSettings.theme === 'dark' ? (
                <Moon size={11} className="text-[#00a884]" />
              ) : (
                <Sun size={11} className="text-amber-500" />
              )}
            </div>
          </div>
        </div>

        <div className="h-[1px] bg-gray-200 dark:bg-gray-800" />

        {/* Chat Wallpaper Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ImageIcon size={20} className="text-[#00a884]" />
              <div>
                <p className="text-[length:var(--msg-font-size)] font-medium">Chat Wallpaper</p>
                <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">
                  {currentWallpaper === 'default' ? 'Classic WhatsApp Doodle' : 'Custom Background Active'}
                </p>
              </div>
            </div>
            {currentWallpaper !== 'default' && (
              <button
                onClick={handleResetWallpaper}
                className="flex items-center gap-1 text-[calc(var(--msg-font-size)-3px)] text-secondary hover:text-[#00a884] transition-colors cursor-pointer"
                title="Reset to WhatsApp Doodle"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Wallpaper Selection Grid */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {/* WhatsApp Doodle Preset */}
            <div
              onClick={() => handleSelectWallpaper('default')}
              className={`relative h-14 rounded-lg border cursor-pointer overflow-hidden transition-all flex flex-col items-center justify-center p-1 ${
                currentWallpaper === 'default'
                  ? 'border-[#00a884] ring-2 ring-[#00a884]/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } bg-[#efeae2] dark:bg-[#0b141a]`}
              title="Classic WhatsApp Doodle"
            >
              <div className="w-full h-full opacity-40 bg-[url('/images/light.png')] dark:bg-[url('/images/dark.png')] bg-repeat bg-[length:120px]" />
              <span className="absolute bottom-1 text-[9px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded shadow">
                Default
              </span>
              {currentWallpaper === 'default' && (
                <div className="absolute top-1 right-1 bg-[#00a884] text-white rounded-full p-0.5 shadow">
                  <Check size={10} />
                </div>
              )}
            </div>

            {/* Presets */}
            {WALLPAPER_PRESETS.filter(p => p.id !== 'default').slice(0, 4).map(preset => {
              const isSelected = currentWallpaper === preset.url;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectWallpaper(preset.url)}
                  className={`relative h-14 rounded-lg border cursor-pointer overflow-hidden transition-all ${
                    isSelected
                      ? 'border-[#00a884] ring-2 ring-[#00a884]/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  style={{
                    backgroundImage: `url(${preset.url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                  title={preset.name}
                >
                  <span className="absolute bottom-1 left-1 right-1 text-center truncate text-[9px] font-medium bg-black/60 text-white px-1 py-0.5 rounded shadow">
                    {preset.name}
                  </span>
                  {isSelected && (
                    <div className="absolute top-1 right-1 bg-[#00a884] text-white rounded-full p-0.5 shadow">
                      <Check size={10} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Upload Custom Wallpaper Button */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative h-14 rounded-lg border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-1 transition-all ${
                isUploadedCustom
                  ? 'border-[#00a884] bg-[#00a884]/10'
                  : 'border-gray-300 dark:border-gray-700 hover:border-[#00a884] hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
              }`}
              style={isUploadedCustom ? {
                backgroundImage: `url(${currentWallpaper})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : undefined}
              title="Upload custom background image"
            >
              {!isUploadedCustom ? (
                <>
                  <Upload size={14} className="text-secondary" />
                  <span className="text-[10px] font-medium text-secondary">Custom</span>
                </>
              ) : (
                <>
                  <span className="absolute bottom-1 left-1 right-1 text-center truncate text-[9px] font-medium bg-black/60 text-white px-1 py-0.5 rounded shadow">
                    Custom Image
                  </span>
                  <div className="absolute top-1 right-1 bg-[#00a884] text-white rounded-full p-0.5 shadow">
                    <Check size={10} />
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadWallpaper}
                className="hidden"
              />
            </div>
          </div>

          {/* Opacity slider for custom wallpapers */}
          {currentWallpaper !== 'default' && (
            <div className="space-y-1.5 pt-1 animate-in fade-in duration-150">
              <div className="flex justify-between text-[calc(var(--msg-font-size)-3px)] text-secondary">
                <span>Wallpaper Opacity</span>
                <span className="font-mono">{Math.round((draftSettings.chatWallpaperOpacity ?? 0.85) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={draftSettings.chatWallpaperOpacity ?? 0.85}
                onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg appearance-none cursor-pointer accent-[#00a884]"
              />
            </div>
          )}
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
              value={draftSettings.selectedModel || DEFAULT_MODEL}
              onChange={(e) => setDraftSettings({ ...draftSettings, selectedModel: e.target.value })}
              className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none focus:border-[#00a884] transition-all cursor-pointer appearance-none"
            >
              {AVAILABLE_MODELS.map(model => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Image Generation Model Selection */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Camera size={20} className="text-[#00a884]" />
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">Image Generation Model</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Engine for @img photo generation</p>
            </div>
          </div>
          <div className="ml-[32px]">
            <select
              value={draftSettings.selectedImageModel || DEFAULT_IMAGE_MODEL}
              onChange={(e) => setDraftSettings({ ...draftSettings, selectedImageModel: e.target.value })}
              className="w-full bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-[calc(var(--msg-font-size)-1.5px)] outline-none focus:border-[#00a884] transition-all cursor-pointer appearance-none"
            >
              {AVAILABLE_IMAGE_MODELS.map(model => (
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

        {/* In-App Clock & Time Configuration */}
        <div className="p-3.5 rounded-xl border app-border bg-[#f0f2f5]/70 dark:bg-[#202c33]/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#00a884]" />
              <span className="text-[calc(var(--msg-font-size)-0.5px)] font-semibold text-primary">In-App Clock & Time</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1.5 ${
              effectiveTimeMode === 'device' 
                ? 'bg-[#00a884]/15 text-[#00a884] dark:bg-[#00a884]/25' 
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 dark:bg-amber-500/25'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${effectiveTimeMode === 'device' ? 'bg-[#00a884] animate-pulse' : 'bg-amber-500'}`} />
              {effectiveTimeMode === 'device' ? 'Device Synced' : 'Custom Virtual Time'}
            </span>
          </div>

          {/* Live Digital Display */}
          <div className="p-3 bg-white dark:bg-[#111b21] rounded-lg border app-border shadow-xs text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-mono font-bold tracking-wider text-primary">
              {digitalClockStr}
            </div>
            <div className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary font-medium mt-0.5">
              {digitalDateStr}
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-[#111b21] rounded-lg border app-border">
            <button
              type="button"
              onClick={handleSetDeviceTime}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[calc(var(--msg-font-size)-2px)] font-medium transition-all cursor-pointer ${
                effectiveTimeMode === 'device'
                  ? 'bg-[#00a884] text-white shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Smartphone size={14} />
              Device Time
            </button>
            <button
              type="button"
              onClick={handleSetCustomTimeMode}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[calc(var(--msg-font-size)-2px)] font-medium transition-all cursor-pointer ${
                effectiveTimeMode === 'custom'
                  ? 'bg-[#00a884] text-white shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Clock size={14} />
              Custom Time
            </button>
          </div>

          {/* Custom Date & Time Controls */}
          {effectiveTimeMode === 'custom' && (
            <div className="space-y-2.5 pt-1.5 border-t app-border">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Virtual Date</label>
                  <input
                    type="date"
                    value={inputDateVal}
                    onChange={(e) => handleCustomDateTimeChange(e.target.value, inputTimeVal)}
                    className="w-full text-[calc(var(--msg-font-size)-2px)] bg-white dark:bg-[#111b21] border app-border rounded-md px-2 py-1.5 text-primary focus:outline-none focus:border-[#00a884]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Virtual Time (24h)</label>
                  <input
                    type="time"
                    value={inputTimeVal}
                    onChange={(e) => handleCustomDateTimeChange(inputDateVal, e.target.value)}
                    className="w-full text-[calc(var(--msg-font-size)-2px)] bg-white dark:bg-[#111b21] border app-border rounded-md px-2 py-1.5 text-primary focus:outline-none focus:border-[#00a884]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[calc(var(--msg-font-size)-3.5px)] text-secondary italic">
                  Virtual clock advances second-by-second.
                </p>
                <button
                  type="button"
                  onClick={handleSetDeviceTime}
                  className="flex items-center gap-1 text-[calc(var(--msg-font-size)-2.5px)] text-[#00a884] hover:underline font-medium shrink-0 ml-2 cursor-pointer"
                >
                  <RotateCw size={12} />
                  Reset to Device
                </button>
              </div>
            </div>
          )}
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

        <div className="h-[1px] bg-gray-200 dark:bg-gray-800" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={20} className={draftSettings.enableTextStacking !== false ? "text-[#00a884]" : "text-gray-400"} />
            <div>
              <p className="text-[length:var(--msg-font-size)] font-medium">Message Stacking</p>
              <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Wait for follow-ups before replying</p>
            </div>
          </div>
          <div
            onClick={() => setDraftSettings({ ...draftSettings, enableTextStacking: draftSettings.enableTextStacking === false ? true : false })}
            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${draftSettings.enableTextStacking !== false ? 'bg-[#00a884]' : 'bg-gray-400'}`}
          >
            <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${draftSettings.enableTextStacking !== false ? 'left-[22px]' : 'left-[2px]'}`} />
          </div>
        </div>

        {draftSettings.enableTextStacking !== false && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-[#00a884] opacity-0" />
              <div>
                <p className="text-[length:var(--msg-font-size)] font-medium">Stacking Delay</p>
                <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Delay: {draftSettings.textStackingDelay || 10} seconds</p>
              </div>
            </div>
            <div className="px-1 flex items-center gap-3">
              <span className="text-[calc(var(--msg-font-size)-3px)] text-secondary font-bold">5s</span>
              <input
                type="range"
                min="5"
                max="30"
                step="1"
                value={draftSettings.textStackingDelay || 10}
                onChange={(e) => setDraftSettings({ ...draftSettings, textStackingDelay: parseInt(e.target.value, 10) })}
                className="flex-1 h-1.5 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg appearance-none cursor-pointer accent-[#00a884]"
              />
              <span className="text-[calc(var(--msg-font-size)-3px)] text-secondary font-bold">30s</span>
            </div>
          </div>
        )}

        <div className="h-[1px] bg-gray-200 dark:bg-gray-800" />

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
                if (onTestNotification) {
                  onTestNotification();
                } else {
                  if ('Notification' in window && Notification.permission !== 'granted') {
                    await Notification.requestPermission();
                  }
                  const title = 'Wassap Verified';
                  const options = { 
                    body: 'Desktop and Mobile notifications are fully working!',
                    icon: '/favicon.svg',
                    badge: '/badge.svg',
                    tag: 'test-notification'
                  };
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(title, options);
                  }
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
