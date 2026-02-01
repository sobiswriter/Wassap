
import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, Link as LinkIcon, Save, Globe, Check } from 'lucide-react';

interface NewChatPanelProps {
  onClose: () => void;
  onCreate: (personaData: {
    name: string;
    about: string;
    role: string;
    speechStyle: string;
    systemInstruction: string;
    avatar: string;
  }) => void;
}

export const NewChatPanel: React.FC<NewChatPanelProps> = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    about: 'Hey there! I am using WhatsApp.',
    role: '',
    speechStyle: '',
    systemInstruction: '',
    avatar: `https://picsum.photos/seed/${Math.random()}/200`
  });

  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
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

  const handleCreate = () => {
    if (formData.name.trim()) {
      onCreate(formData);
    }
  };

  const labelClass = "text-[14px] text-[#008069] font-medium block mb-1 uppercase tracking-tight";
  const inputClass = "w-full outline-none text-[16px] border-b app-border focus:border-[#00a884] pb-1.5 transition-all bg-transparent text-primary py-1 font-normal";

  return (
    <div className="w-[410px] h-full app-header border-r app-border flex flex-col animate-in slide-in-from-left duration-300 absolute left-[64px] z-50 shadow-xl">
      <div className="h-[108px] bg-[#008069] flex items-end p-5 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft className="cursor-pointer hover:bg-[#005c4b] rounded-full p-1" onClick={onClose} />
          <h2 className="text-[19px] font-medium">New Persona</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Photo Section */}
        <div className="app-panel flex flex-col items-center py-7 shadow-sm border-b app-border">
          <div className="relative group cursor-pointer mb-5">
            <img src={formData.avatar} alt="New Persona" className="w-48 h-48 rounded-full object-cover shadow-md border-4 border-white dark:border-[#222d34] bg-gray-50" />
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
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          {showUrlInput && (
            <div className="w-full px-10 mb-5 animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-2 border-b border-[#00a884] pb-1">
                <Globe size={16} className="text-[#00a884] shrink-0" />
                <input
                  type="text"
                  className="flex-1 outline-none text-[14px] bg-transparent text-primary px-1 font-medium"
                  placeholder="Paste image URL..."
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyUrl()}
                />
                <button onClick={handleApplyUrl} className="text-[#00a884] hover:text-[#005c4b] shrink-0">
                  <Check size={18} strokeWidth={3} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div className="mt-2 app-panel px-6 py-6 shadow-sm space-y-6">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              placeholder="Contact Name"
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
        </div>

        <div className="mt-2 app-panel px-6 py-6 shadow-sm space-y-6 border-b app-border">
          <div>
            <label className={labelClass}>Role / Title</label>
            <input
              type="text"
              placeholder="e.g. Mom, Big Brother, CEO"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Speech Style</label>
            <input
              type="text"
              placeholder="e.g. Sarcastic, Casual, Enthusiastic"
              value={formData.speechStyle}
              onChange={(e) => setFormData(prev => ({ ...prev, speechStyle: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Personality Details</label>
            <textarea
              value={formData.systemInstruction}
              onChange={(e) => setFormData(prev => ({ ...prev, systemInstruction: e.target.value }))}
              className="w-full min-h-[120px] outline-none text-[15px] resize-none bg-[#f9f9f9] dark:bg-[#2a3942] p-3 rounded border app-border focus:border-[#00a884] transition-all text-primary shadow-sm leading-relaxed"
              placeholder="Describe their backstory and how they should behave..."
            />
          </div>
        </div>

        <div className="p-6 pb-20 app-header">
          <button
            onClick={handleCreate}
            disabled={!formData.name.trim()}
            className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium shadow-sm transition-all uppercase text-[14px] ${formData.name.trim()
                ? 'bg-[#00a884] text-white hover:bg-[#005c4b] active:scale-95'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
          >
            <Save size={18} />
            Create Contact
          </button>
        </div>
      </div>
    </div>
  );
};
