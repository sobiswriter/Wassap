# WhatsApp Persona Simulation Environment (v1.1)

A high-fidelity WhatsApp Web replica built with **React 19**, **Vite**, and **Tailwind CSS v3**, integrated with **Google Gemini** to provide a sophisticated AI persona simulation experience.

![Version](https://img.shields.io/badge/version-1.1.0-brightgreen)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-blue)

![App Screenshot](public/images/screenshot.png)

---

## 🚀 Overview

This project is a pixel-perfect reconstruction of the WhatsApp interface, repurposed as a playground for AI-driven character simulations. It features single and group chat dynamics where every "Contact" is an autonomous AI persona powered by Google's Gemini LLM. Now I can always use WhatsApp when my friends are using it as well. Hehehe...

### 🌟 What's New in v1.1 (The "Immersion" Update)
*   **Dynamic "Last Seen" Emulation**: Personas realistically transition between "online", "typing...", and "last seen today at [time]" states, giving the illusion of true presence.
*   **Flawless Mobile PWA Experience**: Added Android/iOS hardware back-button interception (`history.pushState` logic) so swiping back out of Settings doesn't exit your app.
*   **Native Long-Press Replies**: Replicated true mobile app behavior! Just long-press (500ms) any message bubble on your phone to natively trigger the reply UI—no clunky buttons required.
*   **Live Google Search Grounding**: AI can now be permitted to search the live web for up-to-date facts by toggling Google Search grounding in Settings.
*   **Audio Voice Notes**: Hold the mic icon to record real microphone audio directly into the chat stream via robust `MediaRecorder` logic.
*   **Pixel-Perfect Responsive Panels**: All side-menus (Settings, Profiles, Calendars) have been overhauled to flawlessly scale into full-screen sliding views on mobile, devoid of awkward overlaps or FAB blockages.
*   **Global Temporal Sync**: Implemented strict 12-hour timezone synchronization (`05:38 PM` instead of `17:38`) across AI generators and the UI so chat timestamps always match reality.

### ✨ Core Features
*   **Gemini AI Personalities**: Each contact has a unique role, speech style, and system instructions.
*   **Natural Message Splitting**: AI responses automatically fracture into consecutive human-like text chunks based on sentence structure.
*   **Model Selection & Privacy**: Switch between different Gemini engines (Flash, Pro, Lite) and toggle context-sharing (date/time/calendar).
*   **Calendar & Notes Integration**: Provide real-time date context and custom notes to the AI via a dedicated Calendar widget.
*   **Deep Memory Reset**: "Clear Chat" wipes both the UI and the AI's contextual memory, providing a true fresh start.
*   **Mobile-First Action Hub**: A dedicated Floating Action Button (FAB) provides quick access to all management features on mobile devices.
*   **Persistent Meta AI**: A permanent AI assistant chat (Meta AI) is always available and undeletable, linked via landing page shortcuts.
*   **IndexedDB Media Persistence**: Images and audio are stored securely offline using IndexedDB for robust persistence across sessions.
*   **Cyber-Noir Aesthetic**: Premium dark/light mode support with animated transitions and native-style wallpapers.

---

## 🛠 Tech Stack

*   **Framework**: [React 19](https://react.dev/)
*   **Build Tool**: [Vite 6](https://vitejs.dev/)
*   **Styling**: [Tailwind CSS v3](https://tailwindcss.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **AI SDK**: [@google/genai](https://www.npmjs.com/package/@google/genai)
*   **Storage**: [Dexie.js / IndexedDB](https://dexie.org/)

---

## 📦 Architecture

-   **/components**: Interactive UI layers (Sidebar, ChatWindow, MessageInput, Slide-over Panels, MobileActionFAB).
-   **/services**: Core logic for the Gemini API framework and LLM orchestrations.
-   **/utils**: Storage utilities for IndexedDB Blob management.
-   **/constants.ts**: Initial persona configurations and dynamic theme dictionaries.
-   **App.tsx**: Main state machine routing the PWA navigation stack and AI turn-taking mechanics.

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
> **API Key Integrated**: For a seamless, out-of-the-box experience, a Gemini API setup logic is heavily integrated into the UI. You can plug your keys right into the frontend Settings menu without wrestling with `.env` files.

4.  **Access the App**:
    Open `http://localhost:5173`.

---

## 📜 License

This project is intended for educational and simulation purposes. WhatsApp is a trademark of Meta Platforms, Inc.

---

*Developed with ❤️ by sobiswriter*
