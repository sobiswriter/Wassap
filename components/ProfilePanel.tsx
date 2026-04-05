import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Link as LinkIcon, Save, Info, Globe, Check, 
  Users, Trash2, Eraser, Settings, ChevronDown, ChevronRight, 
  Plus, Clock, RefreshCw, UserX 
} from 'lucide-react';
import { Chat, Message } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface ProfilePanelProps {
  chat: Chat;
  allChats: Chat[];
  onClose: () => void;
  onUpdate: (updates: Partial<Chat>) => void;
  onDeleteChat?: () => void;
  onClearChat?: () => void;
  onRefreshPersona: (chatId: string) => void;
  onTestAutomation?: (chatId: string, testType: 'inactivity' | 'time', contextOverride?: string) => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ 
  chat, allChats, onClose, onUpdate, onDeleteChat, onClearChat, onRefreshPersona, onTestAutomation 
}) => {
  const [formData, setFormData] = useState({
    name: chat.name,
    about: chat.about || (chat.isGroup ? 'Group Description' : 'Hey there! I am using WhatsApp.'),
    role: chat.role || '',
    speechStyle: chat.speechStyle || '',
    systemInstruction: chat.systemInstruction || '',
    avatar: chat.avatar,
    automation: chat.automation || {
      enabled: false,
      timeTriggers: [],
      inactivity: { enabled: false, hours: 6, minutes: 0, seconds: 0 }
    }
    // Handle migration for old saved data
    // Delete minHours/maxHours if they exist
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState(chat.avatar);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData({
      name: chat.name,
      about: chat.about || (chat.isGroup ? 'Group Description' : 'Hey there! I am using WhatsApp.'),
      role: chat.role || '',
      speechStyle: chat.speechStyle || '',
      systemInstruction: chat.systemInstruction || '',
      avatar: chat.avatar,
      automation: chat.automation || {
        enabled: false,
        timeTriggers: [],
        inactivity: { enabled: false, hours: 6, minutes: 0, seconds: 0 }
      }
    });
    
    // Normalize existing data if it used minHours
    setFormData(prev => {
      if (prev.automation?.inactivity && ('minHours' in prev.automation.inactivity)) {
         const oldInactivity: any = prev.automation.inactivity;
         return {
           ...prev,
           automation: {
             ...prev.automation,
             inactivity: {
               enabled: oldInactivity.enabled,
               hours: oldInactivity.hours ?? oldInactivity.minHours ?? 6,
               minutes: oldInactivity.minutes ?? 0,
               seconds: oldInactivity.seconds ?? 0
             }
           }
         };
      }
      return prev;
    });
    setUrlValue(chat.avatar);
  }, [chat]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFormData(prev => ({ ...prev, avatar: base64 }));
        onUpdate({ avatar: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUrl = () => {
    if (urlValue) {
      setFormData(prev => ({ ...prev, avatar: urlValue }));
      onUpdate({ avatar: urlValue });
      setShowUrlInput(false);
    }
  };

  const handleSave = () => {
    onUpdate(formData);
  };

  const labelClass = "text-[calc(var(--msg-font-size)-0.5px)] text-[#008069] font-medium block mb-2 uppercase tracking-tight";
  const inputClass = "w-full outline-none text-[calc(var(--msg-font-size)+1.5px)] border-b app-border focus:border-[#00a884] pb-1.5 transition-all bg-transparent text-primary py-1";

  const groupMembers = chat.isGroup
    ? chat.memberIds?.map(id => allChats.find(c => c.id === id)).filter(Boolean) as Chat[]
    : [];

  return (
    <div className="w-full md:w-[400px] h-full app-header border-l app-border flex flex-col animate-in slide-in-from-right duration-300 relative">
      {showDeleteModal && (
        <ConfirmationModal
          title={chat.isGroup ? "Exit group?" : "Delete this persona?"}
          message={chat.isGroup ? `Are you sure you want to exit and delete "${chat.name}"?` : `Are you sure you want to delete "${chat.name}"? This will remove the contact and all associated message history.`}
          confirmLabel={chat.isGroup ? "Exit" : "Delete"}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={() => {
            onDeleteChat?.();
            setShowDeleteModal(false);
          }}
        />
      )}

      {showClearModal && (
        <ConfirmationModal
          title="Clear messages?"
          message={`Are you sure you want to clear all messages in "${chat.name}"? This action cannot be undone.`}
          confirmLabel="Clear Chat"
          onCancel={() => setShowClearModal(false)}
          onConfirm={() => {
            onClearChat?.();
            setShowClearModal(false);
          }}
        />
      )}

      {/* Header */}
      <div className="h-[60px] app-panel flex items-center p-5 shrink-0 border-b app-border">
        <div className="flex items-center gap-6">
          <X className="text-secondary cursor-pointer hover:bg-black/5 rounded-full p-1" onClick={onClose} />
          <h2 className="text-[calc(var(--msg-font-size)+1.5px)] font-medium text-primary">{chat.isGroup ? 'Group info' : 'Contact info'}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar Section */}
        <div className="app-panel flex flex-col items-center py-7 shadow-sm border-b app-border relative overflow-hidden">
          <div className="relative group cursor-pointer mb-5">
            <img src={formData.avatar} alt={formData.name} className="w-48 h-48 rounded-full object-cover shadow-md border-4 border-white dark:border-[#222d34]" />
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
                  className="flex-1 outline-none text-[calc(var(--msg-font-size)-0.5px)] bg-transparent text-primary px-1 font-medium"
                  placeholder="Paste image URL here..."
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyUrl()}
                />
                <button onClick={handleApplyUrl} className="text-[#00a884]"><Check size={18} strokeWidth={3} /></button>
              </div>
            </div>
          )}

          <h3 className="text-[calc(var(--msg-font-size)+5.5px)] text-primary font-normal">{formData.name}</h3>
          <p className="text-secondary text-[calc(var(--msg-font-size)-0.5px)] mt-1">{chat.isGroup ? `Group · ${groupMembers.length + 1} participants` : (chat.status || 'online')}</p>
        </div>

        {/* Basic Info Section */}
        <div className="mt-2 app-panel px-6 py-6 shadow-sm space-y-7 border-b app-border">
          <div className="relative">
            <label className={labelClass}>{chat.isGroup ? 'Group Name' : 'Name'}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="relative">
            <label className={labelClass}>{chat.isGroup ? 'Group Description' : 'About'}</label>
            <input
              type="text"
              value={formData.about}
              onChange={(e) => setFormData(prev => ({ ...prev, about: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        {/* Persona Details Section */}
        {!chat.isGroup && (
          <div className="mt-2 app-panel px-6 py-6 shadow-sm space-y-7 border-b app-border">
            <div className="relative">
              <label className={labelClass}>Role / Title</label>
              <input
                type="text"
                placeholder="e.g. CEO, Big Brother, Chef"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="relative">
              <label className={labelClass}>Speech Style</label>
              <input
                type="text"
                placeholder="e.g. Slang, Formal, Poetic"
                value={formData.speechStyle}
                onChange={(e) => setFormData(prev => ({ ...prev, speechStyle: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="relative">
              <label className={labelClass}>Persona Notes</label>
              <textarea
                value={formData.systemInstruction}
                onChange={(e) => setFormData(prev => ({ ...prev, systemInstruction: e.target.value }))}
                className="w-full min-h-[140px] outline-none text-[calc(var(--msg-font-size)+0.5px)] resize-none bg-[#f9f9f9] dark:bg-[#2a3942] p-3 rounded border app-border focus:border-[#00a884] transition-all text-primary leading-relaxed shadow-sm"
                placeholder="Detailed instructions for the AI behavior..."
              />
            </div>
          </div>
        )}

        {/* Participants for Group */}
        {chat.isGroup && (
           <div className="mt-2 app-panel shadow-sm overflow-hidden border-b app-border">
            <div className="px-6 py-4 border-b app-border flex items-center justify-between">
              <h4 className="text-[calc(var(--msg-font-size)-0.5px)] text-[#008069] font-medium uppercase tracking-tight">
                {groupMembers.length + 1} Participants
              </h4>
              <Users size={16} className="text-secondary" />
            </div>
            <div className="divide-y app-border">
              <div className="px-6 py-3 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#202c33] flex items-center justify-center text-[#00a884] font-bold shrink-0">You</div>
                <span className="text-[calc(var(--msg-font-size)+0.5px)] text-primary">You</span>
                <span className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary ml-auto">Group Admin</span>
              </div>
              {groupMembers.map(member => (
                <div key={member.id} className="px-6 py-3 flex items-center gap-4">
                  <img src={member.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[calc(var(--msg-font-size)+0.5px)] text-primary">{member.name}</p>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary truncate">{member.about || 'Available'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advanced / Automation Section */}
        {!chat.isGroup && (
          <div className="mt-2 app-panel shadow-sm border-b app-border">
            <div 
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-black/5 transition-colors"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-secondary" />
                <h4 className="text-[calc(var(--msg-font-size)+0.5px)] text-primary font-medium">Advanced Features: Automation</h4>
              </div>
              {showAdvanced ? <ChevronDown size={20} className="text-secondary" /> : <ChevronRight size={20} className="text-secondary" />}
            </div>
            
            {showAdvanced && (
              <div className="px-6 py-6 space-y-6 border-t app-border bg-gray-50/50 dark:bg-black/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[length:var(--msg-font-size)] font-medium text-primary">Enable Automation</p>
                    <p className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary">Allow AI to initiate conversations</p>
                  </div>
                  <div
                    onClick={() => setFormData(p => ({ ...p, automation: { ...p.automation, enabled: !p.automation.enabled } }))}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${formData.automation.enabled ? 'bg-[#00a884]' : 'bg-gray-400'}`}
                  >
                    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.automation.enabled ? 'left-[22px]' : 'left-[2px]'}`} />
                  </div>
                </div>

                <div className={`space-y-6 transition-opacity ${formData.automation.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {/* Inactivity Pulse */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-secondary" />
                        <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Inactivity Check-ins</h5>
                      </div>
                      <div
                        onClick={() => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, enabled: !p.automation.inactivity.enabled } } }))}
                        className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${formData.automation.inactivity.enabled ? 'bg-[#00a884]' : 'bg-gray-400'}`}
                      >
                        <div className={`absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${formData.automation.inactivity.enabled ? 'left-[18px]' : 'left-[2px]'}`} />
                      </div>
                    </div>
                    {formData.automation.inactivity.enabled && (
                      <div className="flex items-center gap-2 text-[calc(var(--msg-font-size)-1.5px)] text-secondary bg-white dark:bg-[#202c33] p-3 rounded border app-border">
                        <span>Trigger after:</span>
                        <input 
                          type="number" 
                          min="0"
                          value={formData.automation.inactivity.hours} 
                          onChange={e => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, hours: parseInt(e.target.value) || 0 } } }))}
                          className="w-10 bg-transparent text-center border-b app-border text-primary outline-none"
                        />
                        <span>hr</span>
                        <input 
                          type="number" 
                          min="0"
                          max="59"
                          value={formData.automation.inactivity.minutes} 
                          onChange={e => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, minutes: parseInt(e.target.value) || 0 } } }))}
                          className="w-10 bg-transparent text-center border-b app-border text-primary outline-none"
                        />
                        <span>min</span>
                        <input 
                          type="number" 
                          min="0"
                          max="59"
                          value={formData.automation.inactivity.seconds} 
                          onChange={e => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, seconds: parseInt(e.target.value) || 0 } } }))}
                          className="w-10 bg-transparent text-center border-b app-border text-primary outline-none"
                        />
                        <span>sec</span>
                      </div>
                    )}
                  </div>

                  {/* Time Triggers */}
                  <div className="space-y-3">
                    <h5 className="text-[calc(var(--msg-font-size)-0.5px)] font-medium text-primary">Time-Based Greetings</h5>
                    <div className="space-y-3">
                      {(() => {
                        const now = new Date();
                        const todayDateStr = now.toLocaleDateString('en-CA');
                        const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                        const hasAlreadyTalkedToday = formData.automation.timeTriggers.some(trigger => trigger.lastTriggered === todayDateStr);
                        
                        const processedTriggers = formData.automation.timeTriggers.map(t => {
                          const isTriggeredToday = t.lastTriggered === todayDateStr;
                          const isMissed = !isTriggeredToday && currentTimeStr > t.endTime;
                          return { ...t, isTriggeredToday, isMissed };
                        });

                        const missedTriggers = processedTriggers
                          .filter(t => t.isMissed)
                          .sort((a, b) => b.endTime.localeCompare(a.endTime));
                        const latestMissedId = missedTriggers[0]?.id;

                        const pastTriggers = processedTriggers
                          .filter(t => t.isTriggeredToday || t.isMissed)
                          .sort((a, b) => b.endTime.localeCompare(a.endTime));
                        
                        const upcomingTriggers = processedTriggers
                          .filter(t => !t.isTriggeredToday && !t.isMissed)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime));

                        const renderTrigger = (t: any) => {
                          const isNormal = t.lastTriggerType === 'normal';
                          const isCatchup = t.lastTriggerType === 'catchup';
                          
                          let stateLabel = "Awaiting window";
                          let stateColor = "text-secondary border-app-border";
                          let badgeColor = "bg-secondary";
                          let Icon = Clock;

                          if (t.isTriggeredToday) {
                            if (isNormal) {
                              stateLabel = "Completed on time";
                              stateColor = "border-[#00a884]/50 bg-[#00a884]/5 shadow-[#00a884]/10";
                              badgeColor = "bg-[#00a884]";
                              Icon = Check;
                            } else if (isCatchup) {
                              stateLabel = "Caught up (was missed)";
                              stateColor = "border-orange-500/50 bg-orange-500/5 shadow-orange-500/10";
                              badgeColor = "bg-orange-500";
                              Icon = Clock;
                            }
                          } else if (t.isMissed) {
                            if (hasAlreadyTalkedToday || t.id !== latestMissedId) {
                              stateLabel = "Skipped (already caught up)";
                              stateColor = "border-indigo-500/30 bg-indigo-500/5";
                              badgeColor = "bg-indigo-500";
                              Icon = Clock;
                            } else {
                              stateLabel = "Missed (waiting for engine)";
                              stateColor = "border-red-500/30 bg-red-500/5";
                              badgeColor = "bg-red-500";
                              Icon = X;
                            }
                          }

                          const originalIndex = formData.automation.timeTriggers.findIndex(trig => trig.id === t.id);

                          return (
                            <div key={t.id} className={`flex flex-col gap-2 p-3 bg-white dark:bg-[#202c33] border rounded relative transition-all ${stateColor}`}>
                              {(t.isTriggeredToday || t.isMissed) && (
                                 <div className={`absolute top-0 right-0 -mt-2.5 -mr-2 ${badgeColor} text-white text-[calc(var(--msg-font-size)-4.5px)] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border-2 border-white dark:border-[#202c33]`}>
                                   <Icon size={10} strokeWidth={3} /> {stateLabel}
                                 </div>
                              )}
                              <div className="flex items-center justify-between">
                                <input 
                                  type="text" 
                                  value={t.context}
                                  onChange={e => {
                                    const trigs = [...formData.automation.timeTriggers];
                                    trigs[originalIndex].context = e.target.value;
                                    delete trigs[originalIndex].lastTriggered;
                                    setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                                  }}
                                  className="outline-none text-[calc(var(--msg-font-size)-1.5px)] font-medium bg-transparent text-primary w-full"
                                  placeholder="e.g. Morning Greeting"
                                />
                                <div className="flex items-center gap-3 ml-2 shrink-0">
                                  <Globe 
                                    size={14} 
                                    className="text-blue-500 cursor-pointer hover:scale-110 transition-transform" 
                                    onClick={() => onTestAutomation?.(chat.id, 'time', t.context)} 
                                    title="Test manually" 
                                  />
                                  <Trash2 size={16} className="text-red-400 cursor-pointer hover:scale-110 transition-transform" onClick={() => {
                                    const trigs = formData.automation.timeTriggers.filter((_, idx) => idx !== originalIndex);
                                    setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                                  }} />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-[calc(var(--msg-font-size)-2.5px)] text-secondary">
                                <span>Window:</span>
                                <input type="time" value={t.startTime} onChange={e => {
                                  const trigs = [...formData.automation.timeTriggers];
                                  trigs[originalIndex].startTime = e.target.value;
                                  delete trigs[originalIndex].lastTriggered;
                                  delete trigs[originalIndex].lastTriggerType;
                                  setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                                }} className="bg-transparent border-b app-border" />
                                <span>to</span>
                                <input type="time" value={t.endTime} onChange={e => {
                                  const trigs = [...formData.automation.timeTriggers];
                                  trigs[originalIndex].endTime = e.target.value;
                                  delete trigs[originalIndex].lastTriggered;
                                  delete trigs[originalIndex].lastTriggerType;
                                  setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                                }} className="bg-transparent border-b app-border" />
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-4">
                            {pastTriggers.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-[calc(var(--msg-font-size)-3.5px)] font-bold text-secondary uppercase tracking-widest pl-1">Past Interactions</p>
                                {pastTriggers.map(renderTrigger)}
                              </div>
                            )}
                            {upcomingTriggers.length > 0 && (
                              <div className="space-y-3 pt-2">
                                <p className="text-[calc(var(--msg-font-size)-3.5px)] font-bold text-secondary uppercase tracking-widest pl-1">Upcoming Greetings</p>
                                {upcomingTriggers.map(renderTrigger)}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <button 
                        onClick={() => {
                          const newTrig = { id: Date.now().toString(), context: 'New Greeting', startTime: '08:00', endTime: '09:00' };
                          setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: [...p.automation.timeTriggers, newTrig] } }));
                        }}
                        className="w-full flex items-center justify-center gap-2 text-[calc(var(--msg-font-size)-1.5px)] text-[#00a884] font-medium py-2 hover:bg-black/5 rounded transition-colors"
                      >
                        <Plus size={16} /> Add Trigger
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons Section */}
        <div className="p-6 space-y-4">
          {!chat.isGroup && (
            <button 
              onClick={() => {
                if (window.confirm("This will clear the typing status and reset any internal session locks. Continue?")) {
                  onRefreshPersona(chat.id);
                }
              }}
              className="w-full flex items-center justify-center gap-2 text-[calc(var(--msg-font-size)-0.5px)] text-indigo-600 dark:text-indigo-400 font-medium py-3 border border-indigo-500/20 bg-indigo-500/5 rounded-lg hover:bg-indigo-500/10 transition-colors shadow-sm"
            >
              <RefreshCw size={16} /> Refresh & Debug Persona
            </button>
          )}

          <button
            onClick={handleSave}
            className="w-full bg-[#00a884] text-white py-3 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-[#005c4b] transition-colors shadow-sm active:scale-95 uppercase text-[calc(var(--msg-font-size)-0.5px)]"
          >
            <Save size={18} />
            Save Changes
          </button>

          <button
            onClick={() => setShowClearModal(true)}
            className="w-full text-primary py-3 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-black/5 transition-colors active:scale-95 text-[calc(var(--msg-font-size)-0.5px)] border app-border"
          >
            <Eraser size={18} className="text-secondary" />
            Clear Chat History
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full text-red-500 py-3 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors active:scale-95 text-[calc(var(--msg-font-size)-0.5px)] border border-red-500/20"
          >
            <Trash2 size={18} />
            {chat.isGroup ? 'Exit & Delete Group' : 'Delete Persona & Chat'}
          </button>
        </div>
      </div>
    </div>
  );
};
