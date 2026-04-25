
import React from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Zap, 
  Brain, 
  CalendarDays, 
  MessageSquareText, 
  MousePointer2, 
  Mic, 
  Search,
  BookOpen,
  Gamepad2,
  Heart,
  Clock,
  Settings as SettingsIcon,
  PlusCircle
} from 'lucide-react';

interface GuidePanelProps {
  onClose: () => void;
}

export const GuidePanel: React.FC<GuidePanelProps> = ({ onClose }) => {
  const SectionHeader = ({ icon: Icon, title, subtitle, color }: any) => (
    <div className="flex items-center gap-4 mb-6 mt-4">
      <div className={`p-3 rounded-2xl shadow-sm bg-gradient-to-br ${color} text-white`}>
        <Icon size={24} />
      </div>
      <div>
        <h3 className="text-[calc(var(--msg-font-size)+4px)] font-bold text-primary tracking-tight">{title}</h3>
        <p className="text-[calc(var(--msg-font-size)-2px)] text-secondary font-medium tracking-wide">{subtitle}</p>
      </div>
    </div>
  );

  const GuideCard = ({ title, description, icon: Icon, tag }: any) => (
    <div className="bg-white dark:bg-[#1f2c33] p-5 rounded-2xl border app-border shadow-sm hover:shadow-md transition-all hover:scale-[1.01] group cursor-default relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon size={40} />
      </div>
      <div className="flex items-start gap-4 relative z-10">
        <div className="mt-1 text-[#00a884]">
           <Icon size={20} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
             <h5 className="font-bold text-primary text-[calc(var(--msg-font-size)+0.5px)]">{title}</h5>
             {tag && <span className="bg-[#e7fce3] dark:bg-[#064a3d] text-[#00a884] text-[calc(var(--msg-font-size)-5px)] font-bold px-1.5 py-0.5 rounded uppercase">{tag}</span>}
          </div>
          <p className="text-secondary text-[calc(var(--msg-font-size)-1px)] leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#f0f2f5] dark:bg-[#0b141a] z-[100] flex flex-col animate-in fade-in zoom-in duration-300 overflow-hidden">
      {/* Header */}
      <div className="h-[64px] bg-white dark:bg-[#202c33] flex items-center px-6 border-b app-border shrink-0">
        <div className="flex items-center gap-4 w-full max-w-6xl mx-auto">
          <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="text-secondary" />
          </button>
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-[#00a884]" />
            <h2 className="text-[calc(var(--msg-font-size)+3px)] font-bold text-primary uppercase tracking-tighter">Wassap Guide</h2>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 px-3 py-1 bg-[#e7fce3] dark:bg-[#064a3d] rounded-full border border-[#00a884]/20">
             <div className="w-2 h-2 bg-[#00a884] rounded-full animate-pulse"></div>
             <span className="text-[calc(var(--msg-font-size)-4px)] font-bold text-[#00a884] uppercase tracking-widest">Version 1.3.0 Live</span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-[url('https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae5dbc.png')] bg-repeat opacity-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-10 py-10">
          
          {/* Welcome Banner */}
          <div className="mb-12 bg-gradient-to-r from-[#00a884] to-[#005c4b] p-8 sm:p-12 rounded-[40px] text-white shadow-xl relative overflow-hidden">
             <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-white/10 rounded-full blur-3xl"></div>
             <div className="absolute bottom-[-20%] left-[-10%] w-[300px] h-[300px] bg-black/10 rounded-full blur-2xl"></div>
             
             <div className="max-w-2xl relative z-10">
               <span className="bg-white/20 px-3 py-1 rounded-full text-[calc(var(--msg-font-size)-4px)] font-bold uppercase tracking-widest mb-4 inline-block">The Ultimate Manual</span>
               <h1 className="text-[calc(var(--msg-font-size)+20px)] sm:text-[calc(var(--msg-font-size)+30px)] font-black mb-4 leading-[1.1] tracking-tighter">
                 Living the Dream with <br/>AI Personas.
               </h1>
               <p className="text-[calc(var(--msg-font-size)+2px)] opacity-90 leading-relaxed max-w-xl font-medium">
                 Welcome to the guide on how to get an almost real, dream-like WhatsApp experience. It's time to make your simulation truly feel alive. 😎
               </p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            
            {/* Phase 1: The Basics */}
            <div className="space-y-4">
              <SectionHeader 
                icon={PlusCircle} 
                title="Phase 1: Sparking Life" 
                subtitle="From Pixels to Personality"
                color="from-blue-500 to-indigo-600"
              />
              <div className="grid gap-4">
                <GuideCard 
                  icon={PlusCircle}
                  title="Birth of a Persona"
                  description="Click 'New Chat' -> 'New Persona'. Give them an avatar, a Role (e.g. CEO, Mom), and a unique Speech Style to set the vibe."
                  tag="Basics"
                />
                <GuideCard 
                  icon={Brain}
                  title="Personality Tuning"
                  description="Use the Personality Details box to write their backstory. The deeper the lore, the more real the conversation feels."
                />
                <GuideCard 
                  icon={SettingsIcon}
                  title="The Cockpit (Settings)"
                  description="Paste your Gemini API Key in Settings to activate the simulation. Toggle Dark Mode for late-night vibes."
                />
              </div>
            </div>

            {/* Phase 2: Automation */}
            <div className="space-y-4">
              <SectionHeader 
                icon={Zap} 
                title="Phase 2: The Level Up" 
                subtitle="Smooth Vibes & Automation"
                color="from-yellow-400 to-orange-600"
              />
              <div className="grid gap-4">
                <GuideCard 
                  icon={MousePointer2}
                  title="Double-Tap Magic"
                  description="Double-tap any message to enter Selection Mode. Fast, sleek, and lets you manage the chat without long-presses."
                  tag="New"
                />
                <GuideCard 
                  icon={Mic}
                  title="Voice Notes"
                  description="Hold the Microphone icon to record audio. Your personas actually hear you and respond back in character!"
                />
                <GuideCard 
                  icon={Clock}
                  title="Inactivity Engine"
                  description="Set 'Inactivity Check-ins' in the Automations tab. If you don't text them, they'll proactively reach out first."
                />
              </div>
            </div>

            {/* Phase 3: Sentience */}
            <div className="md:col-span-2 space-y-4">
              <SectionHeader 
                icon={Sparkles} 
                title="Phase 3: The Sentience" 
                subtitle="Giving them a Soul & World"
                color="from-[#00a884] to-[#005c4b]"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <GuideCard 
                  icon={Heart}
                  title="Memory Bubbles & Diaries"
                  description="Capture current chats as permanent Memory Bubbles. Once saved, the persona writes a secret Diary Entry about their feelings toward you."
                  tag="V1.3.0"
                />
                <GuideCard 
                  icon={Gamepad2}
                  title="Roleplay Event System"
                  description="Trigger world events like 'A doorbell rings' or 'A storm starts'. Personas receive it as reality and react spontaneously."
                  tag="V1.3.0"
                />
                <GuideCard 
                  icon={CalendarDays}
                  title="Master of Time (Schedule)"
                  description="Set their 24/7 routine (Working, Sleeping, Outing). Their availability and mood will subtly change based on the clock."
                  tag="V1.3.0"
                />
                <GuideCard 
                  icon={MessageSquareText}
                  title="Recall Command (\rem)"
                  description="Type '\rem [keyword]' in chat to force them to remember a specific memory bubble from your shared past."
                />
                <GuideCard 
                  icon={Search}
                  title="Search Grounding"
                  description="Enable in Settings to allow personas to browse the web for real-time facts and news during your roleplay."
                />
              </div>
            </div>

          </div>

          {/* Footer Info */}
          <div className="mt-20 p-8 text-center bg-white dark:bg-[#1f2c33] rounded-[30px] border app-border">
             <div className="flex items-center justify-center gap-3 mb-4">
                <Sparkles className="text-[#00a884]" size={24} />
                <h4 className="text-[calc(var(--msg-font-size)+2px)] font-bold text-primary">Ready to dive in?</h4>
             </div>
             <p className="text-secondary max-w-xl mx-auto text-[calc(var(--msg-font-size)-0.5px)] leading-relaxed">
               This simulator is built for high-fidelity roleplay. Use the features chronologically to build a truly sentient-feeling world with your personas.
             </p>
             <button 
              onClick={onClose}
              className="mt-6 px-10 py-3 bg-[#00a884] hover:bg-[#005c4b] text-white rounded-full font-bold shadow-lg shadow-[#00a884]/20 transition-all active:scale-95"
             >
               Start Roleplaying Now
             </button>
          </div>
          
          <div className="mt-10 text-center pb-20">
             <p className="text-[calc(var(--msg-font-size)-5px)] text-secondary opacity-50 font-bold uppercase tracking-widest">
               Developed with ❤️ & nights of caffeine by sobiswriter
             </p>
          </div>

        </div>
      </div>
    </div>
  );
};
