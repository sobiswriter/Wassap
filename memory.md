# AI Context & Project Memory (`memory.md`)

> **Note for AI Assistants**: Read this file first when starting a new session or planning updates. It provides an immediate, end-to-end understanding of the project's architecture, active state, completed features, and critical engineering rules without needing to explore every file.

---

## 📌 Project Identity & Overview
- **Project Name**: Wassap (Wassap Persona Simulation)
- **Current Version**: `v1.7.6`
- **Core Concept**: A pixel-perfect, high-fidelity WhatsApp Web replica built with React 19, Tailwind CSS v3, and Vite, repurposed as an advanced AI persona simulator powered by Google Gemini & Vertex AI.
- **Repository / User**: `sobiswriter/Wassap`
- **Primary Runtime**: Single-Page App (SPA) deployed on **Vercel** with Node.js Serverless Functions in `api/gemini/`, plus a local Express development server in `server/`.

---

## ⚡ Current State & What Was Just Worked On
### 1. In-Chat Authentic Smartphone Photo Generation (`@img` / `@image`)
- **Trigger**: Typing `@img` or `@image` anywhere in the message input (e.g. *"send a selfie @img"*, *"show me your lunch @img"*). The tag is automatically stripped before displaying in the chat bubble.
- **Pipeline**:
  1. **Step 1 (Context & Caption Synthesizer)**:
     - Calls `/api/gemini/image-synthesize` (or `server/vertexHandler.ts`).
     - Uses `gemini-3.8-flash` or `gemini-3.5-flash-lite`.
     - Analyzes user intent, persona profile, mood, and recent chat history.
     - **Priority Rules**:
       1. *User Query First*: Explicit user instructions strictly dictate the subject.
       2. *Recent History Secondary*: If generic, pulls from ongoing chat context.
       3. *Everyday Fallback*: Never defaults to bed; picks realistic moments (couch, passenger seat, kitchen counter, cafe, study desk).
     - Returns JSON: `{ mode: "selfie" | "candid" | "pov", user_wants_posed: boolean, caption: string, action_and_setting: string }`.
  2. **Step 2 (Image Generation Engine)**:
     - Calls `/api/gemini/image-generate` (or local handler).
     - Uses `gemini-3.1-flash-lite-image` (default) or `gemini-3.1-flash-image`.
     - Aspect ratio set to `3:4` portrait format.
     - **Modes**:
       - **Mode A (`"selfie"`)**: Front-facing mobile lens, arm extended, persona avatar attached as `[Input Image 1]` subject reference, flat natural light, zero beauty filter.
       - **Mode B (`"candid"`)**: Third-person unposed shot sent on WhatsApp with avatar reference, awkward angles, mid-action or looking away. If `user_wants_posed` is true, dynamically switches to casual direct-to-camera smile.
       - **Mode C (`"pov"`)**: First-person casual snapshot of surroundings/food/desk without subject reference.
  3. **Step 3 (Fail-Safe Excuse Generator)**:
     - If image generation fails, times out, or triggers safety filters, calls `/api/gemini/image-excuse`.
     - The persona replies with an authentic in-character excuse (e.g., *"My camera app just crashed!"*).
- **UI & Display**:
  - WhatsApp-native media bubble (`.media-message-bubble`) with `fit-content` max 330px width to eliminate blank whitespace.
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
  - Pre-caches core app shell (`/`, `/index.html`, `/manifest.json`, `/favicon.svg`, `/whatapp.wav`).
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
  - Upgraded to a sleek, modern, centered floating card with smooth backdrop blur (`fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm`).
  - Added dedicated **Event Title** input (`eventTitle?: string` on `Message` model) with optional status and automatic derivation fallback (first 5 words of scenario description or default "Story Event").
  - Added interactive **Quick Idea inspiration chips** (`🚪 Doorbell Rings`, `⚡ Power Outage`, `📱 Urgent Call`, `☕ Spilled Drink`) that populate title and description in one tap.
  - Sleek gradient action button (`Make it Happen 🎬`).
- **Event Message Bubble in Chat (`components/ChatWindow.tsx`)**:
  - **Fixed Duplicate Text Bug**: Eliminated previous duplicate `{message.text}` rendering where both title and description repeated identical copy.
  - **Sleek Glassmorphic Card**: Ambient amber glow with gold badge (`🎬 Story Event`), bold title, and narrative italic description.
  - **Expandable / Clickable on Long Descriptions**: Long scenarios (>75 chars) are cleanly clamped to 2 lines with a smooth "Read more / Show less" toggle and card tap to prevent stretching out chat viewports.
  - **AI Prompt Integration**: Passes `[ENVIRONMENTAL EVENT OCCURS (Title)]: *description*` in `geminiService.ts`, `vertexHandler.ts`, and `api/gemini/generate.ts` for deep scenario immersion.

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
- [x] **v1.7.7**:
  - **Background Notification Turnaround Optimization**:
    - **Timer Throttling Bypass**: Bypassed multi-stage `setTimeout` delays in `handleSingleResponse` and `handleGroupResponse` when processing `INLINE_REPLY` (`isBackgroundReply = true`). Reduced response time from 30-60+ seconds (caused by mobile Chromium inactive tab throttling) down to 2-3 seconds.
    - **Vibration Alert**: Added `vibrate: [200, 100, 200]` and `silentUpdate: false` for inline reply notifications so the phone buzzes in the shade when the persona replies.
  - **Native Camera Viewfinder in Message Input**:
    - Added dedicated `<input type="file" ref={cameraInputRef} accept="image/*" capture="environment" />` connected to the camera button in the input bar. Tapping it directly opens the smartphone camera viewfinder instead of the gallery.
  - **Authentic WhatsApp Attachment Menu**:
    - Overhauled attachment sheet to authentic WhatsApp aesthetics: vibrant circular gradient badges with drop shadows and crisp centered white icons:
      - Document (`#7f66ff` to `#9985ff`), Camera (`#d3396d` to `#ec407a`), Gallery (`#ac44cf` to `#bf59cf`), Audio (`#fe7a15` to `#ff9800`), Location (`#1ea952` to `#25d366`), Contact (`#009de2` to `#00b0ff`), Poll (`#ffb300` to `#ffc107`), Event (`#e0537e` to `#f06292`), AI Images (`#0066ff` to `#00d2ff`).
    - Hooked up functional file pickers for **Document** (`.pdf,.doc,.docx,.txt,.md,.xlsx,.pptx`) and **Audio** (`audio/*`), with staged preview and in-chat playback / download.

---

## ⚠️ Critical Engineering Rules & Constraints
1. **NEVER PUSH TO GIT**: The user explicitly requires that **only they push code to GitHub (`git push`)**. As an AI, never run `git push` or configure automated remote pushes.
2. **Always Run Verification**: Before reporting completion, always verify with `npm run build` and `npx tsc --noEmit` to guarantee zero compilation or bundling errors.
3. **Preserve Dual Provider Support**: Any changes to AI calling logic must preserve both Vertex Cloud (`geminiService.ts` proxy) and Custom API Key (direct client-side SDK) pathways.
4. **Vercel Serverless Isolation**: Files under `api/gemini/` must not import local non-bundled helper files that Vercel serverless builds cannot resolve. Keep them self-contained or import standard npm packages.
5. **Pixel-Perfect Authenticity**: Strictly adhere to WhatsApp Web UI patterns, colors, font families, and responsive spacing as documented in `design.md`.
6. **Always Update `memory.md`**: Update this file at the end of every completed task to record changes, milestones, and architectural notes for subsequent AI sessions.
