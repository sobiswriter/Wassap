
import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Link as LinkIcon, Save, Info, Globe, Check, Users } from 'lucide-react';
import { Chat } from '../types';

interface ProfilePanelProps {
  chat: Chat;
  allChats: Chat[];
  onClose: () => void;
  onUpdate: (updates: Partial<Chat>) => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ chat, allChats, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: chat.name,
    about: chat.about || (chat.isGroup ? 'Group Description' : 'Hey there! I am using WhatsApp.'),
    role: chat.role || '',
    speechStyle: chat.speechStyle || '',
    systemInstruction: chat.systemInstruction || '',
    avatar: chat.avatar
  });

  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState(chat.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData({
      name: chat.name,
      about: chat.about || (chat.isGroup ? 'Group Description' : 'Hey there! I am using WhatsApp.'),
      role: chat.role || '',
      speechStyle: chat.speechStyle || '',
      systemInstruction: chat.systemInstruction || '',
      avatar: chat.avatar
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
  const inputClass = "w-full outline-none text-[16px] border-b app-border focus:border-[#00a884] pb-1.5 transition-all bg-transparent text-[#111b21] py-1";

  const groupMembers = chat.isGroup 
    ? chat.memberIds?.map(id => allChats.find(c => c.id === id)).filter(Boolean) as Chat[]
    : [];

  return (
    <div className="w-[400px] h-full app-header border-l app-border flex flex-col animate-in slide-in-from-right duration-300">
      <div className="h-[60px] app-panel flex items-center p-5 shrink-0 border-b app-border">
        <div className="flex items-center gap-6">
          <X className="text-[#54656f] cursor-pointer hover:bg-black/5 rounded-full p-1" onClick={onClose} />
          <h2 className="text-[16px] font-medium text-[#111b21]">{chat.isGroup ? 'Group info' : 'Contact info'}</h2>
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
                  className="flex-1 outline-none text-[14px] bg-transparent text-[#111b21] px-1 font-medium"
                  placeholder="Paste image URL here..."
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyUrl()}
                />
                <button onClick={handleApplyUrl} className="text-[#00a884]"><Check size={18} strokeWidth={3} /></button>
              </div>
            </div>
          )}

          <h3 className="text-[20px] text-[#111b21] font-normal">{formData.name}</h3>
          <p className="text-[#667781] text-[14px] mt-1">{chat.isGroup ? `Group · ${groupMembers.length + 1} participants` : (chat.status || 'online')}</p>
        </div>

        <div className="mt-2 app-panel px-6 py-6 shadow-sm space-y-7 border-b app-border">
          <div className="relative">
            <label className={labelClass}>{chat.isGroup ? 'Group Name' : 'Name'}</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
              className={inputClass}
            />
          </div>

          <div className="relative">
            <label className={labelClass}>{chat.isGroup ? 'Group Description' : 'About'}</label>
            <input 
              type="text" 
              value={formData.about}
              onChange={(e) => setFormData(prev => ({...prev, about: e.target.value}))}
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
              <Users size={16} className="text-[#667781]" />
            </div>
            <div className="divide-y app-border">
              <div className="px-6 py-3 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#202c33] flex items-center justify-center text-[#00a884] font-bold shrink-0">You</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-[#111b21]">You</p>
                  <p className="text-[12px] text-[#667781]">Group Admin</p>
                </div>
              </div>
              {groupMembers.map(member => (
                <div key={member.id} className="px-6 py-3 flex items-center gap-4">
                  <img src={member.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-[#111b21]">{member.name}</p>
                    <p className="text-[12px] text-[#667781] truncate">{member.about || 'Available'}</p>
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
                onChange={(e) => setFormData(prev => ({...prev, role: e.target.value}))}
                className={inputClass}
              />
            </div>
            <div className="relative">
              <label className={labelClass}>Speech Style</label>
              <input 
                type="text" 
                placeholder="e.g. Slang, Formal, Poetic"
                value={formData.speechStyle}
                onChange={(e) => setFormData(prev => ({...prev, speechStyle: e.target.value}))}
                className={inputClass}
              />
            </div>
            <div className="relative">
              <label className={labelClass}>Persona Notes</label>
              <textarea 
                value={formData.systemInstruction}
                onChange={(e) => setFormData(prev => ({...prev, systemInstruction: e.target.value}))}
                className="w-full min-h-[140px] outline-none text-[15px] resize-none bg-[#f9f9f9] dark:bg-[#2a3942] p-3 rounded border app-border focus:border-[#00a884] transition-all text-[#111b21] leading-relaxed shadow-sm"
                placeholder="Detailed instructions for the AI behavior..."
              />
            </div>
          </div>
        )}

        <div className="p-6 app-header">
          <button 
            onClick={handleSave}
            className="w-full bg-[#00a884] text-white py-3 rounded-md flex items-center justify-center gap-2 font-medium hover:bg-[#005c4b] transition-colors shadow-sm active:scale-95 uppercase text-[14px]"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
