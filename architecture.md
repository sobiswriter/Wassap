# Wassap System Architecture (`architecture.md`)

This document provides a comprehensive technical overview of the architecture, data flow, tech stack, and directory structure of the **Wassap Persona Simulation** platform (`v1.7.0`).

---

## 🏗️ 1. High-Level System Architecture

Wassap is structured as a client-first Single Page Application (SPA) designed to run with zero external database dependencies. All state is maintained client-side via `localStorage` and `IndexedDB`, while AI intelligence is routed through a dual-provider gateway:

```mermaid
graph TD
    User([User in Browser]) -->|UI Interactions| ReactApp[React 19 Frontend SPA]

    subgraph Client Storage
        ReactApp -->|Settings, Personas, Chats| LocalStorage[(localStorage)]
        ReactApp -->|Voice Notes, Images, Blobs| IndexedDB[(IndexedDB utils/storage.ts)]
    end

    subgraph AI Gateway Routing geminiService.ts
        ReactApp -->|Direct SDK calls with Custom Key| GeminiStudio[Google AI Studio API]
        ReactApp -->|Proxy calls with Passcode| Serverless[Vercel Serverless / Local Express]
    end

    subgraph Backend Services
        Serverless -->|/api/gemini/generate| ChatService[Gemini Chat Streaming]
        Serverless -->|/api/gemini/image-synthesize| SynthesizerService[Context & Intent Synthesizer]
        Serverless -->|/api/gemini/image-generate| ImageService[Image Generator with Reference]
        Serverless -->|/api/gemini/image-excuse| ExcuseService[Fail-Safe Persona Excuse]
        Serverless -->|/api/gemini/tts| TTSService[Gemini 30-Voice TTS]
        Serverless -->|/api/gemini/diary| DiaryService[AI Memory Diary Generator]
    end

    subgraph Google Cloud Platform
        ChatService --> VertexAI[Google Cloud Vertex AI]
        SynthesizerService --> VertexAI
        ImageService --> VertexAI
        ExcuseService --> VertexAI
        TTSService --> VertexAI
        DiaryService --> VertexAI
    end
```

---

## 🔄 2. Core Workflows & Data Pipelines

### A. In-Chat Realistic Smartphone Photo Generation (`@img`)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Input as MessageInput.tsx
    participant Service as geminiService.ts
    participant Synthesizer as /api/gemini/image-synthesize
    participant Generator as /api/gemini/image-generate
    participant Excuse as /api/gemini/image-excuse
    participant Chat as ChatWindow.tsx

    User->>Input: Types "what are you doing? @img"
    Input->>Input: Strip "@img" from user message bubble
    Input->>Service: triggerImageGeneration(userPrompt, persona, history)
    Service->>Synthesizer: POST { userPrompt, persona, messageHistory }
    Note over Synthesizer: gemini-3.8-flash analyzes intent,<br/>prioritizes user query over history,<br/>falls back to realistic everyday variety
    Synthesizer-->>Service: JSON { mode: "selfie"|"candid"|"pov", caption, action_and_setting, user_wants_posed }
    
    alt Generation Success
        Service->>Generator: POST { prompt, mode, avatarBase64, user_wants_posed }
        Note over Generator: Invokes gemini-3.1-flash-lite-image<br/>attaching avatar as [Input Image 1]<br/>with smartphone camera styling (3:4)
        Generator-->>Service: Base64 Image (JPEG/PNG)
        Service->>Chat: Render .media-message-bubble (tight wrap, caption, lightbox)
    else Generation Fails / Times out / Content Filter
        Service->>Excuse: POST { persona, userPrompt, mood }
        Excuse-->>Service: In-character excuse text (e.g. "camera crashed!")
        Service->>Chat: Render regular text bubble with excuse
    end
```

### B. Dual-Engine Audio & Gemini-TTS Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant App as App.tsx
    participant Persona as ProfilePanel.tsx (Voice Lab)
    participant TTS as /api/gemini/tts
    participant Player as VoiceNotePlayer.tsx

    Note over Persona: User configures 1 of 30 voices<br/>and Voice Frequency (20%, 50%, 100%)
    App->>TTS: POST { text, voiceName, pitch, speed }
    Note over TTS: Converts markdown, extracts cues [laughs],<br/>applies Gemini prompt steering
    TTS-->>App: Audio Buffer (WAV with headers)
    App->>Player: Pass audio blob URL + duration
    Note over Player: Renders green play button, interactive scrubbing<br/>waveform, 1x/1.5x/2x speed pill, mic badge
```

---

## 📂 3. Folder & File Structure

```
Wassap/
├── .github/                      # CI/CD and repository workflows
├── api/                          # Vercel Production Serverless Functions
│   └── gemini/
│       ├── generate.ts           # Streaming and non-streaming persona chat responses
│       ├── image.ts              # Consolidated multi-action image endpoint
│       ├── image-synthesize.ts   # Step 1: Context & intent synthesizer
│       ├── image-generate.ts     # Step 2: Realistic smartphone image generator
│       ├── image-excuse.ts       # Step 3: Camera error in-character excuses
│       ├── tts.ts                # 30-Voice Gemini-TTS voice synthesis
│       ├── diary.ts              # Persona diary generator for memory bubbles
│       └── status.ts             # Health check & credentials diagnostic endpoint
├── components/                   # Modular React UI Components
│   ├── CalendarNotesWidget.tsx   # Shared notes & real-time context panel
│   ├── ChatList.tsx              # Left sidebar conversation list with unread counters
│   ├── ChatWindow.tsx            # Main chat viewport, message cards, grouping, media bubbles
│   ├── ConfirmationModal.tsx     # Generic confirmation dialog for deletions/resets
│   ├── GuidePanel.tsx            # In-app user manual & tips
│   ├── ImageLightboxModal.tsx    # Full-screen media viewer with download capability
│   ├── MessageInput.tsx          # Message composer, @img trigger, audio recording, emoji/events
│   ├── MobileActionFAB.tsx       # Floating Action Button for mobile screen transitions
│   ├── MobileNavigation.tsx      # Bottom navigation bar for mobile viewports
│   ├── NewChatPanel.tsx          # Persona creation & search interface
│   ├── NewGroupPanel.tsx         # Multi-persona group chat creator
│   ├── ProfilePanel.tsx          # Comprehensive persona editor (Voice, Sentience, Schedule, Humane)
│   ├── SettingsPopover.tsx       # Global preferences (Providers, Keys, Passcode, Wallpaper, Models)
│   ├── Sidebar.tsx               # Left navigation rail (Chats, Communities/Guide, Updates, Settings)
│   ├── UpdatesPanel.tsx          # In-app changelog timeline
│   ├── UserProfilePanel.tsx      # Personal user profile info
│   └── VoiceNotePlayer.tsx       # WhatsApp audio note card with waveform scrubber & speed pill
├── server/                       # Local Development Backend
│   ├── api.ts                    # Express router forwarding /api/gemini/*
│   └── vertexHandler.ts          # Server-side Vertex AI implementation mirror
├── services/
│   └── geminiService.ts          # Client-side gateway orchestrator (routes Vertex vs AI Studio)
├── utils/
│   ├── audio.ts                  # Web Audio API recording, PCM converter, WAV header builder
│   ├── dates.ts                  # WhatsApp date formatter ("Today", "Yesterday", 24h clock)
│   ├── imageCompressor.ts        # Client-side canvas image compression
│   └── storage.ts                # IndexedDB persistence for large audio & image blobs
├── public/                       # Static public assets (wallpapers, default avatars)
├── App.tsx                       # Root application component & global state orchestrator
├── constants.ts                  # Default personas, templates, wallpapers, model catalogues
├── index.css                     # Tailwind CSS base & custom WhatsApp variables
├── index.html                    # HTML entry point
├── index.tsx                     # React DOM root mounting
├── tailwind.config.js            # Tailwind v3 layout configuration
├── tsconfig.json                 # TypeScript compiler options
├── types.ts                      # Core TypeScript domain models
├── vercel.json                   # Vercel serverless routing & function definitions
└── vite.config.ts                # Vite build and dev server configuration
```

---

## 🛠️ 4. Technology Stack

| Layer | Technology | Purpose & Details |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19** (`react`, `react-dom`) | Modern component architecture, state management with hooks |
| **Language** | **TypeScript 5.8** | Strict static typing across frontend, models, and serverless handlers |
| **Build Tooling** | **Vite 6** (`@vitejs/plugin-react`) | High-speed HMR development and production asset bundling |
| **Styling** | **Tailwind CSS v3.4** + Custom CSS | WhatsApp theme tokens, CSS variables, dark mode class strategy |
| **Icons** | **Lucide React** (`lucide-react`) | Pixel-accurate WhatsApp UI icon representations |
| **Client AI SDK** | **`@google/genai` v1.38+** | Official Google GenAI SDK for AI Studio and Vertex AI |
| **Audio Processing** | **Web Audio API** | Microphone PCM capture, sample-rate resampling, WAV header assembly |
| **Local Backend** | **Express 4** | Local development proxy for Vertex AI endpoints |
| **Serverless Engine** | **Vercel Functions** (`@vercel/node`) | Zero-config serverless API deployment in `/api/gemini/*` |
| **Client Storage** | **`localStorage` & IndexedDB** | Lightweight text state + robust binary blob persistence |

---

## 🔐 5. Authentication & Environment Configuration

Wassap employs a dual-credential resolution architecture:

1. **Service Account JSON**:
   - `GCP_SERVICE_ACCOUNT_KEY`, `GOOGLE_APPLICATION_CREDENTIALS_JSON`, or `GOOGLE_CREDENTIALS`.
2. **Individual Service Account Keys**:
   - `GCP_CLIENT_EMAIL` (or `VERTEX_CLIENT_EMAIL`)
   - `GCP_PRIVATE_KEY` (or `VERTEX_PRIVATE_KEY`) with automated `\n` normalization and PEM reconstruction.
3. **API Key Fallback**:
   - `VERTEX_API_KEY`, `GEMINI_API_KEY`, or `API_KEY`.
4. **Passcode Protection**:
   - Built-in cloud endpoints require the `x-vertex-passcode` header matching `VERTEX_PASSCODE` (`Ness2020`).
