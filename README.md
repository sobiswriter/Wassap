# WhatsApp Persona Simulation Environment (v1.1.2)

A high-fidelity WhatsApp Web replica built with **React 19**, **Vite**, and **Tailwind CSS v3**, integrated with **Google Gemini** to provide a sophisticated AI persona simulation experience.

![Version](https://img.shields.io/badge/version-1.1.2-brightgreen)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-blue)

![App Screenshot](public/images/screenshot.png)

---

## 🚀 Overview

This project is a pixel-perfect reconstruction of the WhatsApp interface, repurposed as a playground for AI-driven character simulations. It features single and group chat dynamics where every "Contact" is an autonomous AI persona powered by Google's Gemini LLM. Now I can always use WhatsApp when my friends are using it as well. Hehehe...

### 🌟 What's New in v1.1.2 (The "Professional" Update)
*   **Contextual Selection Mode**: WhatsApp-style long-press selection! Highlight messages, select multiple items, and use the new **Contextual Action Header** to Copy or Reply.
*   **Omni-Markdown Engine**: Broad-spectrum parsing for both `*WhatsApp*` and `**Standard Markdown**` syntaxes. AI-generated code blocks and bolding now render perfectly every time.
*   **Dynamic "Last Seen" Emulation**: Personas realistically transition between "online", "typing...", and time-calculated "last seen today at..." states.
*   **Flawless PWA Navigation**: Added Android/iOS hardware back-button interception (`history.pushState` logic) preventing accidental app closures.
*   **Live Google Search Grounding**: AI can now search the live web for facts by toggling Grounding in Settings.
*   **Audio Voice Notes**: Record and send real microphone audio directly into the chat stream via `MediaRecorder`.
*   **Responsive Scaling Fixes**: Overhauled all side-menus (Settings, Profiles, Calendars) to flawlessly map to full-screen sliding views on mobile devices.
*   **Global Temporal Sync**: Mandatory 12-hour timezone synchronization (`05:38 PM`) for a consistent experience across all chat bubbles.

### ✨ Core Features
*   **Gemini AI Personalities**: Unique roles, speech styles, and backstories per contact.
*   **Natural Message Splitting**: Delayed, human-like message chunking for AI responses.
*   **Model Selection & Privacy**: Switch engines (Flash/Pro) and toggle context-sharing settings.
*   **Calendar & Notes Integration**: Provide real-time context to the AI via a custom notes widget.
*   **Deep Memory Reset**: Clear chat wipes both UI and AI context for a fresh start.
*   **Persistent Meta AI**: A permanent AI companion chat integrated into landing page workflows.
*   **IndexedDB Media Persistence**: Robust local storage for images and audio files.
*   **Premium Aesthetics**: Dark/Light mode support with animated transitions and brand-native wallpapers.

---

## 🛠 Tech Stack

*   **Framework**: [React 19](https://react.dev/)
*   **Build Tool**: [Vite 6](https://vitejs.dev/)
*   **Styling**: [Tailwind CSS v3](https://tailwindcss.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **AI SDK**: [@google/genai](https://www.npmjs.com/package/@google/genai)
*   **Storage**: [Dexie.js / IndexedDB](https://dexie.org/)

---

## 🚦 Local Development

### Prerequisites
1.  Node.js (v18+)

### Setup Instructions

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/sobiswriter/Wassap.git
    ```
    
2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Run Dev Server**:
    ```bash
    npm run dev
    ```

> [!NOTE]
> **API Key Setup**: Gemini API keys are integrated into the frontend Settings menu. No `.env` configuration is required for local setup.

4.  **Access the App**:
    Open `http://localhost:5173`.

---

## 📜 License

This project is intended for educational and simulation purposes. WhatsApp is a trademark of Meta Platforms, Inc.

---

*Developed with ❤️ by sobiswriter*
