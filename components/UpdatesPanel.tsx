
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
    <div className="fixed inset-0 bg-[#f0f2f5] dark:bg-[#0b141a] z-[3500] flex flex-col animate-in fade-in slide-in-from-right duration-250 overflow-hidden">
      {/* Header */}
      <div className="min-h-[64px] pt-[max(env(safe-area-inset-top),10px)] pb-2 bg-white dark:bg-[#202c33] flex items-center px-6 border-b app-border shrink-0">
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
              version="v1.9.3"
              title="Online GIF & Sticker Search, Expanded Library & GIPHY Integration"
              date="October 2026"
              isLatest={true}
              changes={[
                "Expanded Reaction GIF Library: Vastly widened built-in viral GIF library with 80+ top reactions categorized into Trending, Reactions, Laughing, Love, Shocked, Dancing, Classic Memes, and Yes/No.",
                "Expanded Transparent Vector Stickers: 36 crisp, handcrafted SVG/WebP stickers across 5 distinct packs (Frog/Pepe, Cute Cats, 3D WhatsApp Reactions, Anime/Chibi, and Classic Memes).",
                "Live Online GIPHY Search Integration: Search millions of animated GIFs and transparent stickers directly from the in-app media tray with debounced live querying and serverless proxy fallback.",
                "Live GIF & Sticker Confirmation & Preview Window: Selecting any GIF or sticker now opens a dedicated high-definition confirmation stage with large live playback, recipient header, optional caption composer for GIFs, and quick Send or Cancel controls (supporting Enter to send and Esc to dismiss).",
                "Automated GIPHY Health Shield: Verified 100% of built-in GIFs with automated live testing and added client-side detection to instantly suppress any unavailable GIPHY placeholders.",
                "GIPHY API Key Settings Integration: Easily connect your own free GIPHY Developer API Key directly from App Settings or the media tray footer with 1-click status validation and link to the GIPHY developer dashboard.",
                "Instant Pasted Media Link Detection: Paste any web image or GIF URL (https:// or data:image/) into the search bar for an immediate live preview and 1-tap send as GIF or Sticker.",
                "Vertex AI Base64 Image Fetching Fix: Fully resolved Gemini multimodal 400 invalid argument errors by automatically fetching remote image/GIF URLs into inline base64 bytes before sending to Vertex AI models."
              ]}
            />
            <UpdateItem 
              version="v1.9.2"
              title="Motion Excellence, Haptics & Tactile WhatsApp Interaction Update"
              date="October 2026"
              isLatest={false}
              changes={[
                "Message Bubble Motion & Physics: Entrance and exit scale/opacity animations that settle naturally into the conversation stream without distracting bounce.",
                "Tactile Touch Feedback & Haptics: Subtle compression and tonal feedback on message press, composer buttons, reactions, and send action, paired with an authentic haptic vibration system.",
                "Long-Press Message Selection & Header Morph: Long-pressing messages smoothly lifts the bubble and transforms the top navigation into WhatsApp's selection toolbar (Count, Star, Delete, Reply, Copy, Save as Memory).",
                "Anchored Quick Reaction Tray: Restrained spring-animated emoji reaction bar (👍, ❤️, 😂, 😮, 😢, 🙏) emerging directly above the message, with persona reaction awareness where AI characters react in-character to your emojis.",
                "In-App WhatsApp Emoji Picker: Instant, unclipped emoji drawer with fast search, categorized tabs (Smileys, Hands, Hearts, Fun), and recent emojis memory, inserting directly at cursor position without disrupting typing flow.",
                "In-App Multi-Tab Media Drawer (Emojis, GIFs & Stickers): Authentic WhatsApp-grade media drawer with Emojis, curated trending reaction GIFs (looping soundless clips), transparent sticker packs (Pepe, Cute Cats, 3D Reactions, Anime), and 1-tap custom sticker/GIF device uploads (bypassing mobile keyboard OS restrictions).",
                "Swipe-to-Reply & Physics Pull: Constrained horizontal swipe-to-reply with gradual reply indicator reveal and spring return.",
                "Chronological Date Groups & Legacy Compatibility: Monotonic forward date groupings eliminating duplicate 'Today' headers, cleanly categorizing historic legacy chats under 'Older Messages'."
              ]}
            />
            <UpdateItem 
              version="v1.9.0"
              title="Multimedia Voice Notes with Photos & Gemini 3.8 Expressive Acting Overhaul"
              date="October 2026"
              isLatest={false}
              changes={[
                "Integrated Photo + Voice Attachments: Users can now record and attach high-fidelity voice notes directly alongside photos as unified multimedia messages in composer, chat bubble, and AI processing.",
                "Gemini 3.8 Flash Studio-Grade Voice Delivery: Promoted Google's flagship gemini-3.8-flash-tts to default with automatic fallback hierarchy (gemini-3.8-flash-tts -> gemini-3.8-flash-lite-tts -> gemini-3.1-flash-tts-preview).",
                "Official Angle-Bracket Vocal Burst Tags: Upgraded vocal cues to Google's official Gemini 3.8 standard (<laugh>, <chuckle>, <sigh>, <gasp>, <cough>, <groan>, <throat-clearing>, <yawn>, <snort>, <pant>, <whispers>, <short pause>, <long pause>, <sob>, <cheer>, <phew>), eliminating awkward verbatim tag readouts.",
                "Refined Sustained Speech Styles: Cleaned speechMetadata.style directives across Vertex AI Cloud and Gemini AI Studio providers to generate rich, emotive cadence and character acting without robotic mannerisms.",
                "Multimodal Persona Hearing & Seeing: AI personas simultaneously analyze attached images and listen to attached voice notes within composite messages for full context awareness.",
                "Unified Storage & Bubble UI: IndexedDB media isolation for paired voice notes and photos, combined chat bubble rendering with audio player nestled beneath the image, and automatic cleanup on deletion."
              ]}
            />
            <UpdateItem 
              version="v1.8.6"
              title="The Zero-Latency Mobile & Borderless WhatsApp Polish"
              date="September 2026"
              isLatest={false}
              changes={[
                "Authentic Presence & Conversation Flow: Real-time WhatsApp presence progression where personas receive delivered double ticks, come online in the header, read messages with blue ticks, and think before typing.",
                "Lingering Online State & Dynamic Last Seen: Personas now linger online for 28s after chatting to support active back-and-forth dialogue, dynamically stamping their exact 'last seen today at [time]' when disconnecting.",
                "Zero-Latency 0ms Modal Opens: Implemented background idle pre-caching for settings, profile, and creation panels, completely eliminating first-click delay or freezing.",
                "Full-Screen Mobile Overlays: Rebuilt Settings, Persona Profile, User Profile, New Contact, and New Group into full-screen mobile sheets with hardware back button support.",
                "Expanded FAB Touch Targets: Extended tap targets to cover entire action rows and added touch backdrop dismiss for silky-smooth mobile operation.",
                "ServiceWorker v7 Cache Purge: Flushed stale browser caches to resolve stuck reloads and ensure all users immediately receive the new responsive builds."
              ]}
            />

            <UpdateItem 
              version="v1.8.5"
              title="The Sentience 2.0 & Context Buffer Update"
              date="September 2026"
              isLatest={false}
              changes={[
                "45-Message Context Buffer: Extended rolling in-chat memory to 45 messages (~20-22 conversation turns) for deep conversational continuity without token bloat or model overload.",
                "Non-Stacking Date Dividers: Scoped date dividers into isolated date group sections, completely eliminating ugly header stacking and overlap when scrolling between Yesterday and Today.",
                "Compact WhatsApp Mobile Date Pill: Scaled down date divider typography and padding for a sleek, authentic native WhatsApp mobile appearance.",
                "Sentience 2.0 Humane Engine: Completely revamped prompts with strict anti-robot protocols (no sycophantic echoing or interview questions), realistic texting slang, dynamic pacing, and 7-tier nuanced mood states."
              ]}
            />

            <UpdateItem 
              version="v1.8.4"
              title="The Clean Reset & Memory Guard Update"
              date="September 2026"
              isLatest={false}
              changes={[
                "Guarded @rem Directive: Prevented accidental diary recall triggers on normal greetings, keeping memory injection strictly tied to explicit recall commands.",
                "Thorough Chat Reset: Cleanly clears messages, IndexedDB media blobs, and queued offline tasks, with an optional toggle to also purge saved memory bubbles and diary logs.",
                "Instant Local Storage Sync: Chat clear actions immediately synchronize to disk and cancel running response timers."
              ]}
            />

            <UpdateItem 
              version="v1.8.3"
              title="The Dual Audio & Sent Pop Update"
              date="September 2026"
              isLatest={false}
              changes={[
                "Sent Message Pop Sound: Integrated authentic WhatsApp low-pop audio effect (/msgsentpop.mp3) whenever you send messages, media, or voice notes.",
                "Simultaneous Dual Web Audio: Preloaded Web Audio buffers for both sent pop and incoming chime (/whatapp.wav), allowing overlapping non-blocking playback with zero cutoffs.",
                "In-App Foreground Guard: Sounds trigger strictly when using the app in foreground (!document.hidden), keeping background tabs and OS notifications quiet.",
                "Offline PWA Pre-Caching: Cached new audio assets in Service Worker (wassap-shell-v4) for immediate offline and PWA operation."
              ]}
            />

            <UpdateItem 
              version="v1.8.2"
              title="The AI Diary Overhaul & @rem Recall Update"
              date="September 2026"
              isLatest={false}
              changes={[
                "Pure AI Diary Storage: Overhauled memory creation to save pure, authentic first-person diary reflections of persona's unspoken feelings rather than mechanical chat logs.",
                "Redesigned Journal Interface: Transformed memory capture into an elegant diary entry card with title customization and one-click 'Generate AI Diary'.",
                "Intelligent @rem Recall: Tokenized scoring engine that filters stop words and ranks memories by relevance to past conversations with instant in-character reminiscing.",
                "Balanced Photo Realism: Replaced strict anti-phone restrictions with a dynamic pool of authentic everyday activities (coffee, dining, study, park, selfies) preserving raw mobile camera aesthetics."
              ]}
            />

            <UpdateItem 
              version="v1.8.1"
              title="Anti-Phone Cliché & Chat Management Update"
              date="September 2026"
              isLatest={false}
              changes={[
                "Diverse Candid Activities: Eliminated the screen-staring cliché in candid photos with domestic, creative, dining, and outdoor activities.",
                "Multi-Message Deletion: Select and delete multiple messages with WhatsApp-styled confirmation modal and automatic IndexedDB media cleanup.",
                "1-Click 'Save as Memory': Turn selected meaningful messages directly into a permanent Memory Bubble without manual date calculation."
              ]}
            />

            <UpdateItem 
              version="v1.8.0"
              title="Authentic Smartphone Photo Generation Update"
              date="September 2026"
              isLatest={false}
              changes={[
                "In-Chat @img / @image: Type @img to prompt personas to send authentic selfies, candid snapshots, or POV photos matching conversation context.",
                "2-Step Context Synthesizer: Analyzes intent, mood, time of day, and chat history before steering the image generation model.",
                "In-Character Error Excuses: Graceful fail-safe excuses when camera or network issues occur."
              ]}
            />

            <UpdateItem 
              version="v1.7.0"
              title="The AI Voice Notes & Gemini-TTS Update"
              date="September 2026"
              isLatest={false}
              changes={[
                "AI Voice Note Replies: Personas can reply with authentic WhatsApp-style voice messages featuring waveforms, dual timers, and speed toggles (1x, 1.5x, 2x).",
                "30 Prebuilt Gemini-TTS Voices: Choose between 14 female and 16 male voices, complete with distinct personality traits and acoustic profiles.",
                "Google Gemini-TTS Prompt Steering: Synthesizes expressive, emotive speech tailored to each persona's role, tone, and vocal characteristics.",
                "Expressive Emotional Cues: Inline cues like [laughs], [whispers], and [sighs] are performed naturally in audio and stripped from text transcripts.",
                "Persona Voice Lab: Granular voice settings per persona with frequency controls (Off, Occasional, Frequent, Always) and Voice-for-Voice mirroring.",
                "In-Panel Audition: Preview any persona's assigned voice directly from their profile editor before chatting.",
                "Fail-Safe Audio Delivery: Seamless IndexedDB audio persistence and graceful fallback to clean text on any network or quota interruption."
              ]}
            />

            <UpdateItem 
              version="v1.6.0"
              title="The Cloud Credits & Dual Provider Update"
              date="September 2026"
              isLatest={false}
              changes={[
                "Dual AI Provider: Toggle between Built-in Cloud (Vertex AI) with server credits or Custom Gemini AI Studio key.",
                "Passcode Protected Cloud: Secure server credits behind passcode protection with interactive hint assistance.",
                "Global Vertex AI Routing: Connects directly to Vertex AI global endpoints for cutting-edge Gemini 3 models.",
                "Custom Chat Wallpapers: Upload custom background photos or choose from aesthetic presets with responsive cover-scaling and opacity controls.",
                "Streamlined Next-Gen Models: Powered by gemini-3.8-flash (default), gemini-3.7-flash, and gemini-3.5-flash-lite.",
                "Speech Engine Preview: Added gemini-3.1-flash-tts-preview to the model lineup for upcoming voice capabilities.",
                "Theme System Fixes: Fully responsive dark theme toggle with instant app-wide theme synchronization."
              ]}
            />

            <UpdateItem 
              version="v1.5.0"
              title="The Time & Pacing Update"
              date="June 2026"
              isLatest={false}
              changes={[
                "Message Stacking: Delay AI responses by a configurable amount (5s to 30s) to pool follow-ups.",
                "Visual Bubble Stacking: Hide tails and headers on consecutive messages for a clean WhatsApp-native layout.",
                "Relative Time Gap Awareness: Acknowledge silence organically (e.g., yesterday, last week) in character.",
                "Smart Chat Frequency: Comments once per day on messaging activity (15+ messages today) without repeating."
              ]}
            />

            <UpdateItem 
              version="v1.4.0"
              title="The Humane & Customization Update"
              date="May 2026"
              changes={[
                "Humane Settings Engine: Fine-tune AI imperfections, abbreviation usage, and robotic phrasing blocks.",
                "Mood Slider: Introduce a 0-100 slider to override the persona's current emotional state.",
                "Persona Templates: Load pre-configured character roles or save your own prompt outlines.",
                "Memory Export/Import: Backup and transfer memory bubble snapshots as JSON.",
                "Message Chunk Capping: Restrict maximum message splits based on overall response word count."
              ]}
            />

            <UpdateItem 
              version="v1.3.0"
              title="The Sentience & Immersion Update"
              date="April 2026"
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
                <span>Wassap Engineering | June 2026</span>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
