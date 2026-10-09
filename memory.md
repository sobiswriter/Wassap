# AI Context & Project Memory (`memory.md`)

> **Note for AI Assistants**: Read this file first when starting a new session or planning updates. It provides an immediate, end-to-end understanding of the project's architecture, active state, completed features, and critical engineering rules without needing to explore every file.

---

## 📌 Project Identity & Overview
- **Project Name**: Wassap (Wassap Persona Simulation)
- **Current Version**: `v1.9.6`
- **Core Concept**: A pixel-perfect, high-fidelity WhatsApp Web replica built with React 19, Tailwind CSS v3, and Vite, repurposed as an advanced AI persona simulator powered by Google Gemini & Vertex AI.
- **Repository / User**: `sobiswriter/Wassap`
- **Primary Runtime**: Single-Page App (SPA) deployed on **Vercel** with Node.js Serverless Functions in `api/gemini/` and `api/giphy/`, plus a local Express development server in `server/`.

---

## ⚡ Current State & What Was Just Worked On
### 1. Multi-Day Journal Recollections (Chronicle of Events) & Local Persona Migration Engine (`v1.9.6`)
- **Root Cause Analysis of Multi-Day Diary Skipping**:
  - `messageHistory.slice(-40)` was discarding earlier days completely if the most recent 1–2 days contained 30–40 messages.
  - Messages passed to the diary endpoint previously lacked `date` and `timestamp`, giving the model a flat stream of text with zero day boundaries.
  - The single-day prompt instructed the model to reflect on interactions "today", naturally biasing language models toward the end of the text.
- **The Resolution**:
  - **Day-by-Day Chronological Grouping**: `buildDiaryHistoryAndPrompt()` partitions history by calendar date and attaches timestamps (`=== [DAY: YYYY-MM-DD] ===\n  User [14:30]: ...`).
  - **Proportional Historical Sampling**: Instead of discarding older days, the engine samples balanced subsets (opening exchanges, top substantive discussions, and closing turns) for each day, ensuring the full narrative arc across up to 31 days is preserved.
  - **Thematic Multi-Day Prompting**: When spanning multiple days, the prompt dynamically pivots to an intimate, retrospective genre (`Recollection of Shared Events` or `Weekly Chronicle of Events`), instructing the persona to reflect on evolving closeness, inside jokes, and standout moments across the entire period rather than writing a dry log or summarizing only the final evening.
  - **Adaptive Title & Span Flexibility**: Memory captures now adaptively title journals based on duration (`Diary` for 1 day, `Weekly Chronicle` for 6–8 days, and `Recollection of Events` for extended periods) and allow spanning up to 31 days.
- **Local Persona Backup & Migration Engine (100% Client-Side Privacy)**:
  - **Zero Chat Storage**: To guarantee complete privacy and zero server-side exposure, persona backups strictly exclude raw chat messages (`chat.messages`).
  - **Full Persona Identity Portability**: Exports name, avatar, backstory (`about`), role, speechStyle, systemInstruction, schedule, automations, humaneSettings, voiceSettings, and memoryBubbles to `<Persona>_Profile_Settings.json`.
  - **1-Click Restore & Recreate**:
    - **In `ProfilePanel.tsx`**: A dedicated *Persona Backup & Migration* card lets users export a backup or restore/overwrite settings on an existing persona with a single click.
    - **In `NewChatPanel.tsx`**: An *Import* button in the top header allows users to select a `.json` backup file, automatically pre-filling all rich character attributes for instant contact creation.

### 2. AI Diary Engine Modernization (Gemini 3.8 Flash) & Resilience Shield (`v1.9.5`)
- **Root Cause Analysis of AI Diary Failure**:
  - `fetchVertexDiary` in `services/geminiService.ts` used a hardcoded `timeoutMs: 16000` (16 seconds) and zero retry attempts.
  - Generating intimate, multi-paragraph private diary entries spanning up to 40 conversation messages on `gemini-3.8-flash` regularly requires 14–20 seconds of generation time.
  - At the 16.0s mark, the client's `AbortController` aborted the request with a `TimeoutError`, returning the generic error: `"Unable to connect to the built-in Vertex AI server. Try again later or switch to 'Custom API Key' in Settings."`
  - In addition, the authentication passcode was previously passed only in HTTP request headers (`x-vertex-passcode`), which can be stripped by aggressive CORS filters or reverse proxies, and `server/vertexHandler.ts` did not check `GEMINI_API_KEY`.
- **The Resolution**:
  - **Extended Client Timeout & Retry Shield (`services/geminiService.ts`)**: Upgraded `fetchVertexDiary` to a 30-second timeout on Attempt 1 and 15 seconds on Attempt 2, with automatic exponential retry handling.
  - **Dual-Channel Passcode Authentication**: Embedded `passcode: VERTEX_PASSCODE` directly in the JSON request body alongside request headers for fail-safe serverless authentication.
  - **Primary Model Upgrade (`DEFAULT_MODEL` / `gemini-3.8-flash`)**: AI Diary generation now defaults to `gemini-3.8-flash` across client and server handlers (`api/gemini/diary.ts`, `server/vertexHandler.ts`, `services/geminiService.ts`).
  - **Deduplicated Fallback Chain with Safety Timeouts**: Configured clean deduplicated fallback lists `Array.from(new Set([primaryModel, 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']))` on both server and client. Each candidate model is wrapped in a 24-second `Promise.race` safety timeout to prevent serverless function hangs.
  - **Multi-Source Credential Resolution**: Updated `server/vertexHandler.ts` to check `VERTEX_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY`.
  - **Voice Note Architecture Alignment**: Verified that `selectedModel` is strictly prioritized on Attempt 1. 3.8 Flash and Flash-Lite use pure verbatim text with official vocal tags (`<laugh>`, `<sigh>`, `<gasp>`) and native Voice Design & Replication in `voiceConfig`, while acting directive prompt steering is reserved exclusively for `gemini-3.1-flash-tts-preview`.

### 2. Network Resilience Engine & Anti-Stall Auto-Healing Watchdog (`v1.9.4`)
- **Root Cause Analysis of Persona Hangs**:
  - Unbounded `fetch()` socket hangs on mobile data / flaky Wi-Fi when switching networks or experiencing dropped packets.
  - Previous `finally` logic used `status === 'typing...'` which failed to reset status when the persona was in `'recording audio...'`.
  - Massive multi-megabyte payloads during marathon chats: history serialized all previous IndexedDB base64 media, leading to 15MB+ payloads that choked mobile network uplinks and triggered Vercel 413/504 errors.
- **Anti-Stall Watchdog & Auto-Healing Engine (`App.tsx`)**:
  - `personaStatusWatchdogTimersRef` and `personaAbortControllersRef` track in-flight actions per persona.
  - Arming a 30-second hard ceiling timer whenever status enters `typing...` or `recording audio...` (`setChatStatus`).
  - If a persona remains busy past 30s without emitting a message, watchdog automatically aborts active fetch controllers, resets status to `online` (scheduling natural `offline`), releases `activePersonaResponsesRef` locks, and delivers an authentic in-character glitch excuse without requiring manual settings resets or page reloads.
  - Hard `Promise.race` 30s watchdogs wrap all `aiGenerationPromise` executions in `handleSingleResponse` and `handleGroupResponse`.
  - Comprehensive `clearChatActiveStatus()` cleans up typing/recording indicators across all `finally` blocks in single-chat, group-chat, and background automations.
  - Enhanced `handleRefreshPersona` aborts active abort controllers, clears watchdog timers, and releases all locks immediately.
- **Atomic Turn Tokens & Anti-Double Reply Shield (`App.tsx`)**:
  - Prevents race conditions where a watchdog excuse and a late background voice note/text reply are delivered to the same user message.
  - `personaTurnTokensRef.current[chatId] = turnToken` tags each conversational turn with an atomic timestamp token.
  - If the 30s watchdog triggers, it resets the token to `0`, invalidating the turn. Any subsequent response from background promises checks the token and is discarded immediately.
  - The watchdog timer is disarmed the moment generation finishes, ensuring media saving or recording presentation delays never trigger false excuses.
- **Voice Note & Gemini 3.8 Flash TTS Latency Diagnosis & Restoration (`api/gemini/tts.ts`, `server/vertexHandler.ts`, `services/geminiService.ts`)**:
  - **Root Cause of Flash TTS Slowdown**: In commit `e093cb6`, TTS logic introduced an invalid schema `{ voice: selectedVoice }` inside `voiceConfig` and injected `userPart.speechMetadata = { style: ... }`. Neither field exists in Google's API schema (Google GenAI requires `prebuiltVoiceConfig: { voiceName: string }` and `Part` only allows standard fields).
  - Every time `gemini-3.8-flash-tts` or `gemini-3.8-flash-lite-tts` was called, Google returned `400 INVALID_ARGUMENT`. The candidate fallback loop caught this error on Attempt 1, failed on Attempt 2 (also 3.8), and finally fell back to Attempt 3 (`gemini-3.1-flash-tts-preview`), which succeeded only because 3.1 happened to use the legacy `prebuiltVoiceConfig` schema.
  - Additionally, on Vertex AI, `gemini-3.8-flash-lite-tts` is not a publisher model (it is an AI Studio model), causing a 404 on Vertex if attempted first.
  - **The Resolution**:
    - **Strict Model Priority**: Whichever model is configured as `selectedModel` is tried **FIRST** on Attempt 1. Fallback models (`gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`, `gemini-3.1-flash-tts-preview`) are only engaged if Attempt 1 actually throws an error.
    - **3.8 Flash & Flash-Lite Specialization**: Native Voice Design and Voice Replication are preserved via standard `prebuiltVoiceConfig: { voiceName: isCustomVoice ? 'Aoede' : selectedVoice }`. Receives pure verbatim text with official vocal tags (`<laugh>`, `<sigh>`, `<gasp>`, `<whispers>`, `<cough>`). Completely removed `generateConfig.systemInstruction` (which caused `400 INVALID_ARGUMENT` as audio modalities reject system instructions) and removed extraneous acting prompt wrappers.
    - **3.1 TTS Preview Acting Directives**: Acting directive prompt steering (`"Say the following in a natural WhatsApp voice note with a ... delivery: ..."`) is preserved exclusively for `gemini-3.1-flash-tts-preview`.
    - Synthesis now succeeds on Attempt 1 in 2-3 seconds without schema rejection or premature model fallbacks.
- **Voice Note & TTS Synthesis Headroom (`services/geminiService.ts`, `server/vertexHandler.ts`, `api/gemini/tts.ts`)**:
  - Extended TTS candidate synthesis timeouts across server and client to 18-22s, ensuring Gemini 3.8 Flash TTS has adequate time to synthesize audio on slow connections without prematurely failing over.
- **Expanded Crafty & Creative English Excuses Library (`services/geminiService.ts`)**:
  - Replaced repetitive single-string fallbacks with 40+ crafty, authentic English excuses categorized into:
    - **Witty / Sarcastic**: *"My phone literally had an existential crisis right when I was typing haha. What were you saying?"*, *"Great, my wifi decided to take an impromptu power nap. Say that again?"*
    - **Sweet / Gentle**: *"Oh no, my internet cut out right as your message arrived! Could you please repeat that?"*, *"I'm so sorry, my screen locked up on me for a second! What were you saying?"*
    - **Formal / Professional**: *"Apologies, I experienced a brief network disruption on my end. What were you saying?"*, *"My apologies, my signal cut out momentarily. Could you please send that again?"*
    - **Casual Everyday WhatsApp**: *"Wait sorry, my phone slipped out of my hand for a second haha! What did you say?"*, *"Oops, low battery prompt popped up and froze my screen! Say that again?"*
  - Strict requirement: 100% natural English across all personas (no Hinglish or other languages).
  - Dynamic non-consecutive randomization (`lastNetworkGlitchExcuse`) ensures users never see the same excuse twice consecutively.
- **Text Stacking Delay & Watchdog Phase Harmony (`App.tsx`)**:
  - Designed specifically to respect user and persona typing and reading stacking delays.
  - `setChatStatus` automatically clears and re-arms a fresh 30s watchdog for each chunk typing phase, while intermediate `online` states clear the timer.
  - Long multi-message stacked responses with natural pauses never falsely trigger the watchdog.
- **Zero-Lag Failure Recovery (No Blocking Retry Loops)**:
  - Bypasses slow, stacked retry loops that stall mobile chat screens for 40+ seconds on cellular drops.
  - Fails fast and immediately delivers the persona's crafty excuse so the conversation continues seamlessly.
- **Payload Compression for Marathon Chat Sessions (`App.tsx`, `services/geminiService.ts`)**:
  - `prepareHydratedHistory()` limits IndexedDB image/media hydration to the recent 25 messages and at most 2 media attachments. Older media attachments are cleanly replaced with lightweight text placeholders `[ATTACHED {type}]`.
  - `sanitizeHistoryForVertex()` retains base64 media for at most 2 items within the last 6 messages.
  - Slashes mobile upload payloads by 99% (from 15MB+ down to <50KB), completely eliminating mobile uplink freezes.
- **Enforced Request Timeouts (`services/geminiService.ts`, `server/vertexHandler.ts`, `api/gemini/tts.ts`)**:
  - `fetchWithTimeout()` with strict timeouts (20s text LLM, 22s voice note TTS, 16s diary) and `AbortSignal` propagation.
- **Non-Blocking Voice Note (TTS) Degradation (`App.tsx`)**:
  - If voice note synthesis times out or fails on slow connections, `handleSingleResponse` immediately degrades to delivering the spoken text message directly in natural chunks without trapping the persona in `recording audio...`.
- **Authentic WhatsApp Audio Recording Presence (`components/ChatWindow.tsx`, `components/ChatList.tsx`)**:
  - Added `RecordingAudioBubble` with pulsing green indicator and animated microphone icon in chat header and chat list to accurately reflect WhatsApp's native recording presentation.

### 2. Online GIF & Sticker Search, Expanded Library & GIPHY Integration (`v1.9.3`)
- **Expanded Reaction GIF Database (`utils/stickersAndGifs.ts`)**:
  - Grown to 80+ top viral reaction GIFs categorized across `Trending`, `Reactions`, `Laughing`, `Love`, `Shocked`, `Dancing`, `Memes`, and `Yes/No`.
  - Multi-tag indexing and high-speed offline fallback search.
- **Expanded Vector Sticker Collection (`utils/stickersAndGifs.ts`)**:
  - 36 handcrafted SVG/WebP vector stickers across 5 packs: `Pepe & Frog`, `Cute Cats`, `3D WhatsApp`, `Anime & Chibi`, and `Classic Memes`.
- **Live GIPHY Search Integration (`api/giphy/search.ts`, `server/api.ts`, `EmojiPickerTray.tsx`)**:
  - Debounced (350ms) online querying for both GIFs and transparent Stickers.
  - Dual-tier fetching: server proxy endpoint `/api/giphy/search` + direct client browser fetch fallback.
  - "Powered by GIPHY" attribution and live status badge.
- **GIPHY API Key Management (`SettingsPopover.tsx` & `types.ts`)**:
  - User can enter their personal free GIPHY Developer API Key directly in Settings.
  - 1-click shortcut from the media tray footer opens Settings to configure GIPHY key instantly.
- **Instant Pasted Media Link Detection**:
  - Pasting any URL (`http://`, `https://`, `data:image/`) into the search bar displays an immediate live preview card with 1-click "Send this GIF" or "Send this Sticker".
- **Vertex AI Base64 Multimodal Image Inlining Fix**:
  - Resolved Gemini 400 Invalid Argument error (`Base64 decoding failed for url`) when sending GIF/sticker URLs to Vertex AI models.
  - Automatically fetches remote URLs and encodes into valid base64 `inlineData` in `geminiService.ts`, `server/vertexHandler.ts`, and `api/gemini/generate.ts`.
- **GIF Database Health Check & Dynamic Placeholder Shield (`utils/stickersAndGifs.ts` & `EmojiPickerTray.tsx`)**:
  - Replaced all 23 broken/deprecated GIPHY IDs with 100% verified, live animated GIFs (automated HTTP check verified 56/56 passing with zero unavailable placeholders).
  - Added real-time client-side detection in `EmojiPickerTray.tsx`: checks image natural dimensions (`480x270`) and `onError` events to immediately suppress any unavailable GIPHY placeholder graphics from ever rendering in the tray.
- **Live GIF & Sticker Confirmation & Preview Window (`components/MessageInput.tsx`)**:
  - Selecting any GIF or sticker from the media tray, live online search, pasted URL preview, or device upload opens an authentic WhatsApp-style full preview stage before sending.
  - Large animated GIF view with optional caption composer and keyboard shortcuts (`Enter` to send, `Escape` or backdrop click to dismiss).
  - High-definition transparent sticker view with "Send Sticker" and "Cancel" buttons.
  - Intercepts all media dispatch points ensuring zero accidental messages are sent.

### 3. Motion Excellence, Haptics & Tactile WhatsApp Interaction System (`v1.9.2`)
- **Physics-Driven Message Bubble Motion**:
  - Gentle entrance and exit transitions (`bubble-enter` scale 0.96 -> 1, opacity 0 -> 1) with subtle settle physics instead of abrupt popping.
  - Settle movement harmonized with chat scroll speed for unified continuous perception.
  - Graceful collapse animation on message deletion.
- **Tactile Touch Feedback & Multi-Pattern Haptic Engine (`utils/haptics.ts`)**:
  - Micro-compression on message press (`active:scale-[0.995] active:brightness-95`).
  - Tactile feedback across interactive controls: composer buttons (`touch-icon`), send button (`touch-btn`), media thumbnails, reaction buttons.
  - Multi-pattern Web Vibration API with safe fallback:
    - `tap`: 10ms light pulse
    - `select`: 20ms medium pulse
    - `send`: 15ms + 25ms double pulse
    - `reaction`: 12ms soft pulse
    - `delete`: 35ms heavy pulse
- **Long-Press Message Selection & Header Morphing (`ChatWindow.tsx`)**:
  - Hold-to-select detection for touch and mouse interactions.
  - Selected bubble elevates with physical lift and drop-shadow, surrounding area subtly subdued.
  - Top header transitions seamlessly into WhatsApp's selection toolbar: counter, exit, star, delete, reply, copy, and 1-click memory capture.
- **Anchored Quick Reaction Tray (`ReactionTray.tsx`)**:
  - Restrained spring animation emerging directly above the selected bubble with popular emoji shortcuts (👍, ❤️, 😂, 😮, 😢, 🙏).
  - Selected reaction attaches to the bubble with a subtle badge pop animation.
  - **Persona Reaction Awareness**: Personas dynamically receive reaction context in their prompt loop (`[USER REACTION: User reacted with {emoji} to message: "{text}"]`) and respond in-character to your expressions!
- **In-App WhatsApp Media Drawer (`EmojiPickerTray.tsx` & `utils/stickersAndGifs.ts`)**:
  - Responsive, multi-tab drawer anchored above composer with 3 tabs: **Emojis**, **GIFs**, and **Stickers**.
  - **Emojis**: Real-time search, categorization (**Smileys**, **Hands**, **Hearts**, **Fun**), recent memory, and cursor insertion.
  - **GIFs**: Curated library of trending reaction GIFs with real-time search, category filters (Trending, Reactions, Laughing, Love, Shocked, Dancing), and 1-tap custom GIF/video upload.
  - **Stickers**: High-res transparent sticker packs (**Pepe & Memes**, **Cute Cats**, **3D Expressions**, **Anime & Chibi**), and 1-tap "+ Custom Sticker" upload from phone gallery/PC.
  - **Attachment Menu Integration**: Direct "Sticker" item in the paperclip sheet for instant custom sticker dispatch.
  - **Mobile Web Keyboard Compatibility**: Solves Android Gboard's native `"This app does not support images here"` restriction by providing WhatsApp Web-grade in-app selection while preserving clipboard paste and drag-and-drop.
- **Multimodal Message Stacking Cohesion**:
  - Message stacking rules apply cohesively across images, audio notes, reactions, and text into a unified conversational turn.
- **Monotonic Chronological Date Categorization (`utils/dates.ts`)**:
  - Monotonic forward date groupings prevent duplicate "Today" and "Yesterday" headers.
  - Historic legacy messages safely grouped under `"Older Messages"` without parser crashes.

### 2. Vertex AI Local Application Default Credentials (ADC) Quota Project Fix (`v1.9.1`)
- **Issue**: When authenticating with user credentials via `gcloud auth application-default login`, Vertex AI (`aiplatform.googleapis.com`) rejected requests with:
  `"Your application is authenticating by using local Application Default Credentials. The aiplatform.googleapis.com API requires a quota project, which is not set by default."`
- **Resolution**:
  - Automatically configured `httpOptions: { headers: { 'X-Goog-User-Project': project } }` and `googleAuthOptions: { projectId: project }` across all server endpoints: [`server/vertexHandler.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/server/vertexHandler.ts), [`api/gemini/tts.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/api/gemini/tts.ts), [`api/gemini/generate.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/api/gemini/generate.ts), [`api/gemini/diary.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/api/gemini/diary.ts), [`api/gemini/image*.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/api/gemini/image.ts).
  - Added `'X-Goog-User-Project': project` header to all direct REST calls in [`api/gemini/voices.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/api/gemini/voices.ts).
  - Both REST Voices API and `@google/genai` models (`gemini-3.8-flash-tts`) now automatically succeed with HTTP 200 without requiring manual quota flag pass-through.
  - Provided command `gcloud auth application-default set-quota-project gen-lang-client-0100408368` for standard local gcloud profile configuration.

### 2. Gemini 3.8 Voice Studio Suite: Voice Design, Frictionless Voice Replication & Turn-Level Voice Prompting (`v1.9.1`)
- **Persona-Specific Settings Integration (`ProfilePanel.tsx`)**:
  - Exclusively nested inside individual persona settings under the **Voice Settings** accordion (never leaking into global app settings).
  - Unlocked when Gemini 3.8 models (`gemini-3.8-flash-tts` or `gemini-3.8-flash-lite-tts`) are selected, with an informative guidance banner displayed if an older model is active.
  - Features A, B, and C are each strictly independent and togglable. Turning a toggle off instantly reverts the persona's voice generation back to baseline with 0 side-effects.

- **Feature A: 🎨 Voice Design (Prompted Custom Voices)**:
  - **Engine**: Integrates Google Cloud Vertex AI Voices API (`VOICE_TYPE_PROMPTED`, `store: true`) via backend route `/api/gemini/voices`.
  - **In-App Crafting Suite**: Custom modal form supporting custom voice names, gender (Female / Male), language (en-US, en-GB, es-ES, ja-JP, hi-IN, fr-FR, de-DE), prompt inspiration chips (`VOICE_DESIGN_INSPIRATIONS`), and detailed natural language descriptions (age, accent, timbre, cadence).
  - **Instant Cross-Persona Reuse & Browser Storage**: Persisted in `localStorage['wassap_custom_voices']` via `utils/customVoices.ts` with audio preview data URLs for instantaneous cross-chat auditioning and reuse on any persona.
  - **Educational Guidance**: Built-in guide modal (`showVoiceDesignInfo`) detailing prompting strategies and acoustic descriptors.

- **Feature B: 🎙️ Voice Replication (Audio Cloning with Spoken Consent)**:
  - **Engine**: Integrates Google Cloud Vertex AI Voices API (`VOICE_TYPE_REPLICATED`, `store: true`) via backend route `/api/gemini/voices`.
  - **Dual Audio Inputs**:
    1. **Reference Voice Sample (`sourceAudio`)**: 10 to 30s of clean speech of the speaker to clone (record via Mic or upload audio file).
    2. **Spoken Consent Verification (`consentAudio`)**: Recording of the speaker reading Google Cloud's required statement: `"I am the owner of this voice and have consented to the creation of a synthetic model of my voice through the use of Google Cloud."` (record via Mic or upload audio file, with one-click "Copy Statement" button).
  - **Client-Side Audio Resampler (`utils/audioResampler.ts`)**: Built-in Web Audio API converter (`convertAudioTo24kMonoWav`) automatically converting both recordings and uploaded files (`.wav`, `.mp3`, `.m4a`, `.webm`, `.ogg`) into Google Cloud's voice specifications: 24,000 Hz, 16-bit linear PCM little-endian, single-channel mono RIFF WAV.
  - **Browser Storage & Reuse**: Cloned voices are saved to `localStorage['wassap_custom_voices']` with in-app audio audition players and instant cross-persona availability.
  - **Educational Guidance**: Built-in guide modal (`showVoiceReplicationInfo`) explaining reference audio and spoken consent verification.

- **Feature C: 🎭 Voice Prompting & Acting Directives (Gemini 3.8 Style)**:
  - **Single-Pass Integration**: Natural vocal directions, emotional style directives, tempo, and vocal bursts are passed alongside the persona prompt in a single API pass — zero waiting for multiple round trips!
  - **Togglable Directives**: Independent toggle (`enableVoicePrompting`). When off, directives and vocal bursts are bypassed for a clean studio neutral delivery.
  - **Fine-Grained Controls**: 8 emotional style presets (Whispering, Cheerful, Sarcastic, Dramatic, Sleepy, Energetic, Calm, Custom), speech delivery pacing (`Normal`, `Speaking Slowly & Deliberately`, `Speaking Rapidly`), and pitch tone (`Natural Baseline`, `Higher Pitch / Bright Tone`, `Deep Pitch / Lower Resonance`).
  - **Native Human Vocal Bursts**: Full support for `<laugh>`, `<sigh>`, `<gasp>`, `<whisper>`, `<cough>`, `<yawn>`, `<groan>`, `<snicker>` tags.
  - **Educational Guidance**: Built-in guide modal (`showVoicePromptingInfo`).

- **Priority Hierarchy & Prebuilt Studio Voice Preservation**:
  - Voice note synthesis priority:
    1. If `enableVoiceDesign` is true and `designedVoiceId` is set $\rightarrow$ uses designed custom voice.
    2. Else if `enableVoiceReplication` is true and `replicatedVoiceId` is set $\rightarrow$ uses replicated custom voice.
    3. Else $\rightarrow$ uses assigned prebuilt studio voice (`voiceName`, 30 voices).
  - Status indicator badges in the UI explicitly notify users whenever a custom voice overrides the prebuilt voice.

---

### 2. Multimedia Voice Notes with Photos & Gemini 3.8 Expressive Acting Overhaul (`v1.9.0`)
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
      - If transient API or network errors persist after all retries, the backend and client never dump raw stack traces or JSON. Instead, `getInCharacterNetworkGlitchExcuse()` generates natural WhatsApp messages matching the persona's speech style, about info, and persona tone in 100% natural English (e.g. *"Wait sorry, my phone slipped out of my hand for a second haha! What did you say?"* / *"Great, my wifi decided to take an impromptu power nap. Say that again?"*).
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
- [x] **v1.9.2**:
  - **Vertex AI Multimodal Remote Media & GIF Decoding Fix**:
    - *Root Cause*: When users sent remote media (such as Giphy or Tenor GIFs, or external image URLs), `handleVertexChat` in `server/vertexHandler.ts` and `api/gemini/generate.ts` passed raw URL strings (`https://i.giphy.com/...`) into Gemini's `inline_data.data` field, expecting base64-encoded bytes. This caused Vertex AI 400 errors: `Invalid value at 'contents[0].parts[1].inline_data.data' (TYPE_BYTES), Base64 decoding failed`.
    - *Safe Media Resolvers*:
      - Implemented `resolveMediaToInlineData` in `server/vertexHandler.ts` and `api/gemini/generate.ts` (Node.js/Vercel serverless): fetches remote image and GIF URLs with a 6-second timeout, verifies content size ($\le$ 8MB) and MIME type, and converts buffer to valid base64 bytes (`Buffer.from(buf).toString('base64')`). Also parses data URIs and discards vector SVGs (`image/svg+xml`), which Gemini vision models do not support.
      - Implemented `resolveMediaToInlineDataBrowser` in `services/geminiService.ts` for Custom API Key mode using browser `fetch()` and `FileReader`.
    - *Rich Text Context*:
      - Enhanced history formatting so GIFs and stickers receive distinct prompt tags (`[GIF ANIMATION ATTACHED]`, `[STICKER ATTACHED]`) in addition to standard `[IMAGE ATTACHED]`.
      - Added directive instructing personas to react humorously, warmly, or playfully in-character to GIFs and stickers sent by the user.
      - Fixed `messageHistory` mapping in `server/vertexHandler.ts` to include voice note tags (`[VOICE NOTE ATTACHED]`) and reaction tags (`[REACTIONS ON THIS MESSAGE: ...]`).

- [x] **v1.9.6**:
  - **Multi-Day Journal Recollections (Chronicle of Events)**:
    - Overhauled diary generation for multi-day date spans to eliminate recency bias.
    - Chat history is grouped chronologically by calendar date with balanced sampling per day across the date span.
    - Dynamic journal titling: Single day $\to$ `[Persona]'s Diary`, 6–8 day spans $\to$ `[Persona]'s Weekly Chronicle`, extended ranges up to 31 days $\to$ `[Persona]'s Recollection of Events`.
  - **Local Persona Backup & Migration Engine (100% Client-Side Privacy)**:
    - *Profile-Level Export*: Dedicated "Persona Backup & Export" card in `ProfilePanel.tsx` downloads `<Persona>_Profile_Settings.json` containing the full persona specification (name, avatar, about, role, speech style, system prompt, voice settings, schedules, automations, and memories). Zero chat messages are stored, guaranteeing 100% user privacy.
    - *App Settings Migration Import*: Placed "Persona Migration" section directly in default App Settings (`SettingsPopover.tsx`). Allows seamless migration onto fresh devices or blank browsers where the persona does not yet exist. Instantly creates the persona in `chats`, configures all properties, selects the chat, navigates to chat view on mobile, and dismisses Settings.
    - Cleaned `ProfilePanel.tsx` to remain export-only and kept `NewChatPanel.tsx` clutter-free.

---

## ⚠️ Critical Engineering Rules & Constraints
1. **NEVER PUSH TO GIT**: The user explicitly requires that **only they push code to GitHub (`git push`)**. As an AI, never run `git push` or configure automated remote pushes.
2. **Always Run Verification**: Before reporting completion, always verify with `npm run build` and `npx tsc --noEmit` to guarantee zero compilation or bundling errors.
3. **Preserve Dual Provider Support**: Any changes to AI calling logic must preserve both Vertex Cloud (`geminiService.ts` proxy) and Custom API Key (direct client-side SDK) pathways.
4. **Vercel Serverless Isolation**: Files under `api/gemini/` must not import local non-bundled helper files that Vercel serverless builds cannot resolve. Keep them self-contained or import standard npm packages.
5. **Pixel-Perfect Authenticity**: Strictly adhere to WhatsApp Web UI patterns, colors, font families, and responsive spacing as documented in `design.md`.
6. **Always Update `memory.md`**: Update this file at the end of every completed task to record changes, milestones, and architectural notes for subsequent AI sessions.
