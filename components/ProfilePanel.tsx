
import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Link as LinkIcon, Save, Info, Globe, Check, Users, Trash2, Eraser, Settings, ChevronDown, ChevronRight, Plus, Clock } from 'lucide-react';
import { Chat } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface ProfilePanelProps {
  chat: Chat;
  allChats: Chat[];
  onClose: () => void;
  onUpdate: (updates: Partial<Chat>) => void;
  onDeleteChat?: () => void;
  onClearChat?: () => void;
  onTestAutomation?: (chatId: string, testType: 'inactivity' | 'time', contextOverride?: string) => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ chat, allChats, onClose, onUpdate, onDeleteChat, onClearChat, onTestAutomation }) => {
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
      inactivity: { enabled: false, minHours: 6, maxHours: 8 }
    }
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
        inactivity: { enabled: false, minHours: 6, maxHours: 8 }
      }
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

  const labelClass = "text-[14px] text-[#008069] font-medium block mb-2 uppercase tracking-tight";
  const inputClass = "w-full outline-none text-[16px] border-b app-border focus:border-[#00a884] pb-1.5 transition-all bg-transparent text-primary py-1";

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
      <div className="h-[60px] app-panel flex items-center p-5 shrink-0 border-b app-border">
        <div className="flex items-center gap-6">
          <X className="text-secondary cursor-pointer hover:bg-black/5 rounded-full p-1" onClick={onClose} />
          <h2 className="text-[16px] font-medium text-primary">{chat.isGroup ? 'Group info' : 'Contact info'}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="app-panel flex flex-col items-center py-7 shadow-sm border-b app-border relative overflow-hidden">
          <div className="relative group cursor-pointer mb-5">
            <img src={formData.avatar} alt={formData.name} className="w-48 h-48 rounded-full object-cover shadow-md border-4 border-white dark:border-[#222d34]" />
            <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity gap-2">
              <div className="flex gap-4">
                <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center hover:text-[#00a884] cursor-pointer">
                  <Camera size={20} />
                  <span className="text-[10px] uppercase font-bold mt-1">Upload</span>
                </div>
                <div onClick={() => setShowUrlInput(!showUrlInput)} className="flex flex-col items-center hover:text-[#00a884] cursor-pointer">
                  <LinkIcon size={20} />
                  <span className="text-[10px] uppercase font-bold mt-1">Link</span>
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
                  className="flex-1 outline-none text-[14px] bg-transparent text-primary px-1 font-medium"
                  placeholder="Paste image URL here..."
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyUrl()}
                />
                <button onClick={handleApplyUrl} className="text-[#00a884]"><Check size={18} strokeWidth={3} /></button>
              </div>
            </div>
          )}

          <h3 className="text-[20px] text-primary font-normal">{formData.name}</h3>
          <p className="text-secondary text-[14px] mt-1">{chat.isGroup ? `Group · ${groupMembers.length + 1} participants` : (chat.status || 'online')}</p>
        </div>

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

        {chat.isGroup ? (
          <div className="mt-2 app-panel shadow-sm overflow-hidden border-b app-border">
            <div className="px-6 py-4 border-b app-border flex items-center justify-between">
              <h4 className="text-[14px] text-[#008069] font-medium uppercase tracking-tight">
                {groupMembers.length + 1} Participants
              </h4>
              <Users size={16} className="text-secondary" />
            </div>
            <div className="divide-y app-border">
              <div className="px-6 py-3 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#202c33] flex items-center justify-center text-[#00a884] font-bold shrink-0">You</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-primary">You</p>
                  <p className="text-[12px] text-secondary">Group Admin</p>
                </div>
              </div>
              {groupMembers.map(member => (
                <div key={member.id} className="px-6 py-3 flex items-center gap-4">
                  <img src={member.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-primary">{member.name}</p>
                    <p className="text-[12px] text-secondary truncate">{member.about || 'Available'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
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
                className="w-full min-h-[140px] outline-none text-[15px] resize-none bg-[#f9f9f9] dark:bg-[#2a3942] p-3 rounded border app-border focus:border-[#00a884] transition-all text-primary leading-relaxed shadow-sm"
                placeholder="Detailed instructions for the AI behavior..."
              />
            </div>
          </div>
        )}

        {!chat.isGroup && (
          <div className="mt-2 app-panel shadow-sm border-b app-border">
            <div 
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-black/5 transition-colors"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-secondary" />
                <h4 className="text-[15px] text-primary font-medium">Advanced Features: Automation</h4>
              </div>
              {showAdvanced ? <ChevronDown size={20} className="text-secondary" /> : <ChevronRight size={20} className="text-secondary" />}
            </div>
            
            {showAdvanced && (
              <div className="px-6 py-6 space-y-6 border-t app-border bg-gray-50/50 dark:bg-black/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14.5px] font-medium text-primary">Enable Automation</p>
                    <p className="text-[12px] text-secondary">Allow AI to initiate conversations</p>
                  </div>
                  <div
                    onClick={() => setFormData(p => ({ ...p, automation: { ...p.automation, enabled: !p.automation.enabled } }))}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${formData.automation.enabled ? 'bg-[#00a884]' : 'bg-gray-400'}`}
                  >
                    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.automation.enabled ? 'left-[22px]' : 'left-[2px]'}`} />
                  </div>
                </div>

                <div className={`space-y-6 transition-opacity ${formData.automation.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {/* Inactivity Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-secondary" />
                        <h5 className="text-[14px] font-medium text-primary">Inactivity Check-ins</h5>
                      </div>
                      <div
                        onClick={() => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, enabled: !p.automation.inactivity.enabled } } }))}
                        className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${formData.automation.inactivity.enabled ? 'bg-[#00a884]' : 'bg-gray-400'}`}
                      >
                        <div className={`absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${formData.automation.inactivity.enabled ? 'left-[18px]' : 'left-[2px]'}`} />
                      </div>
                    </div>
                    {formData.automation.inactivity.enabled && (
                      <div className="flex items-center gap-2 text-[13px] text-secondary bg-white dark:bg-[#202c33] p-3 rounded border app-border">
                        <span>Trigger randomly between</span>
                        <input 
                          type="number" 
                          min="1" 
                          max="72"
                          value={formData.automation.inactivity.minHours}
                          onChange={e => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, minHours: Number(e.target.value) } } }))}
                          className="w-12 outline-none border-b app-border text-center bg-transparent text-primary"
                        />
                        <span>and</span>
                        <input 
                          type="number" 
                          min="1" 
                          max="72"
                          value={formData.automation.inactivity.maxHours}
                          onChange={e => setFormData(p => ({ ...p, automation: { ...p.automation, inactivity: { ...p.automation.inactivity, maxHours: Number(e.target.value) } } }))}
                          className="w-12 outline-none border-b app-border text-center bg-transparent text-primary"  
                        />
                        <span>hours</span>
                      </div>
                    )}
                  </div>

                  {/* Time Triggers Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[14px] font-medium text-primary">Time-Based Greetings</h5>
                    </div>
                    <div className="space-y-3">
                      {formData.automation.timeTriggers.map((t, i) => {
                        const hasTriggeredToday = t.lastTriggered === new Date().toLocaleDateString('en-CA');
                        
                        return (
                          <div key={t.id} className={`flex flex-col gap-2 p-3 bg-white dark:bg-[#202c33] border rounded relative transition-all ${hasTriggeredToday ? 'border-[#00a884]/50 shadow-sm shadow-[#00a884]/10 bg-[#00a884]/5 dark:bg-[#00a884]/10' : 'app-border'}`}>
                            {hasTriggeredToday && (
                               <div className="absolute top-0 right-0 -mt-2.5 -mr-2 bg-[#00a884] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border-2 border-white dark:border-[#202c33]">
                                 <Check size={10} strokeWidth={3} /> Done for today
                               </div>
                            )}
                            <div className="flex items-center justify-between">
                              <input 
                                type="text" 
                                value={t.context}
                              onChange={e => {
                                const trigs = [...formData.automation.timeTriggers];
                                trigs[i].context = e.target.value;
                                delete trigs[i].lastTriggered;
                                setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                              }}
                              className="outline-none text-[13px] font-medium bg-transparent text-primary w-full"
                              placeholder="e.g. Morning Greeting"
                            />
                            <div className="flex items-center gap-3 ml-2 shrink-0">
                              <Globe 
                                size={14} 
                                className="text-blue-500 cursor-pointer hover:scale-110 transition-transform" 
                                onClick={() => onTestAutomation?.(chat.id, 'time', t.context)} 
                                title="Test this specific greeting context" 
                              />
                              <Trash2 size={16} className="text-red-400 cursor-pointer hover:scale-110 transition-transform" onClick={() => {
                                const trigs = formData.automation.timeTriggers.filter((_, idx) => idx !== i);
                                setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                              }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[12px] text-secondary">
                            <span>Randomly between:</span>
                            <input 
                              type="time" 
                              value={t.startTime}
                              onChange={e => {
                                const trigs = [...formData.automation.timeTriggers];
                                trigs[i].startTime = e.target.value;
                                delete trigs[i].lastTriggered;
                                setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                              }}
                              className="outline-none tracking-wider bg-[#f0f2f5] dark:bg-[#111b21] p-1 rounded border app-border text-primary"
                            />
                            <span>and</span>
                            <input 
                              type="time" 
                              value={t.endTime}
                              onChange={e => {
                                const trigs = [...formData.automation.timeTriggers];
                                trigs[i].endTime = e.target.value;
                                delete trigs[i].lastTriggered;
                                setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: trigs } }));
                              }}
                              className="outline-none tracking-wider bg-[#f0f2f5] dark:bg-[#111b21] p-1 rounded border app-border text-primary"
                            />
                          </div>
                        </div>
                        );
                      })}
                      <button 
                        onClick={() => {
                          const newTrig = { id: Date.now().toString(), context: 'New Greeting', startTime: '08:00', endTime: '09:00' };
                          setFormData(p => ({ ...p, automation: { ...p.automation, timeTriggers: [...p.automation.timeTriggers, newTrig] } }));
                        }}
                        className="w-full flex items-center justify-center gap-2 text-[13px] text-[#00a884] font-medium py-2 hover:bg-black/5 rounded transition-colors"
                      >
                        <Plus size={16} /> Add Trigger
                      </button>
                    </div>
                  </div>

                  {/* Test Buttons */}
                  <div className="pt-4 border-t app-border space-y-2">
                    <button
                      onClick={() => onTestAutomation?.(chat.id, 'inactivity')}
                      className="w-full flex items-center justify-center gap-2 text-[13px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium py-2.5 rounded hover:bg-blue-500/20 transition-colors uppercase tracking-tight"
                    >
                      <Clock size={16} /> Force Test Inactivity
                    </button>
                    <p className="text-[11px] text-secondary text-center leading-tight">
                      Instantly triggers the background engine with an inactivity bypass. For time triggers, use the blue icon next to individual greetings.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-6 app-header space-y-3">
          <button
            onClick={handleSave}
            className="w-full bg-[#00a884] text-white py-3 rounded-md flex items-center justify-center gap-2 font-medium hover:bg-[#005c4b] transition-colors shadow-sm active:scale-95 uppercase text-[14px]"
          >
            <Save size={18} />
            Save Changes
          </button>

          <div className="h-[1px] app-border bg-border my-2 opacity-50" />

          <button
            onClick={() => setShowClearModal(true)}
            className="w-full text-primary py-3 rounded-md flex items-center justify-center gap-2 font-medium hover:bg-black/5 transition-colors active:scale-95 text-[14px]"
          >
            <Eraser size={18} className="text-secondary" />
            Clear Chat History
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full text-red-500 py-3 rounded-md flex items-center justify-center gap-2 font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors active:scale-95 text-[14px]"
          >
            <Trash2 size={18} />
            {chat.isGroup ? 'Exit & Delete Group' : 'Delete Persona & Chat'}
          </button>
        </div>
      </div>
    </div>
  );
};
