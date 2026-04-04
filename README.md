# Wassap Persona Simulation (v1.2.5)

A high-fidelity WhatsApp Web replica built with **React 19**, **Vite**, and **Tailwind CSS v3**, integrated with **Google Gemini** to provide a sophisticated AI persona simulation experience.

![Version](https://img.shields.io/badge/version-1.2.5-brightgreen)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-blue)

![App Screenshot](public/images/screenshot.png)

---

## 🚀 Overview

This project is a pixel-perfect reconstruction of the WhatsApp interface, repurposed as a playground for AI-driven character simulations. It features single and group chat dynamics where every "Contact" is an autonomous AI persona powered by Google's Gemini LLM.

### 🌟 What's New in v1.2.5 (The "Intent & Precision" Update)
*   **Precise Inactivity Controls**: You can now set exact inactivity durations down to the **second** (e.g., `2hr 30min 12sec`). The random range logic has been replaced with a rock-solid, precise trigger for consistent behavior.
*   **Intent-Priority Prompting**: Radical shift in prompt engineering to prioritize your **[INTENT]** (scheduled greetings/catch-ups) over general conversation history. This ensures personas deliver their planned interactions without getting "distracted" by the previous chat context.
*   **Context-Balanced Check-ins**: While scheduled greetings have hard-priority, "Inactivity Check-ins" are now explicitly context-aware, ensuring silence-breakers feel like natural continuations of your last conversation.
*   **Anti-Spam Catch-Up Logic**: Fixed a race condition where multiple missed windows could trigger apologies simultaneously. The persona now only ever catches up to the **absolute latest** missed window and silences all others.
*   **Intelligent Catch-Up Engine (v1.2.0 foundation)**: Personas automatically detect missed scheduling windows on app launch. If you miss a morning greeting, the AI will proactively apologize and "catch up" with natural context.
*   **Smart Automation UI**: Chronological sorting for **"Past Interactions"** (Latest First) and **"Upcoming Greetings"** (Earliest First).
*   **Tri-State Visual Tracker**: Status badges for <span style="color: #00a884">●</span> **Completed**, <span style="color: #ff9800">●</span> **Caught Up**, <span style="color: #6366f1">●</span> **Skipped (Indigo)**, and <span style="color: #f43f5e">●</span> **Missed (Red)**.
*   **Persona Health & Diagnostics**:
    *   **Refresh & Debug Button**: Forcefully reset "stuck" agents and clear internal session locks.
    *   **Robust Status Management**: Guaranteed "typing..." state clearing via `finally` blocks.
*   **Mobile Notification Drawer Support**: Full **PWA** implementation for native background notifications.

### 🌟 Previous Updates (v1.1.5)
*   **Quick Double-Tap Selection**: Say goodbye to finicky long-presses. Quickly tap a message twice to enter **Selection Mode**.
*   **Omni-Markdown Engine**: Advanced parsing for both `*WhatsApp*` and `**Standard Markdown**` syntaxes.
*   **Dynamic "Last Seen" Emulation**: Personas realistically transition between "online", "typing...", and time-calculated "last seen" states.
*   **Audio Voice Notes**: Record and send real microphone audio directly into the chat stream.

### ✨ Core Features
*   **Gemini AI Personalities**: Unique roles, speech styles, and backstories for every persona.
*   **Natural Message Splitting**: Delayed, human-like message chunking based on sentence structure.
*   **Model Selection & Privacy**: Switch engines (Flash/Pro) and toggle context-sharing settings.
*   **Calendar & Notes Integration**: Provide real-time context to the AI via a custom notes widget.
*   **Deep Memory Reset**: Clear chat wipes both UI and AI context for a truly fresh start.
*   **Persistent Meta AI**: A permanent AI companion chat integrated into landing page workflows.
*   **IndexedDB Media Persistence**: Robust local storage for images and audio files.
*   **Premium Aesthetics**: Dark/Light mode support with animated transitions and brand-native wallpapers.

---

## 🛠 Tech Stack

### Frontend & Core
[![React](https://img.shields.io/badge/React-19-%2361DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-%23646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-%2338B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Lucide](https://img.shields.io/badge/Lucide_Icons-latest-%23F59E0B?logo=lucide&logoColor=white)](https://lucide.dev/)

### Intelligence & Backend
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-3.1_Flash/Pro-%234285F4?logo=google-gemini&logoColor=white)](https://aistudio.google.com/)
[![Typescript](https://img.shields.io/badge/TypeScript-5-%233178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

### Persistence & Storage
[![Dexie.js](https://img.shields.io/badge/Dexie.js-IndexedDB-%23333333?logo=codepen&logoColor=white)](https://dexie.org/)
[![LocalStorage](https://img.shields.io/badge/LocalStorage-Settings-orange?logo=database&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

---

## 🚀 Getting Started (Local Development)

Follow these steps to spin up your own local version of **Wassap**.

### 1. Requirements Check
> [!IMPORTANT]
> Ensure you have **Node.js v18.0.0+** and **npm v9.0.0+** installed on your machine before proceeding.

### 2. Installation Pipeline
```bash
# Clone the repository
git clone https://github.com/sobiswriter/Wassap.git

# Enter the project directory
cd Wassap

# Install all dependencies
npm install
```

### 3. Launching the Simulator
Initialize the Vite development server:
```bash
npm run dev
```
The app will be live at `http://localhost:5173`.

### 4. Configuration
> [!TIP]
> **No .env needed!** Just open the app, head to the **Settings** menu (via the three dots or profile panel), and paste your Gemini API Key directly. Your key is stored securely in your browser's local storage and is never uploaded.

---

## ⚖️ License & Disclaimers

### Disclaimer
> [!CAUTION]
> This project is a **UI/UX simulation and educational prototype**. It is **not** an official WhatsApp product. WhatsApp and its logo are trademarks of **Meta Platforms, Inc.**

### License
Distributed under the **MIT License**. This project is free to use, modify, and distribute for non-commercial and educational purposes.

---

*Developed with ❤️ by sobiswriter*
