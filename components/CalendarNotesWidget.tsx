import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Save } from 'lucide-react';

interface CalendarNotesWidgetProps {
    notes: string;
    onUpdateNotes: (notes: string) => void;
    onClose: () => void;
}

export const CalendarNotesWidget: React.FC<CalendarNotesWidgetProps> = ({ notes, onUpdateNotes, onClose }) => {
    const [localNotes, setLocalNotes] = useState(notes || '');
    const [isSaved, setIsSaved] = useState(false);

    const handleSave = () => {
        onUpdateNotes(localNotes);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const today = new Date();
    const dateStr = today.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="absolute left-0 md:left-[80px] bottom-0 md:bottom-20 w-full md:w-[400px] h-full md:h-auto app-panel md:rounded-lg shadow-2xl border app-border z-[1000] animate-in slide-in-from-bottom-2 duration-200 overflow-hidden flex flex-col max-h-screen md:max-h-[80vh]">
            {/* Header */}
            <div className="p-4 border-b app-border bg-[#00a884] text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <CalendarIcon size={20} />
                    <h3 className="font-semibold text-[calc(var(--msg-font-size)+1.5px)]">Calendar & Notes</h3>
                </div>
                <button onClick={onClose} className="hover:bg-black/10 p-1 rounded-full transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4 bg-[#f0f2f5] dark:bg-[#111b21]">
                {/* Current Date Display */}
                <div className="bg-white dark:bg-[#202c33] rounded-lg p-3 shadow-sm border app-border flex flex-col items-center justify-center text-center">
                    <span className="text-[calc(var(--msg-font-size)-2.5px)] text-secondary uppercase font-bold tracking-wider mb-1">Today</span>
                    <span className="text-[calc(var(--msg-font-size)+1.5px)] text-primary font-medium">{dateStr}</span>
                </div>

                {/* Notes Area */}
                <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[calc(var(--msg-font-size)-1.5px)] font-medium text-secondary ml-1">
                        Important Dates & Context for AI
                    </label>
                    <textarea
                        value={localNotes}
                        onChange={(e) => setLocalNotes(e.target.value)}
                        placeholder={"e.g., Mom's birthday is on Oct 12.\nI have a meeting tomorrow at 3 PM.\nRemind me to buy groceries."}
                        className="w-full flex-1 min-h-[150px] bg-white dark:bg-[#2a3942] border app-border rounded-lg p-3 text-[calc(var(--msg-font-size)-0.5px)] text-primary outline-none focus:border-[#00a884] transition-colors resize-none shadow-sm"
                    />
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 pb-20 md:pb-3 border-t app-border bg-white dark:bg-[#202c33] flex justify-between items-center shrink-0">
                <span className="text-[calc(var(--msg-font-size)-3.5px)] text-secondary italic">
                    AI will use these notes if enabled in Settings.
                </span>
                <button
                    onClick={handleSave}
                    className={`px-4 py-1.5 rounded-full flex items-center gap-2 text-[calc(var(--msg-font-size)-1.5px)] font-medium transition-colors ${isSaved ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-[#00a884] text-white hover:bg-[#008f6f]'
                        }`}
                >
                    {isSaved ? 'Saved!' : 'Save'}
                    {!isSaved && <Save size={16} />}
                </button>
            </div>
        </div>
    );
};
