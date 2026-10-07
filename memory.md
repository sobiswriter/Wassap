# AI Context & Project Memory (`memory.md`)

> **Note for AI Assistants**: Read this file first when starting a new session or planning updates. It provides an immediate, end-to-end understanding of the project's architecture, active state, completed features, and critical engineering rules without needing to explore every file.

---

## 📌 Project Identity & Overview
- **Project Name**: Wassap (Wassap Persona Simulation)
- **Current Version**: `v1.9.0`
- **Core Concept**: A pixel-perfect, high-fidelity WhatsApp Web replica built with React 19, Tailwind CSS v3, and Vite, repurposed as an advanced AI persona simulator powered by Google Gemini & Vertex AI.
- **Repository / User**: `sobiswriter/Wassap`
- **Primary Runtime**: Single-Page App (SPA) deployed on **Vercel** with Node.js Serverless Functions in `api/gemini/`, plus a local Express development server in `server/`.

---

## ⚡ Current State & What Was Just Worked On
### 1. Multimedia Voice Notes with Photos & Gemini 3.8 Expressive Acting Overhaul (`v1.9.0`)
- **Multimedia Image + Voice Note Integration**:
  - **Composer Staging (`MessageInput.tsx`)**:
    - Users can now attach a photo and record/attach a voice note simultaneously before hitting send.
    - Added dedicated staging preview tray showing image thumbnail alongside voice note card (with playable audio bar, duration, and individual trash remove controls).
    - Added quick-access microphone icon directly inside the composer action row whenever an image is staged.
    - In-composer live recording bar with real-time timer (`formatAudioDuration`), cancel (`Trash2`), and confirm (`Check`) buttons.
  - **Data Model & IndexedDB Isolation (`types.ts` & `App.tsx`)**:
    - Extended `Message` with `voiceAttachment?: FileAttachment`, `voiceMediaId?: string`, and `voiceDuration?: number`.
    - Maintained isolated storage keys in `media_store` (`mediaId` for photo, `voiceMediaId` for audio note) to prevent payload collisions while preserving single-responsibility IndexedDB blobs.
    - Updated `lastMessage` calculation across the app: composite messages format as `📷 Photo + 🎤 Voice note: [caption]`.
    - Integrated voice cleanup in `handleDeleteChat`, `handleClearChat`, and `handleDeleteMessages`.
  - **High-Fidelity Bubble Rendering (`ChatWindow.tsx`)**:
    - Single unified bubble for composite messages (`media-message-bubble`): renders photo on top and `VoiceNotePlayer` nestled directly beneath it, with caption text, message status ticks, and timestamps aligned below.
    - Enhanced reply quote previews to accurately reflect `Photo + Voice`.
  - **Multimodal AI Seeing & Hearing (`App.tsx` & `services/geminiService.ts`)**:
    - Hydrates both photo (`image`) and audio (`audio`) from IndexedDB into history before calling `getGeminiResponse`.
    - Persona prompt updated with Directive 5: personas inspect attached photos and listen to attached voice notes simultaneously when analyzing composite messages.

- **Gemini 3.8 Flash Voice Delivery & Character Acting Fix**:
  - **Root Cause Analysis (Why 3.8 sounded flat/stiff compared to 3.1)**:
    - **Model Specialization**: `gemini-3.8-flash-lite-tts` (previously set as app default) is Google's ultra-fast model engineered for low-latency informational read-alouds, with prosody flattened. Conversely, `gemini-3.8-flash-tts` is Google's flagship model explicitly engineered for studio-grade character acting, emotional nuances, and dynamic vocal performance.
    - **Verbatim Script Interpretation & Vocal Burst Tags**: Gemini 3.8 treats input text as verbatim scripts. Legacy square-bracket tags like `[laughs]`, `[sighs]`, `[chuckles]` were either causing awkward pauses or being read aloud verbatim. Google's official Gemini 3.8 standard requires angle brackets: `<laugh>`, `<chuckle>`, `<sigh>`, `<gasp>`, `<cough>`, `<groan>`, `<throat-clearing>`, `<yawn>`, `<snort>`, `<pant>`, `<whispers>`, `<short pause>`, `<long pause>`, `<sob>`, `<cheer>`, `<phew>`.
    - **Sustained Style Directives**: `speechMetadata.style` requires clean sustained delivery attributes (e.g., `"warm and playful"`, `"whispered urgently"`) rather than prefixing with `"manner: "`.
  - **Comprehensive Solution**:
    - Promoted `gemini-3.8-flash-tts` as the default voice model (`DEFAULT_VOICE_MODEL`) in `constants.ts`.
    - Configured automatic fallback hierarchy across both Vertex AI Cloud and Gemini AI Studio: `selectedModel` $\rightarrow$ `gemini-3.8-flash-tts` $\rightarrow$ `gemini-3.8-flash-lite-tts` $\rightarrow$ `gemini-3.1-flash-tts-preview`.
    - Upgraded preprocessors (`utils/audio.ts`, `api/gemini/tts.ts`, `server/vertexHandler.ts`) to convert legacy square-bracket cues and natural stage directions into official 3.8 angle-bracket vocal bursts.
    - Stripped artificial `"manner: "` prefixes from sustained style directives across both backends.
    - Upgraded `buildFullPersonaSystemPrompt` to instruct personas on natural placement of official 3.8 angle-bracket vocal bursts and emotionally responsive voice note generation.

---

### 2. Gemini 3.8 Flash-Lite TTS Optimization & Zero-Lag Parallel Generation Pipeline (`v1.8.7`)
- **Gemini 3.8 Speech Generation Architecture**:
  - Adopted `gemini-3.8-flash-lite-tts` (Ultra-Fast & Real-Time Default) as the default voice model across the entire application per Google Cloud's official documentation for high-throughput, low-latency conversational agents.
  - Retained `gemini-3.8-flash-tts` as the selectable option for high-fidelity studio acting and narration, with `gemini-3.1-flash-tts-preview` as legacy fallback.
  - **Standardized Official 3.8 Request Schema**: Configured `speechMetadata: { style: styleDirective }` inside content `parts` and `speechConfig: { voiceConfig: { voice: selectedVoice } }` (with fallback to `prebuiltVoiceConfig`), operating directly on Vertex AI location `global`.
  - **Pipelined Background AI Generation (`App.tsx`)**:
    - Eliminated serial waiting where API requests previously waited for 18–20s of artificial presence sleeps (`deliveryWait`, `comeOnlineDelay`, `seenDelay`, `thinkingDelay`) to finish before even contacting the AI.
    - Eagerly launches `getGeminiResponse` and `generateGeminiVoiceNote` concurrently in the background as an asynchronous promise the instant the user sends a message.
    - Concurrently displays authentic WhatsApp visual lifecycle transitions (single grey tick $\rightarrow$ double grey tick $\rightarrow$ online status $\rightarrow$ double blue ticks $\rightarrow$ `recording audio...`).
    - By the time the user observes the persona switch to `recording audio...`, the voice note is already generated or nearly complete, reducing perceived latency from 45–60s down to ~10–14s with zero disruption to conversational flow.
    - Reduced text stacking delay for incoming voice notes and active online sessions from 10s down to 1.5s.
- **Dual-Provider Architecture (Vertex AI Cloud Engine + Custom Studio Key)**:
  - Standardized fallback ordering across both backends: `selectedModel` $\rightarrow$ `gemini-3.8-flash-lite-tts` $\rightarrow$ `gemini-3.8-flash-tts` $\rightarrow$ `gemini-3.1-flash-tts-preview`.

---

### 2. Borderless WhatsApp Dark Mode Date Indicator & Zero-Latency Mobile Architecture (`v1.8.6`)
- **Borderless Dark Mode Date Pill**:
  - Removed the distracting `border app-border/40` from `DateDivider` in `ChatWindow.tsx`.
  - Replaced generic styling with authentic WhatsApp pill: `bg-white dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] text-[10px] sm:text-[11.5px] px-3 py-1 rounded-lg font-medium tracking-wide shadow-xs transition-all`.
  - Seamless, authentic appearance matching native WhatsApp Web and mobile clients.
- **Root Cause Analysis for Unresponsive Settings / Profile Clicks**:
  - **Issue A (Dynamic Import Latency & Double-Click Abort)**: `ProfilePanel`, `SettingsPopover`, `CalendarNotesWidget`, etc., were loaded via `React.lazy()` with `fallback={null}`. On first click, downloading the dynamic JS chunk took 300–1200ms with zero visual feedback. Users tapped again, which flipped `!showSettingsPopover` or `!showProfilePanel` to `false`, immediately cancelling the open request.
  - **Issue B (Mobile Layout & Stacking Context Conflict)**: `ProfilePanel` was rendered inside a horizontal flex row next to `ChatWindow` (`relative w-full md:w-[400px] h-full`). On mobile screens (<768px), it was positioned off-screen to the right inside `overflow-hidden`. Similarly, `SettingsPopover` was `absolute bottom-0 h-[calc(100%-80px)]`, which clashed with the mobile bottom navigation bar and viewport safe areas.
  - **Issue C (MobileActionFAB Narrow Hitbox)**: `onClick` was attached exclusively to tiny inner circular buttons; tapping the text labels ("Settings", "Profile", "Calendar Notes") yielded no action.
- **Zero-Latency & Mobile Sheet Fixes**:
  - **Eager Idle Preloader (`App.tsx`)**: Introduced `preloadAppPanels()` using `requestIdleCallback` (fallback `setTimeout(600ms)`) to eagerly download and cache all secondary panels in browser memory immediately after app initialization. Clicking any modal now opens in **0ms (instantaneous)**.
  - **Non-Blocking Visual Loading Fallback (`PanelLoadingFallback`)**: Replaced `fallback={null}` with a WhatsApp green top progress bar so users receive instant visual confirmation if network delays occur.
  - **Explicit Open Guards**: Changed `onHeaderClick` from `() => setShowProfilePanel(!showProfilePanel)` to `() => setShowProfilePanel(true)`.
  - **Full-Screen Mobile Sheets with Safe-Area Insets**: Rebuilt `ProfilePanel`, `SettingsPopover`, `CalendarNotesWidget`, `UserProfilePanel`, `NewChatPanel`, and `NewGroupPanel` to render as `fixed inset-0 z-[3500-4000]` on mobile, with iOS notch/home-indicator safe-area insets (`pt-[max(env(safe-area-inset-top),16px)]` and `pb-[max(env(safe-area-inset-bottom),16px)]`) and smooth slide transitions (`animate-in slide-in-from-bottom-3 duration-250`).
  - **Comprehensive MobileActionFAB Touch Targets**: Wrapped the entire row (icon + label) in a touch-friendly clickable target with active scale feedback and added a full-screen backdrop overlay (`z-[2995]`) that dismisses the menu on tap.
  - **Hardware Back Button Integration**: Extended the native popstate listener to close all panels (including Guide and Updates) when tapping hardware or browser back buttons.
  - **Authentic WhatsApp Conversation Lifecycle & Presence Flow (Calibrated Timing)**:
    - **Natural Delivery Delay**: Sent messages immediately display a single grey tick (`'sent'`), transitioning to double grey ticks (`'delivered'`) after a realistic network delivery pause (1.8s–2.5s).
    - **Observable Presence Sequence (Single Grey -> Double Grey -> Online -> Blue Ticks -> Typing)**:
      1. **Sent (`✓`) -> Delivered (`✓✓`)**: 1.8s–2.5s natural delivery delay. User clearly registers the single tick before it turns into double grey ticks.
      2. **Delivered (`✓✓`) -> Persona Comes Online**: 2.2s–3.2s pause while recipient notices notification and unlocks phone. Header turns WhatsApp green `online`. (In stacking mode, persona comes online gradually at 3.2s–5.2s).
      3. **Online -> Seen Blue Ticks (`✓✓`)**: 2.0s–3.0s pause as recipient enters the chat thread, turning double grey ticks into double blue ticks.
      4. **Blue Ticks -> Starting to Type**: 2.2s–3.2s contemplation pause while recipient reads the message and prepares to type.
      5. **Active Typing (`typing...`)**: Header and chat list switch to animated green `typing...` before and during AI response generation (minimum 2.5s–5.0s typing display time for authentic pacing). Between multi-chunk replies, status briefly flips back to `online` (1.2s–2.2s) before typing the next bubble.
      6. **Lingering Online State & Dynamic Last Seen Stamping**: After sending their reply, personas stay `online` for 35 seconds to support active, real-time back-and-forth conversation. If user does not reply, persona transitions to `offline` and stamps `lastSeenTime` with the exact current timestamp (`"last seen today at [time]"`). Ongoing messages within this window keep the persona online and bypass wake-up delays.
  - **Service Worker v7 (`wassap-shell-v7`)**: Flushed obsolete caches to ensure all devices cleanly download updated bundles and avoid reload loops.

### 2. Sentience 2.0 Humane Engine & 45-Message Context Buffer (`v1.8.5`)
- **45-Message Context Buffer**: Buffed rolling message context from 30 to 45 messages (~20-22 conversation turns), giving personas deep contextual memory of current topics without token overflow.
- **Non-Stacking Date Dividers**: Scoped date divider rendering inside isolated date groups, ensuring dividers only show for their respective day sections without stacking on top of each other.
- **Sentience 2.0 Humane Texting Engine**: Comprehensive prompt rewrite eliminating sycophantic echo replies, interrogation-style questions, and robotic formality; injected organic texting slang, irregular message pacing, and 7-tier mood states.

### 3. Persona Chat Reset & Memory Leak Elimination (`v1.8.4`)
- **Root Cause 1: Erroneous `[MEMORY RECALL]` Injection on Ordinary Chats**:
  - `buildMemoryRecallContext` previously checked `if (!isExplicitRecall && memories.length === 0) return undefined;`.
  - When a chat had existing memory bubbles, ordinary messages (like "Hey", "How are you?") failed this check and proceeded to return a top-priority `[MEMORY RECALL]` directive commanding the persona to reminisce about past diary entries even though the user never typed `@rem`!
  - Fixed so `buildMemoryRecallContext` strictly guards `if (!isExplicitRecall) return undefined;`.
- **Root Cause 2: Incomplete Clear Chat in `ProfilePanel` and `App.tsx`**:
  - Previously, `handleClearChat` cleared `messages: []` but left `chat.memoryBubbles` intact. Furthermore, `ProfilePanel` held `formData.memoryBubbles` in its local state, so clicking "Save Changes" after clearing the chat would re-commit the old memory bubbles to state.
  - Additionally, any pending offline outbox messages or unreconciled background notification exchanges in IndexedDB (`whatsapp_offline_db`) could re-populate the chat on sync.
- **Complete Clean Reset Solution**:
  - **Memory Clearing Option**: Updated `ConfirmationModal` to support custom option nodes. Added a checkbox to both `ProfilePanel.tsx` and `ChatWindow.tsx` clear-chat dialogs: *"Also clear persona's saved memory bubbles & diary entries ({count})"* (enabled by default).
  - **ProfilePanel Form Synchronization**: Clearing chat updates `formData.memoryBubbles = []` immediately so subsequent profile saves don't resurrect old memories.
  - **Comprehensive Backend Wipe (`handleClearChat` in `App.tsx`)**:
    - Purges media blobs from IndexedDB.
    - Purges pending offline outbox and background exchanges via `clearOfflineDataForChat(activeChatId)` in `utils/offlineQueue.ts`.
    - Cancels active response timeouts, left-on-read timers, and pending time-gap caches.
    - Clears `messages: []`, `lastMessage: ''`, `lastMessageTime: ''`, `unreadCount: 0`, and `memoryBubbles: []` (when option selected).
    - Calls `saveChatsNow()` immediately to ensure zero-delay synchronization with `localStorage`.

### 2. Dual Audio In-App Sound System (`msgsentpop.mp3` & `whatapp.wav`) (`v1.8.3`)
- **Real WhatsApp Sent Message Sound (`/msgsentpop.mp3`)**:
  - Integrated a low pop audio effect when the user sends any message (text, quick reply, media, voice, attachment, or event) directly in the active chat interface.
  - Sourced from `public/msgsentpop.mp3`.
- **Dual Simultaneous Web Audio Engine (`App.tsx`)**:
  - Preloaded both `/whatapp.wav` (incoming persona messages) and `/msgsentpop.mp3` (user sent messages) into parallel memory buffers (`incomingAudioBufferCache` and `sentAudioBufferCache`) via the Web Audio API.
  - Implemented `playSentMessageSound()` and optimized `playIncomingMessageSound()`.
  - Non-blocking Web Audio node graph: each playback instantiates an independent `AudioBufferSourceNode` routed through dedicated gain stages (sent pop balanced at 0.85 gain for an authentic soft WhatsApp pop) into the main destination, preventing audio channel contention, clicks, or cutoff when sent and received messages overlap.
  - Graceful HTML5 `new Audio()` fallback if Web Audio is unsupported or locked.
- **Strict In-App Foreground Guard**:
  - Both `playSentMessageSound()` and `playIncomingMessageSound()` strictly check `if (typeof document !== 'undefined' && document.hidden) return;`.
  - Ensures zero unwanted audio playback when the tab is backgrounded or minimized, or when native background service worker push notifications arrive (which have OS-level notification alerts).
- **Service Worker Offline Pre-Caching (`public/sw.js`)**:
  - Added `'/msgsentpop.mp3'` to `PRECACHE_ASSETS` in `public/sw.js`.
  - Incremented cache version identifier to `wassap-shell-v5` to ensure client service workers cleanly evict old audio caches, download the newly updated audio with `{ cache: 'reload' }`, and cache the new asset for offline PWA operation.

### 2. AI Diary Generation Overhaul & Pure Diary Storage (`v1.8.2`)
- **Pure Diary Entry Storage**:
  - Eliminated mechanical message transcripts from saved memories (`buildCapturedMemorySummary` previously built text logs like *"The interaction started around 14:02 with You saying '...' and ended with..."*).
  - Memories now store **authentic, intimate diary entries written in the persona's private first-person voice**, capturing their genuine thoughts, unspoken feelings about the user, and reflections on their time together.
- **Redesigned Journal Interface (`DateMemoryModal.tsx`)**:
  - Transformed the plain memory modal into an elegant diary/journal entry card with book/quill theme, date header, and customizable entry title.
  - Prominent **"Generate AI Diary"** action with live loading animations, multi-model retries, and instant editable journal reflection.
  - One-click **"Save to Persona's Diary"** action.
- **Multi-Model Diary Generation Pipeline**:
  - Upgraded `api/gemini/diary.ts`, `server/vertexHandler.ts`, and `services/geminiService.ts`.
  - Added multi-model fallback retry loops (`gemini-3.8-flash` -> `gemini-2.5-flash` -> `gemini-2.5-flash-lite`) with exponential backoffs to prevent transient rate limits or quota drops.
  - Rich prompt instructing the persona to write a secret, private journal entry with vulnerability, genuine feelings, and memorable conversation highlights.

### 2. `@rem` Memory Recall Command & Relevance Scoring (`v1.8.2`)
- **Full Syntax Support (`@rem`, `/rem`, `\rem`)**:
  - Updated regex across all message entry points (chat input, quick replies, service worker callbacks, URL parameters, offline queue) to `/[@\\\/]rem\b/i`.
  - Cleaned `@rem` from user message bubbles (e.g. *"Do you remember Kyoto? @rem"* displays cleanly in the bubble as *"Do you remember Kyoto?"*).
- **Intelligent Keyword & Token Relevance Scoring**:
  - Replaced naive exact-substring matching with tokenized relevance scoring.
  - Filters out conversational stopwords (`do`, `you`, `remember`, `what`, `when`, `did`, `about`, `our`, `in`, `at`, etc.).
  - Scores memories by keyword matches across `title` (5 pts), `startDate`/`endDate` (4 pts), and `summary` diary entry (2 pts), with exact phrase bonuses (10 pts).
  - Ranks and injects the highest-scoring diary memories. If the query is generic (e.g. bare `@rem`), brings up recent memories.
- **Top-Priority System Prompt Directive**:
  - Upgraded `buildFullPersonaSystemPrompt` in `geminiService.ts` and `vertexHandler.ts`.
  - Treated `[MEMORY RECALL]` as a top-priority directive instructing the persona to actively bring up the specific recalled diary memory in-character with genuine emotional warmth, nostalgia, or teasing.
  - Injected background awareness of recent diary entries so personas naturally remember past events even without explicit `@rem`.
- **Auto-Enable Memory**:
  - Saving a memory via `handleSaveMemory` automatically sets `memoryEnabled: true`.

### 3. Balanced Photo Activities & Authentic Smartphone Realism (`v1.8.2`)
- **Removed Strict Anti-Phone Prohibition**:
  - Softened anti-phone rules so that using a phone (mirror selfie, checking a notification, propping phone on table) is a natural everyday option rather than forbidden.
- **Dynamic Everyday Activity Sampler**:
  - Introduced `EVERYDAY_PHOTO_ACTIVITIES` and `getSuggestedActivitiesSample(count)` across `api/gemini/image-synthesize.ts`, `server/vertexHandler.ts`, and `services/geminiService.ts`.
  - Provides a fresh randomized set of 7 activities per synthesis request spanning domestic cozy, food & dining, study & creative, outdoor strolls, and casual selfies/tech.
- **Preserved Raw Mobile Realism**:
  - Retained authentic smartphone camera details: natural room/lamp lighting, realistic focal depth, slight handheld tilt, unposed candid framing.

---

### 4. Anti-Phone Cliché Overhaul & Diverse Candid Activities (`v1.8.1`)
- **Problem**: Characters in candid snapshots were overwhelmingly generated holding, staring down at, or illuminated by a glowing smartphone screen.
- **Root Causes**:
  - Prompt templates in `image-generate.ts`, `vertexHandler.ts`, and `geminiService.ts` explicitly suggested `"(looking at phone, lost in thought, or reaching for something)"` and `"screen glare illuminating face"`.
  - The fallback scenario list in `image-synthesize.ts` repeatedly recommended `"Living room couch browsing phone/laptop"`, biasing diffusion/Imagen models toward the screen-gazing cliché.
- **Overhaul & Fixes**:
  - Injected strict `CRITICAL ANTI-PHONE CLICHÉ RULE` across all synthesis prompts: The persona MUST NOT be holding, staring at, tapping, or illuminated by a smartphone/screen unless explicitly requested by the user.
  - Implemented diverse, authentic everyday activities and poses:
    - *Domestic cozy*: Brewing pour-over coffee/tea, holding a ceramic mug with both hands, reading a paperback novel, listening to over-ear headphones, sketching in a spiral notebook, tending to indoor houseplants.
    - *Snacking & dining*: Sipping bubble tea through a straw, peeling a mandarin/orange, holding a warm pastry or croissant, resting chin in hand across a dining table.
    - *Study & creative*: Writing in a journal with a pen, reviewing lecture notes, arranging study stationery, working on a craft.
    - *Outdoor & casual*: Strolling down a grocery/convenience store aisle with a hand basket, sitting cross-legged on park lawn, resting against a balcony railing looking out at the neighborhood.
  - Synchronized across: `api/gemini/image-synthesize.ts`, `api/gemini/image-generate.ts`, `server/vertexHandler.ts`, and `services/geminiService.ts`.

### 2. Multi-Message Deletion & Storage Cleanup (`v1.8.1`)
- **Action Toolbar Integration**: Added a **Delete** (`Trash2`) button directly to the existing multi-message selection header bar in `components/ChatWindow.tsx` (which appears on double-tap or selection mode).
- **Confirmation Safety**: Integrated a WhatsApp-themed confirmation modal (`ConfirmationModal`) informing the user of the exact number of messages being removed before proceeding.
- **IndexedDB Media Cleanup**: `handleDeleteMessages` in `App.tsx` inspects all deleted messages for `mediaId` or `attachment.mediaId` and immediately cleans up the corresponding image/audio blobs via `deleteMedia()` from IndexedDB to prevent orphaned storage bloat.
- **Chat State Integrity**: Automatically recalculates the chat's `lastMessage` and `lastMessageTime` from the remaining messages. Clears active `replyingTo` state if the replied-to message was among those deleted. Added identical media blob cleanup to `handleClearChat`.

### 3. Memory QOL: 1-Click "Save as Memory" from Selected Messages (`v1.8.1`)
- **One-Click Memory Extraction**: Added a **Save as Memory** (`Sparkles`) button to the message selection toolbar alongside Reply, Copy, and Delete.
- **Seamless Modal Flow**: Selecting meaningful messages (e.g., romantic moments, shared jokes, personal milestones) and tapping "Save as Memory" opens `DateMemoryModal` pre-populated with:
  - The calculated date range spanning the earliest to latest selected message.
  - The selected messages automatically passed as the highlighted message set.
- Allows users to turn authentic in-chat interactions directly into permanent long-term persona memories with zero friction or manual date picking.

---

### 4. In-Chat Authentic Smartphone Photo Generation (`@img` / `@image`) Overhaul (`v1.8.0`)
- **Trigger**: Typing `@img` or `@image` anywhere in the message input (e.g. *"send a selfie @img"*, *"show me your lunch @img"*). The tag is automatically stripped before displaying in the chat bubble.
- **Investigation & Root Causes Resolved**:
  1. *Transient Rate Limits & Lack of Retries*: Rapid back-to-back triggers previously hit 429 quota or timeouts with zero retries, immediately falling back to `generatePersonaImageExcuse`. Added exponential backoff retry loops (up to 3 attempts with 1.2s - 3s backoffs) in both serverless endpoints and client service.
  2. *Bare `@img` vs `@image [query]` Discrepancy*: Bare `@img` defaults to `"Send a photo"`, causing the synthesizer to select `"selfie"` or `"candid"` with avatar reference conditioning (`[Input Image 1]`), which was prone to Vertex AI face-matching and safety filter blocks. In contrast, `@image [query]` (e.g. food, desk) chose `"pov"` which skips reference images.
  3. *Gender Pronoun Misalignment*: Synthesis and generation previously hardcoded female pronouns (`"She is..."`, `"her face"`, `"same woman"`), causing severe prompt-image contradictions for male personas (Big Bro, Best Friend, Dad). Now dynamically resolves gender from `GEMINI_TTS_VOICE_DETAILS` (`male` vs `female`), persona role, and name.
  4. *Safety Filter Handling & Reference Resilience*: If reference-image face conditioning triggers safety filter blocks, the system automatically simplifies the prompt, strips the reference image, and retries with a natural snapshot prompt instead of instantly falling back to an excuse.
  5. *Time-of-Day Context Injection*: The client time context (`getAppTimeContext(settings)`) is now injected into synthesis, ensuring night photos generate cozy lamp/ambient lighting instead of daytime sunlight.
  6. *Broken Imagen Fallback Fixed*: Catch-block fallback previously passed `gemini-3.1-flash-lite-image` to `generateImages` (which only supports Imagen models). Fixed model to `imagen-3.0-generate-002`.
- **Pipeline Architecture**:
  1. **Step 1 (Context & Caption Synthesizer)**:
     - Calls `/api/gemini/image-synthesize` (or `server/vertexHandler.ts`).
     - Models: `gemini-3.8-flash` (attempt 1) with fallback to `gemini-2.5-flash` (attempt 2).
     - Incorporates `clientTimeContext`, persona mood, and message history.
     - Strict priority hierarchy: (1) Explicit user query, (2) Conversation history context for generic queries (`@img`, `@image`, `"Send a photo"`), (3) Time-appropriate everyday situations (couch, desk, kitchen, passenger seat).
  2. **Step 2 (Image Generation Engine)**:
     - Calls `/api/gemini/image-generate` (or local handler).
     - Models: `gemini-3.1-flash-lite-image` (attempt 1) -> `gemini-3.1-flash-image` (attempt 2) -> `imagen-3.0-generate-002` (generateImages fallback).
     - Aspect ratio set to `3:4` portrait mobile format.
     - Dynamic gender pronouns (`He/She`, `his/her`, `same man/woman`).
     - Neutral mobile photo phrasing (removed trademarked terms like "Snapchat" that could trigger content filters).
  3. **Step 3 (Fail-Safe Excuse Generator)**:
     - If all attempts fail or are permanently blocked, calls `/api/gemini/image-excuse` to keep immersion intact with natural in-character text excuses.
- **UI & Display**:
  - WhatsApp-native media bubble (`.media-message-bubble`) with `fit-content` max 330px width.
  - Image and caption are rendered together inside the exact same message card.
  - Clicking any image opens the `ImageLightboxModal` (full-screen blurred background, metadata, download button).

### 2. Vercel Serverless Function Deployment & Authentication
- **Resolved Issues**:
  - Fixed `ERR_MODULE_NOT_FOUND` by ensuring all `api/gemini/` endpoints (`image-synthesize.ts`, `image-generate.ts`, `image-excuse.ts`, `image.ts`, `generate.ts`, `diary.ts`, `tts.ts`, `status.ts`) are standalone and don't rely on cross-file internal ESM path aliases that break in Vercel bundle isolation.
  - Fixed `@google/genai` v1.38+ authentication: Replaced naive `new GoogleGenAI({ vertexAI: { project, location } })` with full `normalizePrivateKey` and multi-source credentials resolver (`vertexai: true, googleAuthOptions`). Supports Service Account JSON (`GCP_SERVICE_ACCOUNT_KEY`), Client Email + Private Key (`GCP_CLIENT_EMAIL` + `GCP_PRIVATE_KEY`), and fallback API keys (`VERTEX_API_KEY`, `GEMINI_API_KEY`).

### 3. Progressive Web App (PWA) & Offline Shell
- **Manifest & Mobile Integration**:
  - `public/manifest.json`: Full PWA metadata, `display: "standalone"`, `id: "/"`, `start_url: "/"`, `scope: "/"`, maskable SVG icons.
  - `index.html`: iOS Safari web-app-capable meta tags (`apple-mobile-web-app-capable`, `black-translucent` status bar, `apple-touch-icon`).
- **Service Worker Caching (`public/sw.js`)**:
  - Pre-caches core app shell (`/`, `/index.html`, `/manifest.json`, `/favicon.svg`, `/whatapp.wav`, `/msgsentpop.mp3`).
  - Stale-While-Revalidate caching for static assets.
  - Strictly bypasses `/api/` network requests so Gemini AI responses are always live.
  - Retains background push notification handling and inline quick-reply listeners.

### 4. Vite Bundle Optimization & Lazy Code-Splitting
- **Vite Rollup Chunking (`vite.config.ts`)**:
  - Configured `output.manualChunks` for immutable vendor libraries (`vendor-react`, `vendor-icons`, `vendor-genai`, `vendor-other`).
- **React Lazy-Loading (`App.tsx`)**:
  - Converted heavy on-demand overlay panels to `React.lazy()`: `ProfilePanel` (~47 kB), `SettingsPopover` (~32 kB), `GuidePanel` (~9 kB), `UpdatesPanel` (~10 kB), `NewChatPanel` (~5 kB), `NewGroupPanel` (~4 kB), `UserProfilePanel`, `CalendarNotesWidget`.
  - Wrapped modals in `<React.Suspense fallback={null}>`.
  - **Results**: Main entry bundle size plummeted from **755 kB down to 153 kB** (47.5 kB gzip), cutting initial load time and eliminating all bundle size warnings.

### 5. Story Event Trigger & Message Bubble Redesign
- **Trigger Event Modal (`components/MessageInput.tsx`)**:
  - Clean, minimalist WhatsApp Web dialog (`bg-white dark:bg-[#222e35] rounded-xl shadow-2xl w-full max-w-[380px]`).
  - Strict professional design: Zero generic AI fluff, zero sparkles, zero preset idea chips.
  - Form: Clean `Event title (optional)` input, `Description` textarea, optional image attachment button, and WhatsApp green `Send` button (`#00a884`).
  - Fallback logic: If title is empty, it cleanly extracts the first 5 words of description or defaults to `"Event"`.
- **Event Message Bubble in Chat (`components/ChatWindow.tsx`)**:
  - **Authentic WhatsApp Event Card**: Clean rounded card (`bg-white dark:bg-[#1f2c34] border border-black/10 dark:border-white/10 rounded-xl p-3.5 shadow-sm max-w-[380px] text-left`).
  - Minimalist green calendar tag: `Event` (`#00a884` with `Calendar` icon).
  - Bold event title (`font-semibold text-primary`) with separate secondary description (`text-secondary`).
  - **Clickable / Expandable Clamp**: Descriptions > 75 characters are cleanly clamped to 2 lines with a sleek `Read more / Show less` link and card tap toggle so long narratives never stretch the viewport.
  - Minimalist bottom-right timestamp format matching WhatsApp native messages.
  - **AI Prompt Integration**: Passes `[ENVIRONMENTAL EVENT OCCURS (Title)]: *description*` in `geminiService.ts`, `vertexHandler.ts`, and `api/gemini/generate.ts`.

### 6. Native Notification Shade Conversational Continuity & PWA Enhancements
- **Notification Shade Inline Reply Continuity**:
  - Full two-way dialogue support directly from the Android/system notification quick-reply shade without having to open the app.
  - **Message Fragmentation in Notification Shade**:
    - Ported full sentence and punctuation-aware `splitMessage` engine into `public/sw.js` (Service Worker scope).
    - AI responses generated in the background (whether processed by the Service Worker or background tab in `App.tsx`) are realistically fragmented into distinct chunks rather than dispatched as a single wall of text.
  - **Balanced, Snappy Stacking & Typing Delay Logic**:
    - Respects the user's **Message Stacking** toggle and **Stacking Delay** setting from the app.
    - If `enableTextStacking` is turned off in Settings, replies are immediate (`300ms - 600ms`).
    - If enabled, uses a brisk reading pause (`800ms - 1500ms`), snappy typing speed proportional to chunk length (`chunk.length * 16ms`, clamped to `500ms - 1500ms`), and brief inter-chunk pauses (`400ms - 700ms`) so conversations stay fast and engaging without boring the user.
  - **Clean Notification Hierarchy**:
    - Streamlined notification display: removed redundant `You:` and `[Persona Name]:` prefixes inside notification bodies. Messages stack cleanly in the notification card without clutter.
    - Removed synthetic "... is typing..." notification cards to keep shade clean and avoid notification spam.
  - **Full Conversational Context & History Parity**:
    - **Active Window Delegation**: When the app is open (even in the background), `public/sw.js` delegates inline notification replies directly to `App.tsx` via `INLINE_REPLY` postMessage, utilizing the live in-memory React chat state, media hydration, memory recall, and timing calculations.
    - **Autonomous Full-Context Parity**: When the app is closed, `public/sw.js` now receives the full contextual payload:
      - Extended rolling history window up to 35 messages (`slice(-35)`), completely resolving the previous 6-8 message memory loss bug.
      - Exact `clientTimeContext` (local/simulated user system time, e.g. "Tuesday, September 15, 2026, 10:35 PM").
      - `timeGapContext` (relative time elapsed: "last chatted yesterday", "been 4 hours", etc.).
      - Full `settings` (`shareTimeContext`, `shareCalendarNotes`, `calendarNotes`, `useSearchGrounding`).
      - Full `userProfile` (`name`, `about`, `status`).
      - Group context (`groupName`, `otherMembers`).
      - `buildFullPersonaSystemPrompt`: Unified system prompt builder in `services/geminiService.ts` used by both in-app chats and notification Custom API/Vertex calls.
  - **Offline Storage & Synchronisation**:
    - Full IndexedDB storage (`whatsapp_offline_db`) with `BACKGROUND_EXCHANGE_SYNC` broadcasts to keep client state and chats in sync across tabs and service workers.
    - Zero warning banners or intrusive offline indicators, maintaining uninterrupted immersion.

---

## 🏛️ Architecture & Key Components
```
Wassap/
├── App.tsx                      # Root component, global state, tab routing, provider switching
├── index.css                    # Tailwind base + custom WhatsApp CSS variables & bubble styling
├── types.ts                     # Core TypeScript data contracts (Persona, Message, HumaneSettings, etc.)
├── constants.ts                 # Default personas, templates, wallpapers, model lists
├── components/
│   ├── ChatWindow.tsx           # Main chat interface, bubble rendering, message grouping, media bubbles
│   ├── ChatList.tsx             # Left sidebar chat list, unread badges, last message preview
│   ├── MessageInput.tsx         # Chat footer, input bar, mic recording, @img trigger, attachments
│   ├── VoiceNotePlayer.tsx      # WhatsApp audio card, scrubbing waveform, speed toggle (1x/1.5x/2x)
│   ├── ImageLightboxModal.tsx   # Fullscreen photo viewer with download & caption
│   ├── ProfilePanel.tsx         # Persona editor: Voice Lab (30 voices), Schedule, Humane Settings, Memory
│   ├── SettingsPopover.tsx      # Global settings: Provider (Vertex vs AI Studio), Passcode, Wallpaper, Models
│   ├── UserProfilePanel.tsx     # User's own profile info (name, about, status)
│   ├── Sidebar.tsx              # Left navigation rail (Chats, Communities/Guide, Updates, Settings)
│   ├── GuidePanel.tsx           # In-app user manual & tips
│   └── UpdatesPanel.tsx         # In-app changelog timeline
├── services/
│   └── geminiService.ts         # Client-side AI orchestrator, switches between local/Vercel proxy and direct SDK
├── api/gemini/                  # Vercel Serverless Functions
│   ├── generate.ts              # Chat response generator (streaming & text)
│   ├── image.ts                 # Consolidated image router
│   ├── image-synthesize.ts      # Context & caption synthesizer
│   ├── image-generate.ts        # Image generation with reference image support
│   ├── image-excuse.ts          # Persona camera excuse generator
│   ├── tts.ts                   # Gemini-TTS voice synthesis (30 voices)
│   ├── diary.ts                 # AI persona diary generation for memory bubbles
│   └── status.ts                # Health check and environment probe
├── server/                      # Local Express Backend for development
│   ├── api.ts                   # Express router mapping /api/gemini/* to handlers
│   └── vertexHandler.ts         # Core Vertex AI SDK logic, models, prompt formatting
└── utils/
    ├── audio.ts                 # Audio recording, PCM conversion, WAV header packaging
    ├── storage.ts               # IndexedDB wrapper for media blobs and audio notes
    ├── imageCompressor.ts       # Canvas-based client-side image compression
    └── dates.ts                 # WhatsApp time formatting ("Today", "Yesterday", 24h clock)
```

---

## 🔑 Dual AI Provider System
1. **Built-in Cloud (Vertex AI) [Default]**:
   - Routes requests to `/api/gemini/*` (Vercel serverless functions in production, Express in local dev).
   - Protected by `VERTEX_PASSCODE` (`Ness2020`).
   - Uses Vertex AI service account or fallback API key stored securely in environment variables.
   - Recommended models: `gemini-3.8-flash` (chat default), `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite-image` (image generation).
2. **Custom API Key (Gemini AI Studio)**:
   - Client-side calls directly to `@google/genai` using the user's personal API key stored in `localStorage`.
   - Bypasses passcode requirements.
   - Ideal for users who want to use their own quotas and keys.

---

## 📜 Feature Milestones Completed
- [x] **v1.0.0 - v1.2.0**: WhatsApp Web UI layout, message send/receive, persona switching, basic Gemini integration.
- [x] **v1.2.5**: Exact inactivity check-in timer (seconds precision), context-balanced silence breakers.
- [x] **v1.3.0 - v1.3.1**: Memory Bubbles & Persona Diary, dynamic roleplay events, 24/7 weekday/weekend schedule, 24h time format, mobile view improvements.
- [x] **v1.4.0**: Humane Settings Engine (0-100 mood slider, ban robotic language, human imperfections), tiered message fragmentation, persona templates, memory export/import.
- [x] **v1.5.0**: Message stacking delay (5s - 30s) with grouped bubble visual rendering (hidden tails), relative time-gap awareness, chat frequency capping.
- [x] **v1.6.0**: Dual AI Provider (Vertex Cloud vs Custom Key), passcode lock, custom chat wallpapers with opacity controls, models `gemini-3.8-flash` & `gemini-3.7-flash`.
- [x] **v1.7.0**:
  - In-chat smartphone photo generation (`@img` / `@image`) with 2-step synthesizer + generator pipeline.
  - Three distinct realistic photo modes (`selfie`, `candid`, `pov`) with `user_wants_posed` override.
  - 30 Gemini-TTS voices with pitch/speed steering, emotional cues `[laughs]`, and interactive waveform audio cards.
  - Vercel production serverless function deployment with robust multi-credential authentication.
  - WhatsApp-native media bubble width clamping (`fit-content`, max 330px).
- [x] **v1.7.1**:
  - Full PWA Installability (manifest, iOS standalone tags, touch icons, offline app shell caching in `sw.js`).
  - Vite code-splitting and bundle chunking (`React.lazy()` for modals, Rollup `manualChunks`, reducing main bundle from 755 kB to 153 kB).
- [x] **v1.7.2**:
  - **Persona Reply Immersion**: Fixed generic `"Contact"` label in 1-on-1 chat reply previews and quoted bubbles by ensuring persona names (`chat.name`) and `"You"` are properly assigned and backfilled in state.
  - **Multimedia Reply Cues**: Quoted reply banners in UI display `📷 Photo` / `🎙️ Voice message` indicators, and AI prompt context is enriched with `[Replying to {author}'s photo: "{caption}"]` or `[Replying to {author}'s voice note (transcript: "...")]`.
  - **Voice Note Frequency Calibration**: Reduced Occasional frequency to 10% (was 20%) and Frequent to 30% (was 50%), with updated dropdown labels in `ProfilePanel`.
  - **Mobile Header Action Controls**:
    - Functional WhatsApp 3-dots menu dropdown on mobile (`New contact`, `New group`, `Settings`).
    - Working Camera action triggering mobile camera/gallery, complete with photo preview modal, persona selector dropdown, caption input, and instant send.
    - Working Scanner action modal with QR viewfinder reticle and link to Google Lens / system scanner.
- [x] **v1.7.3**:
  - **OG WhatsApp Ultra-Dark Theme (`#0b1014`)**: Migrated dark theme foundation to WhatsApp's authentic ultra-deep black `#0b1014` (RGB 11, 16, 20) across app body, chat viewport, sidebar, mobile headers, and navigation bars.
  - **Verdant Pulse Green (`#21c063`)**: Implemented the official `#21c063` (RGB 33, 192, 99) accent across FAB buttons, unread badges, unread timestamps, active navigation capsule pills (`#103629` / `#21c063`), active filter chips, send/mic controls, and switches.
  - **Flawless Top Status Bar & Notch Handling**: Dynamic `<meta name="theme-color">` syncing (`#0b1014` dark / `#ffffff` light) and mobile header `pt-[max(env(safe-area-inset-top),10px)]` eliminating unsightly mismatched status bars.
  - **Flawless Bottom Navigation & Gesture Bar**: Added `pb-[max(env(safe-area-inset-bottom),8px)]` to `MobileNavigation.tsx` so bottom bar background smoothly extends underneath the phone's home indicator bar, with dynamic elevation on the squircle FAB.
- [x] **v1.7.4**:
  - **Light Mode Chat Notification & Theme Contrast Fix**:
    - **Sidebar Notification Badge**: Connected `Sidebar.tsx` to dynamic `unreadCount={unreadTotal}` (rendered conditionally `unreadCount > 0`), replaced hardcoded `28`, and styled badge numbers with `text-white` on `#21c063`.
    - **Chat List Unread Badges**: Replaced dark `#0b1014` text on green badges with authentic `text-white` for crisp contrast and consistency with native WhatsApp light/dark modes.
    - **Unread Timestamps**: Calibrated to `text-[#1fa855] dark:text-[#21c063]` for WCAG-compliant contrast (>4.5:1) on white light mode backgrounds.
    - **Composer Send & Microphone Controls**: Restored WhatsApp's signature `text-white` glyphs on `#21c063` action buttons instead of conflicting dark glyphs.
    - **Mobile Actions**: Updated FAB icon and MobileNavigation badge to `text-white dark:text-[#0b1014]`, and updated modal action buttons to `text-white`.
    - **Refined Badge Geometry**: Reduced unread badge size to a sleek `18px` with `text-[11px] leading-none` in `ChatList.tsx`, and `17px` with `text-[10px]` in `Sidebar.tsx` and `MobileNavigation.tsx` for a subtle, authentic WhatsApp appearance.
- [x] **v1.7.5**:
  - **Vercel Serverless Payload Optimization (Fix 413 `FUNCTION_PAYLOAD_TOO_LARGE`)**:
    - **Client-Side Image Compression**: Created a high-performance `compressImage` utility in `utils/imageCompressor.ts` that downscales raw smartphone photos (which are typically 5MB-15MB from phone cameras) to max 1280px dimension at 0.78 JPEG quality (~100KB-200KB). Applied across Camera uploads, attachment menu, and event images.
    - **Smart History Sanitization**: Added `sanitizeHistoryForVertex()` in `services/geminiService.ts` to cap history at 30 messages and replace older base64 image and audio blobs with lightweight `'[ATTACHED]'` placeholders. Only the last 2 active media items (which Gemini multimodal consumes) keep their data. Drops payload sizes from >5MB down to ~200KB.
    - **Diary & Image Synthesis Payloads**: Sliced and stripped dead media fields from `messageHistory` before sending to `/api/gemini/diary` and `/api/gemini/image-synthesize`.
    - **Vercel 413 Graceful Handling**: Added specific 413 error status detection with helpful user feedback instead of cryptic failure.
- [x] **v1.7.6**:
  - **Schemeless 100% Background Native Notification Direct Replies & Bulletproof Direct Persona Navigation**:
    - **No Window Popup / Focus Stealing**: Service worker `INLINE_REPLY` dispatches directly via `postMessage` to existing client windows without calling `focus()` or `openWindow()`, allowing the user to reply from the OS notification shade without popping open the app.
    - **Background Window Dispatch**: `App.tsx` handles `INLINE_REPLY` by creating the user message, running persona response generation (including memory, schedules, and natural chunk splitting), and dispatching follow-up notifications entirely in the background.
    - **Direct Persona Opening on Notification Click**:
      - Fixed `notificationclick` user-activation bug where premature `notification.close()` outside `event.waitUntil` consumed Android/Chrome's transient activation and blocked `clients.openWindow()` / `client.focus()`.
      - Tapping notification card checks open windows, switches view to persona via `OPEN_CHAT`, and focuses. If no window is active, opens `/?chatId=...`.
      - Added URL parameter support on mount in `App.tsx` to automatically select persona and open chat view when launched via `/?chatId=...`, followed by clean URL replacement.
    - **IndexedDB Stabilization**: Restored single-responsibility `whatsapp_media_db` (v2) dedicated to `media_store` with `onversionchange` auto-closing and blocked prevention. Eliminated version downgrades and deadlocks that previously caused persona responses and typing indicators to hang.
    - **Direct Persona Opening on Desktop Fallback**: Desktop `new Notification()` fallback now navigates straight to persona on click.
- [x] **v1.7.8**:
  - **Continuous Native Notification Shade Conversations**:
    - **Fully Autonomous Service Worker Execution (Open, Background, or Closed)**: Fixed the background tab reply issue where Chromium throttled background tab timers or `!isFocusingChat` suppressed notifications. The Service Worker directly executes the Gemini call within `event.waitUntil`, updates the notification shade, writes to IndexedDB, and broadcasts `BACKGROUND_EXCHANGE_SYNC` to any open window in real-time.
    - **Clean Stacked Dialogue (No Name Prefixes)**: Removed `You:` and persona name prefixes from the notification body. Stacks conversation messages cleanly and naturally.
    - **No Intermediate Typing Fluff**: Removed the `... is typing...` notification for a clean, prompt response turnaround.
    - **Persistent In-Shade Reply Loop**: Notifications persistently retain the action buttons (`Reply` and `Mark as read`) after each persona turn, enabling full conversations without ever opening the app.
    - **Cross-Context Background Sync**: `App.tsx` reconciles `synced_background` on mount and on visibility change, seamlessly merging all notification-shade exchanges into chat history and `localStorage`.
  - **Bulletproof Offline PWA Loading & Low-Connectivity Resilience**:
    - **Fast-Timeout Navigation Strategy**: Added 1.5s network timeout with instant cached `/index.html` fallback in `sw.js`, eliminating 60-second freezes on flaky or 2G/subway networks.
    - **Dynamic Asset & Font Caching**: Stale-while-revalidate caching for all Vite JS/CSS bundles, SVG icons, and Google Fonts.
    - **Full Offline History Access**: Users can open the installed PWA offline, browse past chats, read previous conversations, and review media stored in IndexedDB.
    - **Seamless Background Sync Without Banner**: Removed the immersion-breaking yellow banner. Wassap operates cleanly and silently queues offline messages.
    - **Offline Outbox & Clock Icon (`pending`)**: Sending messages offline displays the authentic WhatsApp `Clock` icon (`status: 'pending'`) and enqueues to `whatsapp_offline_db.pending_outbox`. Upon network reconnection, messages automatically dispatch and change to sent ticks (`✓`), triggering persona replies.
- [x] **v1.7.9**:
  - **Elimination of Raw Technical Error Leaks & In-Character Resilience**:
    - **Root Cause Resolution**: Addressed raw Vertex AI JSON errors (`{"error":{"code":429,"message":"Resource exhausted...","status":"RESOURCE_EXHAUSTED"}}`) that were previously split by `splitMessage` and rendered as ugly green bubbles.
    - **Autonomous Retry & Model Fallback Pipeline**:
      - Implemented a 3-attempt retry loop with exponential backoff (`1.2s` -> `2.5s` + jitter) across Vercel Serverless (`api/gemini/generate.ts`), local dev server (`server/vertexHandler.ts`), and client-side Custom API Studio (`services/geminiService.ts`).
      - On retry after rate limits or transient overloads, automatically steps down to lighter, high-quota models (`gemini-2.5-flash`).
    - **Authentic WhatsApp In-Character Network Excuses**:
      - If transient API or network errors persist after all retries, the backend and client never dump raw stack traces or JSON. Instead, `getInCharacterNetworkGlitchExcuse()` generates natural WhatsApp messages matching the persona's speech style, about info, and language context (e.g. Hinglish: *"Arre network issue ho gaya tha mere side se 😅 ek baar wapas bolo?"* / English: *"Sorry, my wifi just cut out for a second! 😅 What were you saying?"*).
    - **Prompt Context & History Sanitization**:
      - Filtered out `isRawErrorMessage` from `sanitizeHistoryForVertex()` and `buildFullPersonaSystemPrompt()` so past glitches never poison prompt history or degrade future conversational quality.
    - **State Auto-Healing on Startup (`App.tsx`)**:
      - During initial `localStorage` hydration, any legacy chats containing raw JSON errors or `RESOURCE_EXHAUSTED` strings in message history or `lastMessage` previews are automatically healed into natural in-character replies.
    - **Service Worker Notification Shade Error Shield (`public/sw.js`)**:
      - Filtered notification history and wrapped background autonomous replies with `getGlitchExcuse()`, preventing raw technical errors from appearing in native OS notification cards.
- [x] **v1.8.0**:
  - In-chat authentic smartphone photo generation (`@img` / `@image`) overhaul with 2-step synthesizer + generator pipeline.
  - Three distinct realistic photo modes (`selfie`, `candid`, `pov`) with avatar reference conditioning, time-of-day lighting context, dynamic gender pronouns, and graceful excuses.
- [x] **v1.8.1**:
  - Anti-phone cliché overhaul with dynamic everyday activity pool (coffee, dining, study, outdoor, park).
  - Multi-message selection deletion with WhatsApp confirmation modal and automatic IndexedDB media blob cleanup.
  - 1-Click "Save as Memory" from selected messages with auto date spans.
- [x] **v1.8.2**:
  - Pure AI Diary generation overhaul saving genuine first-person persona reflections rather than mechanical chat logs.
  - Redesigned DateMemoryModal into an elegant journal entry card with multi-model fallback retry loops (`gemini-3.8-flash` -> `gemini-2.5-flash` -> `gemini-2.5-flash-lite`).
  - `@rem` memory recall command with tokenized relevance scoring, stop word filtering, and top-priority prompt directives.
  - Balanced photo realism allowing natural everyday activities without strict phone prohibitions.
- [x] **v1.8.3**:
  - Authentic sent message pop sound (`/msgsentpop.mp3`) on user sends across all message formats.
  - Non-blocking Web Audio API dual-buffer playback engine supporting concurrent overlapping of sent pop and incoming chimes (`/whatapp.wav`).
  - Foreground-only check (`!document.hidden`) ensuring sounds stay silent when backgrounded or minimized.
  - Service worker offline pre-caching (`wassap-shell-v5`) for complete PWA offline support.
- [x] **v1.8.4**:
  - Eliminated unintentional memory recall leakage on ordinary messages (restricted `[MEMORY RECALL]` directive to explicit `@rem` commands).
  - Complete, clean persona chat history reset in `ProfilePanel` and `ChatWindow` with optional memory bubble/diary purging.
  - Full purge of offline outbox, background exchanges, and immediate `localStorage` synchronization.
- [x] **v1.8.5**:
  - **45-Message Context Rolling Window**: Buffed in-chat rolling history from 30/35 to 45 messages across `geminiService.ts`, `App.tsx`, and `sw.js`, guaranteeing ~20-22 recent conversation turns are seamlessly recalled without token bloat or model overload. Kept strictly distinct from `@rem` long-term diary memory recall.
  - **Non-Stacking Date Dividers**: Scoped chat messages into isolated date group sections with `useMemo` in `ChatWindow.tsx`. CSS `sticky` positioning is strictly bounded within its date section container, naturally pushing previous date dividers out of view when scrolling across "Yesterday" and "Today" without any stacking or overlapping.
  - **Compact Native WhatsApp Mobile Date Pill**: Scaled down typography (`text-[9.5px] sm:text-[11px]`) and padding (`px-2.5 py-0.5 sm:px-3.5 sm:py-1`) for a sleek, authentic native WhatsApp appearance that does not crowd mobile screens.
  - **Sentience 2.0 Humane Settings Engine**: Completely overhauled the prompt engine across Vertex Cloud, Gemini Studio, and serverless handlers:
    - *Strict Anti-Robot Protocol*: Blocks AI clichés, corporate apologies, sycophantic echoing (parroting user messages), mandatory end-of-text interrogation questions, and unsolicited preachy advice.
    - *Authentic Texting Cadence & Imperfections*: Emulates casual texting flow with lowercase starts, organic abbreviations (`tbh, idk, yk, rn, prolly, gonna, wanna`), expressive vowel lengthening, and natural conversational fillers.
    - *Dynamic Message Pacing*: WhatsApp-native short bursts (1-2 lines max) with quick quips rather than structured essay monologues.
    - *7-Tier Nuanced Mood Engine*: Refined emotional directives from 0-15 (Very Annoyed/Curt) through 51-65 (Tranquil/Balanced) to 93-100 (Thrilled/Ecstatic) with strict rule never to state mood numbers directly.
    - *ProfilePanel UI Refresh*: Polished Humane Settings toggle copy and real-time mood tier indicator.
  - **Critical React Rules of Hooks Hotfix (`ChatWindow.tsx`)**: Resolved fatal crash on startup and chat selection caused by placing `useMemo` below an early `if (!chat) return (...)` check. Moved all hooks to the top level of `ChatWindow`, eliminating the `"Rendered more hooks than previous render"` error that triggered `AppErrorBoundary` ("Something went wrong").
  - **Service Worker Cache Invalidation (`wassap-shell-v6`)**: Bumped SW cache to v6 and enhanced `handleReset` in `index.tsx` with asynchronous `registration.update()` triggers to force-purge stale bundles across client devices.
- [x] **v1.8.6**:
  - **Native Notification Tray Experience & Left-on-Read Auto Reaction**:
    - *Persistent Mark as Read*: Repaired background mark-as-read syncing by recording actions to IndexedDB (`synced_background` table in `whatsapp_offline_db`) via `recordBackgroundMarkAsRead` and `saveMarkAsReadToIDB` in `public/sw.js`. The state cleanly synchronizes even if the PWA or browser tab is completely closed.
    - *Non-Dismissing Action Cards*: Clicking "Mark as read" or submitting an inline reply no longer closes the notification card. The notification stays quietly in the OS shade until the card itself is clicked to open the app.
    - *Left-on-Read Auto-Trigger with Natural Hesitation*: When a persona's message is marked as read without a reply (either via native notification or in-app), the persona waits a realistic hesitation period (6.5 to 10 seconds). If the user does not reply in that time, the persona automatically responds in-character to being left on read.
    - *Pop-up Native Notification on Persona Replies*: When the persona replies (either reacting to being left on read or answering an inline reply submitted through native notifications), the first chunk of their message actively pops up as a new native OS notification (`renotify: true`, `silent: false` with banner, sound, and vibration) to alert the user. Subsequent stacked fragments update smoothly and quietly (`silent: true`).
    - *Autonomous Background Reaction*: If all app tabs are closed, the Service Worker (`sw.js`) independently handles the Left-on-Read delay and generates the in-character response, displaying the pop-up notification directly from the background worker.
  - **In-App Click & Hold (Long-Press) "Mark as Read"**:
    - Implemented a 450ms long-press pointer detector (`handlePointerDown` / `handlePointerUpOrCancel` / `onContextMenu`) on `MessageBubble` with haptic feedback vibration (`navigator.vibrate(40)`).
    - Added a dedicated "Mark as read" button (`CheckCheck` in `#53bdeb` blue) to the top multi-message selection bar in `ChatWindow`.
    - Wired `onMarkAsRead` to update message states to `read`, clear unread counters, purge audio locks, and record to offline storage.
  - **Service Worker Shell v10 & Android RemoteInput Spinner Fix**:
    - *RemoteInput Spinner Dismissal*: Fixed an issue on Android (HyperOS/OneUI/AOSP) where submitting an inline reply caused an infinite circular loading spinner in the notification input box. In Android OS, a notification with active RemoteInput will remain in a "sending" state with a loading spinner until `event.notification.close()` is called on that notification instance. Added `event.notification.close()` before immediately presenting the updated notification card (`showNotification`) with the user's message (`You: <text>`), instantly clearing the spinner while keeping the card anchored in the notification shade.
    - *Bypassed Android Background Tab Throttling*: Fixed background replies failing or going nowhere when the PWA was backgrounded. On mobile devices, background browser tabs are heavily throttled/frozen by the OS. Instead of delegating to a suspended background window, the Service Worker now autonomously generates the persona reply within `event.waitUntil`, pops up the response notification, saves the exchange to IndexedDB, and broadcasts `BACKGROUND_EXCHANGE_SYNC` to open tabs.
    - *Mark as Read OS Action Clearing*: Calling `event.notification.close()` followed by immediate `showNotification` with `(Read ✓✓)` properly resets the OS action pending state on Android while keeping the card in the tray with the Reply action ready.
    - *SW Cache v10*: Bumped cache to `wassap-shell-v10` for instantaneous client updates.
- [x] **v1.8.7**:
  - **Native Notification Shade Dialogue Formatting & Subtle Line Divider**:
    - *Thin Hairline Divider*: Replaced redundant persona name prefix (`"Persona: message"`) in 1-on-1 notification cards with a subtle unicode hairline divider (`────────────────────` via `\u2500` flanked by newlines `\n────────────────────\n`). Mobile and desktop notification shades now render a delicate, light horizontal partition between turns that drastically improves readability.
    - *Clean Attributions*: Kept `"You: <text>"` for user turns. In 1-on-1 chats, persona names are omitted in the body since contact name and avatar already headline the notification card. In group chats, member attributions (`${personaLabel}: `) are cleanly placed after the divider.
    - *Threaded History Bounds*: In `public/sw.js` (both autonomous Left-on-Read reactions and inline quick-replies), dialog history is parsed by `DIVIDER` and bounded to the 2 most recent turns (`slice(-2)`), preventing message run-ons or notification shade overflow on Android.
    - *Foreground Sync Reliability*: Handled nullable `userMessage` in `App.tsx`'s `BACKGROUND_EXCHANGE_SYNC` listener to seamlessly synchronize standalone persona replies (like Left-on-Read reactions) into the chat history without runtime errors.
- [x] **v1.8.8**:
  - **Message Fragmentation Limits & Boundary Detection Overhaul**:
    - *Buffed Word Count Tiers*: Increased fragmentation limits across `App.tsx` and `public/sw.js`:
      - 1 chunk: $\le$ 8 words (preserved for instant short phrases).
      - 2 chunks: $\le$ 20 words (increased from 15).
      - 3 chunks: $\le$ 29 words (increased from 24).
      - 4-5 chunks: $> 29$ words ($\ge 30$ words approx).
      - Adjusted global hard caps: $\le 30$ words max 4 chunks, $\le 60$ words max 5 chunks.
    - *Smarter Natural Boundary Detection*:
      - Protected decimal numbers (e.g. `3.14`, `$10.50`) and common abbreviations (e.g. `etc.`, `dr.`, `mr.`, `vs.`) from spurious middle-of-sentence splits.
      - Trailing emoji detection (`[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]`) recognizes emojis as natural texting pause boundaries.
      - Punctuation handling now supports closing markdown symbols, quotes, and dashes (`[.!?,\;:\-~—–]+["'”’\)\]*_~]*$`).
      - Expanded conversational conjunctions (`["and", "but", "so", "because", "then", "or", "though", "plus", "also", "meanwhile", "anyway"]`) with a 2-word segment guard to prevent 1-word fragments.
  - **Sentience: Humane Settings "Vary Message Length" Dropdown & Prompt Editor**:
    - Added an expandable dropdown menu (`ChevronDown` / `ChevronRight`) directly under "Vary Message Length" in `ProfilePanel.tsx`.
    - Integrated preset selector (`VARY_MESSAGE_LENGTH_PRESETS` in `constants.ts`: Dynamic WhatsApp Pacing, Ultra-Short & Punchy, Expressive Multi-Bubble Bursts, Custom).
    - Added editable monospace prompt `<textarea>` so users can view and customize the exact prompt instructions sent to the AI, complete with a "Reset to default" button.
    - Supported custom `varyMessageLengthPrompt` across `types.ts`, `services/geminiService.ts`, `server/vertexHandler.ts`, and `api/gemini/generate.ts`.
    - *Bumped Service Worker Cache*: v12.
- [x] **v1.8.9**:
  - **Unified 1.8–2.5s Conversational Flow & Rapid Stacking Resumption**:
    - *Consistent 1.8s - 2.5s Phase Pacing*: Replaced overly long, variable delays (up to 3.8s–5.2s) across all active messaging phases with a unified, comfortable `1800 + Math.random() * 700` ms window:
      - Delivery delay (single tick to double grey ticks): 1.8s – 2.5s
      - Come-online delay (double grey ticks to persona online): 1.8s – 2.5s
      - Seen delay (double grey ticks to blue ticks): 1.8s – 2.5s
      - Thinking/reading delay (blue ticks to typing status): 1.8s – 2.5s
      - Typing duration (foreground message bubble preparation): 1.8s – 2.5s
      - Inter-message pause between fragmented chunks: 1.8s – 2.5s
      - Photo, audio note, and excuse preparation phases: 1.8s – 2.5s
      - Group response readiness and typing duration: 1.8s – 2.5s
    - *Streamlined Stacking Mode Cycle*: Removed premature and intrusive online status flips during the active text-stacking window. User messages are naturally marked delivered at 1.8s – 2.5s. When the stacking delay timer ends, all messages are immediately confirmed delivered (skipping redundant delivery waits) and the clean cycle begins immediately: Online (1.8s – 2.5s) $\to$ Seen / Blue ticks (1.8s – 2.5s) $\to$ Typing (1.8s – 2.5s) $\to$ Delivery.
    - *Preserved Lingering Online*: Persona stays online for 35 seconds (`schedulePersonaOffline` with 35,000 ms) before transitioning to offline, allowing seamless continued conversations without re-triggering the pickup phase.
    - *Service Worker Cache v13*: Bumped cache to `wassap-shell-v13`.

---

## ⚠️ Critical Engineering Rules & Constraints
1. **NEVER PUSH TO GIT**: The user explicitly requires that **only they push code to GitHub (`git push`)**. As an AI, never run `git push` or configure automated remote pushes.
2. **Always Run Verification**: Before reporting completion, always verify with `npm run build` and `npx tsc --noEmit` to guarantee zero compilation or bundling errors.
3. **Preserve Dual Provider Support**: Any changes to AI calling logic must preserve both Vertex Cloud (`geminiService.ts` proxy) and Custom API Key (direct client-side SDK) pathways.
4. **Vercel Serverless Isolation**: Files under `api/gemini/` must not import local non-bundled helper files that Vercel serverless builds cannot resolve. Keep them self-contained or import standard npm packages.
5. **Pixel-Perfect Authenticity**: Strictly adhere to WhatsApp Web UI patterns, colors, font families, and responsive spacing as documented in `design.md`.
6. **Always Update `memory.md`**: Update this file at the end of every completed task to record changes, milestones, and architectural notes for subsequent AI sessions.
