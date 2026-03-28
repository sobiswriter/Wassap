
import React, { useState, useRef, useEffect } from 'react';
import { Plus, UserPlus, Users, Settings, User, MessageSquarePlus, CalendarDays } from 'lucide-react';

interface MobileActionFABProps {
    onAddPersona: () => void;
    onAddGroup: () => void;
    onProfileClick: () => void;
    onSettingsClick: () => void;
    onCalendarClick: () => void;
    onMetaAIClick: () => void;
}

export const MobileActionFAB: React.FC<MobileActionFABProps> = ({
    onAddPersona,
    onAddGroup,
    onProfileClick,
    onSettingsClick,
    onCalendarClick,
    onMetaAIClick
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="fixed bottom-[74px] right-4 z-[3000] flex flex-col items-end gap-3 md:hidden" ref={menuRef}>
            {/* Action Menu */}
            {isOpen && (
                <div className="flex flex-col items-end gap-3 mb-2 animate-in slide-in-from-bottom-5 duration-200">
                    <div className="flex items-center gap-3">
                        <span className="bg-white dark:bg-[#202c33] px-3 py-1 rounded shadow-md text-sm font-medium text-primary border app-border">Profile</span>
                        <button
                            onClick={() => { onProfileClick(); setIsOpen(false); }}
                            className="w-12 h-12 rounded-full bg-white dark:bg-[#202c33] shadow-lg flex items-center justify-center text-secondary hover:text-[#00a884] transition-colors border app-border"
                        >
                            <User size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="bg-white dark:bg-[#202c33] px-3 py-1 rounded shadow-md text-sm font-medium text-primary border app-border">Calendar Notes</span>
                        <button
                            onClick={() => { onCalendarClick(); setIsOpen(false); }}
                            className="w-12 h-12 rounded-full bg-white dark:bg-[#202c33] shadow-lg flex items-center justify-center text-secondary hover:text-[#00a884] transition-colors border app-border"
                        >
                            <CalendarDays size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="bg-white dark:bg-[#202c33] px-3 py-1 rounded shadow-md text-sm font-medium text-primary border app-border">Settings</span>
                        <button
                            onClick={() => { onSettingsClick(); setIsOpen(false); }}
                            className="w-12 h-12 rounded-full bg-white dark:bg-[#202c33] shadow-lg flex items-center justify-center text-secondary hover:text-[#00a884] transition-colors border app-border"
                        >
                            <Settings size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="bg-white dark:bg-[#202c33] px-3 py-1 rounded shadow-md text-sm font-medium text-primary border app-border">New Group</span>
                        <button
                            onClick={() => { onAddGroup(); setIsOpen(false); }}
                            className="w-12 h-12 rounded-full bg-white dark:bg-[#202c33] shadow-lg flex items-center justify-center text-secondary hover:text-[#00a884] transition-colors border app-border"
                        >
                            <Users size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="bg-white dark:bg-[#202c33] px-3 py-1 rounded shadow-md text-sm font-medium text-primary border app-border">New Persona</span>
                        <button
                            onClick={() => { onAddPersona(); setIsOpen(false); }}
                            className="w-12 h-12 rounded-full bg-white dark:bg-[#202c33] shadow-lg flex items-center justify-center text-secondary hover:text-[#00a884] transition-colors border app-border"
                        >
                            <UserPlus size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Meta AI FAB (Hidden when menu is open) */}
            {!isOpen && (
                <div 
                   className="w-12 h-12 bg-white dark:bg-[#202c33] rounded-[16px] shadow-lg flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                   onClick={onMetaAIClick}
                >
                  <div className="w-[32px] h-[32px] rounded-full border-[3.5px] p-[1.5px] bg-clip-border"
                      style={{ background: 'linear-gradient(45deg, #00d2ff 0%, #3a7bd5 50%, #8e2de2 100%)', borderColor: 'transparent' }}>
                      <div className="w-full h-full rounded-full bg-white dark:bg-[#202c33]"></div>
                  </div>
                </div>
            )}

            {/* Main FAB */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 shadow-[0_4px_12px_rgba(37,211,102,0.4)] dark:shadow-black/50 flex items-center justify-center transition-all duration-300 transform active:scale-95 z-50 ${isOpen ? 'rotate-45 bg-[#ef4444] rounded-full text-white' : 'bg-[#25d366] dark:bg-[#00a884] rounded-[16px] text-white'}`}
            >
                {isOpen ? <Plus size={30} className="text-white" /> : <MessageSquarePlus size={28} strokeWidth={2.5} />}
            </button>
        </div>
    );
};
