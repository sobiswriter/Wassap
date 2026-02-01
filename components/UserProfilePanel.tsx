
import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, Link as LinkIcon, Save, Globe, Check } from 'lucide-react';
import { UserProfile } from '../types';

interface UserProfilePanelProps {
  user: UserProfile;
  onClose: () => void;
  onUpdate: (user: UserProfile) => void;
}

export const UserProfilePanel: React.FC<UserProfilePanelProps> = ({ user, onClose, onUpdate }) => {
  const [formData, setFormData] = useState<UserProfile>({ ...user });
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState(user.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const labelClass = "text-[14px] text-[#008069] font-medium block mb-1 uppercase tracking-tight";
  const inputClass = "w-full outline-none text-[16px] border-b app-border focus:border-[#00a884] pb-1.5 transition-all bg-transparent text-[#111b21] py-1 font-normal";

  return (
    <div className="w-[410px] h-full app-header border-r app-border flex flex-col animate-in slide-in-from-left duration-300 absolute left-[64px] z-50 shadow-xl">
      <div className="h-[108px] bg-[#008069] flex items-end p-5 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft className="cursor-pointer hover:bg-[#005c4b] rounded-full p-1" onClick={onClose} />
          <h2 className="text-[19px] font-medium">Profile</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="app-panel flex flex-col items-center py-7 shadow-sm border-b app-border relative overflow-hidden">
          <div className="relative group cursor-pointer mb-5">
            <img src={formData.avatar} alt="My Profile" className="w-48 h-48 rounded-full object-cover shadow-md border-4 border-white dark:border-[#222d34] bg-gray-50" />
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
                  className="flex-1 outline-none text-[14px] bg-transparent text-[#111b21] px-1"
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

        <div className="mt-2 app-panel px-6 py-6 shadow-sm space-y-6 border-b app-border">
          <div>
            <label className={labelClass}>Your Name</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>About</label>
            <input 
              type="text" 
              value={formData.about}
              onChange={(e) => setFormData(prev => ({...prev, about: e.target.value}))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <input 
              type="text" 
              placeholder="e.g. Busy, At the gym, Available"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({...prev, status: e.target.value}))}
              className={inputClass}
            />
          </div>
        </div>

        <div className="p-6 app-header">
          <button 
            onClick={handleSave}
            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium bg-[#00a884] text-white hover:bg-[#005c4b] active:scale-95 shadow-sm transition-all uppercase text-[14px]"
          >
            <Save size={18} />
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
};
