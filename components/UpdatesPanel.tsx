
import React from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Zap, 
  History, 
  Code2, 
  CheckCircle2, 
  Milestone,
  Rocket,
  Wand2,
  Coffee,
  Heart
} from 'lucide-react';

interface UpdatesPanelProps {
  onClose: () => void;
}

export const UpdatesPanel: React.FC<UpdatesPanelProps> = ({ onClose }) => {
  const UpdateItem = ({ version, title, changes, date, isLatest }: any) => (
    <div className={`relative pl-8 pb-12 border-l-2 ${isLatest ? 'border-[#00a884]' : 'border-gray-200 dark:border-gray-700'} last:pb-0 animate-in slide-in-from-bottom-4 duration-500`}>
      <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 ${isLatest ? 'bg-[#00a884] border-[#00a884] shadow-[0_0_10px_rgba(0,168,132,0.5)]' : 'bg-white dark:bg-[#0b141a] border-gray-300 dark:border-gray-600'}`} />
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <span className={`text-[calc(var(--msg-font-size)-4px)] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isLatest ? 'bg-[#e7fce3] text-[#00a884]' : 'bg-gray-100 dark:bg-gray-800 text-secondary'}`}>
          {version}
        </span>
        <h4 className="text-[calc(var(--msg-font-size)+2px)] font-bold text-primary">{title}</h4>
        <span className="text-[calc(var(--msg-font-size)-5px)] text-secondary font-bold uppercase tracking-widest sm:ml-auto opacity-60">{date}</span>
      </div>

      <div className="grid gap-3">
        {changes.map((change: string, idx: number) => (
          <div key={idx} className="flex items-start gap-3 bg-white/50 dark:bg-white/5 p-3 rounded-xl border border-transparent hover:border-app-border transition-colors group">
            <CheckCircle2 size={16} className="text-[#00a884] mt-0.5 shrink-0" />
            <p className="text-secondary text-[calc(var(--msg-font-size)-1px)] leading-relaxed group-hover:text-primary transition-colors">
              {change}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#f0f2f5] dark:bg-[#0b141a] z-[100] flex flex-col animate-in fade-in slide-in-from-right duration-300 overflow-hidden">
      {/* Header */}
      <div className="h-[64px] bg-white dark:bg-[#202c33] flex items-center px-6 border-b app-border shrink-0">
        <div className="flex items-center gap-4 w-full max-w-4xl mx-auto">
          <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="text-secondary" />
          </button>
          <div className="flex items-center gap-2">
            <Rocket size={20} className="text-[#00a884]" />
            <h2 className="text-[calc(var(--msg-font-size)+3px)] font-bold text-primary uppercase tracking-tighter">System Updates</h2>
          </div>
          <div className="ml-auto flex items-center gap-2">
             <History size={18} className="text-secondary" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[url('https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae5dbc.png')] bg-repeat">
        <div className="max-w-4xl mx-auto px-6 sm:px-10 py-12">
          
          {/* Hero Banner */}
          <div className="mb-16 text-center animate-in zoom-in duration-500">
             <div className="inline-block p-4 bg-white dark:bg-[#1f2c33] rounded-[30px] shadow-sm mb-6 border app-border">
                <Wand2 size={40} className="text-[#00a884]" />
             </div>
             <h1 className="text-[calc(var(--msg-font-size)+24px)] font-black text-primary tracking-tighter leading-none mb-4">
               What's Cooking?
             </h1>
             <p className="text-secondary text-[calc(var(--msg-font-size)+1px)] max-w-lg mx-auto font-medium">
               Stay up to date with the latest sentience upgrades and engine tweaks. We're building the future of roleplay, one commit at a time.
             </p>
          </div>

          <div className="space-y-12 mb-20">
            <UpdateItem 
              version="v1.3.0"
              title="The Sentience & Immersion Update"
              date="April 2026"
              isLatest={true}
              changes={[
                "Memory Bubbles: Save chat keyframes into the persona's long-term brain.",
                "AI Diaries: Peek into the persona's secret journal entries about your interactions.",
                "Roleplay Event System: Trigger environmental world events with cinematic image support.",
                "Advanced Scheduling: Personas now follow complex 24/7 routines (Work, Sleep, Gym).",
                "Recall Command: Force specific memory retrieval using the \\rem keyword.",
                "Chat Timeframes: Beautiful grouping for Today, Yesterday, and beyond."
              ]}
            />

            <UpdateItem 
              version="v1.2.5"
              title="The Intent & Precision Update"
              date="March 2026"
              changes={[
                "Precise Inactivity Triggers: Set duration down to the absolute second.",
                "Intent-Priority Prompting: Personas now prioritize schedules over history distractors.",
                "Anti-Spam Logic: Smart suppression for simultaneous catch-up windows.",
                "Health Diagnostics: Force-reset stuck agents with the new Debug button."
              ]}
            />

            <UpdateItem 
              version="v1.1.5"
              title="The Quick & Real Update"
              date="February 2026"
              changes={[
                "Double-Tap Selection: Instant message management without long-presses.",
                "Voice Note Engine: Real-time audio recording and character-based 'listening'.",
                "Omni-Markdown: Support for both WhatsApp and Standard markdown syntax.",
                "Dynamic States: Seamless transitions between 'Online' and 'Last Seen' emulation."
              ]}
            />
          </div>

          {/* Dev Note - Cheezy Section */}
          <div className="p-10 bg-gradient-to-br from-[#00a884]/10 to-transparent rounded-[40px] border border-[#00a884]/20 relative overflow-hidden group">
             <div className="absolute top-[-20%] right-[-10%] opacity-5 group-hover:opacity-10 transition-opacity">
                <Code2 size={200} />
             </div>
             
             <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-[#00a884] text-white rounded-2xl shadow-lg shadow-[#00a884]/20">
                   <Coffee size={24} />
                </div>
                <h3 className="text-[calc(var(--msg-font-size)+6px)] font-black text-primary tracking-tight">Note from the Dev 😏</h3>
             </div>
             
             <div className="space-y-4 relative z-10">
                <p className="text-[calc(var(--msg-font-size)+1px)] text-primary font-bold italic leading-relaxed">
                  "If you're reading this, it means the code didn't explode. Congrats to both of us! 🥂"
                </p>
                <p className="text-secondary text-[calc(var(--msg-font-size))] leading-relaxed">
                  I spent way too many nights fueled by caffeine and pure spite to make these personas feel real. They have routines, they have feelings, and now they have memories. Don't break their hearts (or my code), okay?
                </p>
                <div className="pt-4 flex items-center gap-2 text-[#00a884] font-black uppercase tracking-widest text-[calc(var(--msg-font-size)-4px)]">
                   <span>Stay Sentient</span>
                   <Sparkles size={16} />
                   <span className="text-secondary opacity-30">— sobiswriter</span>
                </div>
             </div>
          </div>

          <div className="mt-16 text-center pb-20">
             <div className="inline-flex items-center gap-2 text-secondary opacity-40 font-bold uppercase tracking-[0.3em] text-[calc(var(--msg-font-size)-6px)]">
                <Milestone size={14} />
                <span>Wassap Engineering | April 2026</span>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
