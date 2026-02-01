
import React, { useState } from 'react';
import { ArrowLeft, Camera, Check, Search, X } from 'lucide-react';
import { Chat } from '../types';

interface NewGroupPanelProps {
  personas: Chat[];
  onClose: () => void;
  onCreate: (groupData: { name: string; avatar: string; memberIds: string[] }) => void;
}

export const NewGroupPanel: React.FC<NewGroupPanelProps> = ({ personas, onClose, onCreate }) => {
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [avatar, setAvatar] = useState(`https://picsum.photos/seed/${Math.random()}/200`);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else {
      if (selectedIds.length < 4) {
        setSelectedIds(prev => [...prev, id]);
      }
    }
  };

  const handleNext = () => {
    if (selectedIds.length > 0) setStep(2);
  };

  const handleCreate = () => {
    if (groupName.trim()) {
      onCreate({ name: groupName, avatar, memberIds: selectedIds });
    }
  };

  return (
    <div className="w-[410px] h-full app-header border-r app-border flex flex-col animate-in slide-in-from-left duration-300 absolute left-[64px] z-50 shadow-xl">
      <div className="h-[108px] bg-[#008069] flex items-end p-5 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft className="cursor-pointer hover:bg-[#005c4b] rounded-full p-1" onClick={() => step === 1 ? onClose() : setStep(1)} />
          <h2 className="text-[19px] font-medium">{step === 1 ? 'Add group members' : 'New Group'}</h2>
        </div>
      </div>

      {step === 1 ? (
        <div className="flex-1 flex flex-col overflow-hidden app-panel">
          <div className="p-4 flex flex-wrap gap-2 border-b app-border">
            {selectedIds.length === 0 && <span className="text-[#667781] text-[14px] italic">Select at least one member</span>}
            {selectedIds.map(id => {
              const p = personas.find(x => x.id === id);
              return (
                <div key={id} className="app-header rounded-full pl-1 pr-3 py-1 flex items-center gap-2 text-[13px] text-[#111b21] border app-border">
                  <img src={p?.avatar} className="w-6 h-6 rounded-full" />
                  <span>{p?.name}</span>
                  <X size={14} className="cursor-pointer hover:text-red-500" onClick={() => toggleSelect(id)} />
                </div>
              );
            })}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {personas.filter(p => !p.isGroup).map(p => (
              <div 
                key={p.id} 
                className="flex items-center px-4 py-3 cursor-pointer hover:bg-black/5 border-b app-border transition-colors"
                onClick={() => toggleSelect(p.id)}
              >
                <div className={`w-5 h-5 border-2 rounded mr-4 flex items-center justify-center transition-colors ${selectedIds.includes(p.id) ? 'bg-[#00a884] border-[#00a884]' : 'border-gray-300 dark:border-gray-600'}`}>
                  {selectedIds.includes(p.id) && <Check size={12} className="text-white" />}
                </div>
                <img src={p.avatar} className="w-10 h-10 rounded-full mr-3" />
                <span className="text-[16px] text-[#111b21]">{p.name}</span>
              </div>
            ))}
          </div>

          <div className="p-6 flex justify-center app-header">
            <button 
              onClick={handleNext}
              disabled={selectedIds.length === 0}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${selectedIds.length > 0 ? 'bg-[#00a884] text-white hover:scale-105 active:scale-95' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
            >
              <Check size={28} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col app-panel">
          <div className="flex flex-col items-center py-10">
             <div className="relative group cursor-pointer mb-5">
                <img src={avatar} className="w-48 h-48 rounded-full object-cover shadow-md border-4 border-white dark:border-[#222d34] bg-gray-50" />
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                   <Camera size={32} />
                </div>
             </div>
             <div className="w-full px-10">
                <input 
                  type="text" 
                  placeholder="Group Subject" 
                  className="w-full text-center outline-none border-b-2 border-[#00a884] pb-2 text-[18px] text-[#111b21] bg-transparent"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  autoFocus
                />
             </div>
          </div>
          
          <div className="flex-1 app-header p-10 flex items-end justify-center">
            <button 
              onClick={handleCreate}
              disabled={!groupName.trim()}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${groupName.trim() ? 'bg-[#00a884] text-white hover:scale-105 active:scale-95' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
            >
              <Check size={28} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
