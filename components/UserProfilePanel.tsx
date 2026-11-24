import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, Link as LinkIcon, Save, Globe, Check, Cloud, Lock, Unlock, Trash2, Download, RefreshCw, Loader2, Plus, Calendar, AlertCircle, FileText } from 'lucide-react';
import { UserProfile, Chat, AppSettings } from '../types';
import { listCloudSlots, saveCloudSlot, restoreCloudSlot, deleteCloudSlot, CloudSlot } from '../services/cloudBackup';
import { triggerHaptic } from '../utils/haptics';

interface UserProfilePanelProps {
  user: UserProfile;
  chats?: Chat[];
  settings?: AppSettings;
  onClose: () => void;
  onUpdate: (user: UserProfile) => void;
  onRestoreState?: (restoredChats: Chat[], restoredSettings?: AppSettings, restoredUser?: UserProfile) => void;
}

export const UserProfilePanel: React.FC<UserProfilePanelProps> = ({
  user,
  chats = [],
  settings,
  onClose,
  onUpdate,
  onRestoreState
}) => {
  const [formData, setFormData] = useState<UserProfile>({ ...user });
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState(user.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud Save State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(Boolean(settings?.isVertexUnlocked));
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [slots, setSlots] = useState<CloudSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSavingSlot, setIsSavingSlot] = useState(false);
  const [newSlotTitle, setNewSlotTitle] = useState('');
  const [showNewSlotInput, setShowNewSlotInput] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUrl = () => {
    if (urlValue) {
      setFormData(prev => ({ ...prev, avatar: urlValue }));
      setShowUrlInput(false);
    }
  };

  const handleSave = () => {
    onUpdate(formData);
    onClose();
  };

  // Load cloud slots when unlocked
  const loadSlots = async (codeToUse?: string) => {
    setIsLoadingSlots(true);
    setActionMessage(null);
    try {
      const result = await listCloudSlots(codeToUse || passcode);
      if (result.locked) {
        setIsUnlocked(false);
      } else {
        setIsUnlocked(true);
        setSlots(result.slots || []);
      }
    } catch (e: any) {
      console.warn('Error loading cloud slots:', e);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      void loadSlots();
    }
  }, [isUnlocked]);

  const handleUnlockCloudSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setPasscodeError('Please enter your passcode.');
      return;
    }
    setPasscodeError(null);
    setIsLoadingSlots(true);

    try {
      const res = await listCloudSlots(passcode.trim());
      if (res.locked || !res.ok) {
        setPasscodeError(res.error || 'Incorrect passcode. Please try again.');
        triggerHaptic('tap');
      } else {
        setIsUnlocked(true);
        setSlots(res.slots || []);
        triggerHaptic('send');
      }
    } catch (err: any) {
      setPasscodeError(err.message || 'Unlock failed');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleCreateSlot = async () => {
    const defaultTitle = `Progress Save · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    const title = newSlotTitle.trim() || defaultTitle;
    setIsSavingSlot(true);
    setActionMessage(null);

    try {
      const result = await saveCloudSlot(title, {
        chats,
        settings,
        userProfile: formData
      }, passcode);

      if (result.ok && result.slot) {
        setSlots(prev => [result.slot!, ...prev.filter(s => s.id !== result.slot!.id)]);
        setNewSlotTitle('');
        setShowNewSlotInput(false);
        setActionMessage(`Slot "${title}" saved successfully!`);
        triggerHaptic('send');
      } else {
        setActionMessage(result.error || 'Failed to save slot');
      }
    } catch (err: any) {
      setActionMessage(err.message || 'Error creating save slot');
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleRestoreSlot = async (slotId: string, slotTitle: string) => {
    if (!window.confirm(`Are you sure you want to restore "${slotTitle}"?\n\nThis will restore all chats, messages, and persona progress from this point in time.`)) {
      return;
    }

    setActionMessage(`Restoring slot "${slotTitle}"...`);
    try {
      const result = await restoreCloudSlot(slotId, passcode);
      if (result.ok && result.slotData?.payload) {
        const payload = result.slotData.payload;
        onRestoreState?.(payload.chats, payload.settings, payload.userProfile);
        triggerHaptic('send');
        alert(`Slot "${slotTitle}" restored successfully!`);
      } else {
        setActionMessage(result.error || 'Failed to restore slot');
      }
    } catch (err: any) {
      setActionMessage(err.message || 'Error restoring slot');
    }
  };

  const handleDeleteSlot = async (slotId: string, slotTitle: string) => {
    if (!window.confirm(`Delete backup slot "${slotTitle}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteCloudSlot(slotId, passcode);
      setSlots(prev => prev.filter(s => s.id !== slotId));
      triggerHaptic('tap');
    } catch (err: any) {
      console.error('Delete slot error:', err);
    }
  };

  const labelClass = "text-[calc(var(--msg-font-size)-0.5px)] text-[#008069] font-medium block mb-1 uppercase tracking-tight";
  const inputClass = "w-full outline-none text-[calc(var(--msg-font-size)+1.5px)] border-b app-border focus:border-[#00a884] pb-1.5 transition-all bg-transparent text-primary py-1 font-normal";

  return (
    <div data-app-panel="Your profile" className="fixed inset-0 z-[3500] md:absolute md:inset-auto md:w-[440px] md:h-full md:left-[64px] md:top-0 md:bottom-0 md:z-50 app-header border-r app-border flex flex-col animate-in slide-in-from-left duration-300 shadow-xl overflow-hidden">
      <div className="h-[108px] pt-[max(env(safe-area-inset-top),16px)] bg-[#008069] flex items-end p-5 text-white shrink-0">
        <div className="flex items-center gap-6">
          <button data-panel-close onClick={onClose} className="p-1 rounded-full hover:bg-[#005c4b] active:scale-90 transition-all text-white" title="Back">
            <ArrowLeft size={22} />
          </button>
          <h2 className="text-[calc(var(--msg-font-size)+4.5px)] font-medium">Profile & Cloud Save</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar Section */}
        <div className="app-panel flex flex-col items-center py-7 shadow-sm border-b app-border relative overflow-hidden">
          <div className="relative group cursor-pointer mb-5">
            <img src={formData.avatar} alt="My Profile" className="w-40 h-40 rounded-full object-cover shadow-md border-4 border-white dark:border-[#222d34] bg-gray-50" />
            <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity gap-2">
              <div className="flex gap-4">
                <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center hover:text-[#00a884] cursor-pointer">
                  <Camera size={20} />
                  <span className="text-[calc(var(--msg-font-size)-4.5px)] uppercase font-bold mt-1">Upload</span>
                </div>
                <div onClick={() => setShowUrlInput(!showUrlInput)} className="flex flex-col items-center hover:text-[#00a884] cursor-pointer">
                  <LinkIcon size={20} />
                  <span className="text-[calc(var(--msg-font-size)-4.5px)] uppercase font-bold mt-1">Link</span>
                </div>
              </div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          {showUrlInput && (
            <div className="w-full px-10 mb-5">
              <div className="flex items-center gap-2 border-b border-[#00a884] pb-1">
                <Globe size={16} className="text-[#00a884] shrink-0" />
                <input
                  type="text"
                  className="flex-1 outline-none text-[calc(var(--msg-font-size)-0.5px)] bg-transparent text-primary px-1"
                  placeholder="Image URL..."
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyUrl()}
                />
                <button onClick={handleApplyUrl} className="text-[#00a884]"><Check size={18} /></button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Details Form */}
        <div className="mt-2 app-panel px-6 py-6 shadow-sm space-y-6 border-b app-border">
          <div>
            <label className={labelClass}>Your Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>About</label>
            <input
              type="text"
              value={formData.about}
              onChange={(e) => setFormData(prev => ({ ...prev, about: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <input
              type="text"
              placeholder="e.g. Busy, At the gym, Available"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className={inputClass}
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium bg-[#00a884] text-white hover:bg-[#005c4b] active:scale-95 shadow-sm transition-all text-[calc(var(--msg-font-size)-0.5px)]"
          >
            <Save size={16} />
            Save Profile Info
          </button>
        </div>

        {/* Cloud Save & State Slots Section */}
        <div className="mt-2 app-panel px-6 py-6 shadow-sm border-b app-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#00a884]/10 text-[#00a884] flex items-center justify-center shrink-0">
                <Cloud size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-primary">Cloud Save & Slots</h3>
                <p className="text-xs text-secondary">Password-protected state snapshots</p>
              </div>
            </div>

            {isUnlocked ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00a884] bg-[#00a884]/10 px-2 py-0.5 rounded-full">
                <Unlock size={11} /> Unlocked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
                <Lock size={11} /> Locked
              </span>
            )}
          </div>

          {!isUnlocked ? (
            <form onSubmit={handleUnlockCloudSave} className="space-y-3 pt-2">
              <p className="text-xs text-secondary leading-relaxed">
                Cloud Save is locked. Enter your member passkey to save, retrieve, and manage your progress slots.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="Enter passcode..."
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="flex-1 bg-[#f0f2f5] dark:bg-[#202c33] border app-border rounded-lg px-3 py-2 text-xs outline-none focus:border-[#00a884] text-primary"
                />
                <button
                  type="submit"
                  disabled={isLoadingSlots}
                  className="px-4 py-2 bg-[#00a884] hover:bg-[#005c4b] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isLoadingSlots ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                  Unlock
                </button>
              </div>
              {passcodeError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={13} /> {passcodeError}
                </p>
              )}
            </form>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-secondary">
                  Save entire app state (all messages, personas, memories) to a slot.
                </p>
                <button
                  type="button"
                  onClick={() => void loadSlots()}
                  disabled={isLoadingSlots}
                  className="p-1.5 text-secondary hover:text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  title="Refresh slots"
                >
                  <RefreshCw size={13} className={isLoadingSlots ? 'animate-spin' : ''} />
                </button>
              </div>

              {actionMessage && (
                <div className="p-2.5 rounded-lg bg-[#00a884]/10 text-xs text-[#00a884] font-medium flex items-center gap-1.5">
                  <Check size={14} /> {actionMessage}
                </div>
              )}

              {/* Create Slot Action */}
              {showNewSlotInput ? (
                <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg border app-border space-y-2 animate-in fade-in duration-150">
                  <label className="text-[11px] uppercase font-bold text-secondary block">Slot Title / Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Chapter 3, Before Reset, Kyoto Trip"
                    value={newSlotTitle}
                    onChange={(e) => setNewSlotTitle(e.target.value)}
                    className="w-full bg-white dark:bg-[#111b21] border app-border rounded px-2.5 py-1.5 text-xs text-primary outline-none focus:border-[#00a884]"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewSlotInput(false)}
                      className="px-2.5 py-1 text-xs text-secondary hover:text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingSlot}
                      onClick={handleCreateSlot}
                      className="px-3 py-1 bg-[#00a884] text-white text-xs font-semibold rounded hover:bg-[#005c4b] transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {isSavingSlot ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save Current State
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewSlotInput(true)}
                  className="w-full py-2.5 border border-dashed border-[#00a884] text-[#00a884] hover:bg-[#00a884]/5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus size={14} /> Save Current State to New Slot
                </button>
              )}

              {/* Slots List */}
              <div className="space-y-2 pt-1">
                {isLoadingSlots && slots.length === 0 ? (
                  <div className="py-6 text-center text-xs text-secondary flex items-center justify-center gap-2">
                    <Loader2 size={15} className="animate-spin text-[#00a884]" /> Loading cloud slots...
                  </div>
                ) : slots.length === 0 ? (
                  <div className="py-6 text-center text-xs text-secondary border app-border rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
                    No cloud save slots found. Click "Save Current State" above to make your first backup!
                  </div>
                ) : (
                  slots.map((slot) => {
                    let dateFormatted = 'Recently';
                    try {
                      const d = new Date(slot.updatedAt || slot.createdAt);
                      if (!isNaN(d.getTime())) {
                        dateFormatted = d.toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      }
                    } catch {
                      dateFormatted = 'Recently';
                    }

                    return (
                      <div
                        key={slot.id}
                        className="p-3 bg-[#f0f2f5]/80 dark:bg-[#202c33]/80 hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] rounded-lg border app-border transition-colors space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold text-xs text-primary block truncate max-w-[240px]">
                              {slot.title}
                            </span>
                            <span className="text-[10px] text-secondary flex items-center gap-1 mt-0.5">
                              <Calendar size={10} /> {dateFormatted}
                            </span>
                          </div>

                          <span className="text-[10px] font-medium text-secondary bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full shrink-0">
                            {slot.chatCount} chats · {slot.messageCount} msgs
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-black/5 dark:border-white/5">
                          <button
                            type="button"
                            onClick={() => handleRestoreSlot(slot.id, slot.title)}
                            className="px-2.5 py-1 bg-[#00a884]/10 hover:bg-[#00a884]/20 text-[#00a884] text-[11px] font-semibold rounded transition-colors flex items-center gap-1"
                            title="Restore this saved state"
                          >
                            <RefreshCw size={11} /> Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot.id, slot.title)}
                            className="p-1 text-secondary hover:text-red-500 rounded transition-colors"
                            title="Delete slot"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
