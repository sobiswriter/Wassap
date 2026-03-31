# Wassap Persona Simulation (v1.2.0)

A high-fidelity WhatsApp Web replica built with **React 19**, **Vite**, and **Tailwind CSS v3**, integrated with **Google Gemini** to provide a sophisticated AI persona simulation experience.

![Version](https://img.shields.io/badge/version-1.2.0-brightgreen)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-blue)

![App Screenshot](public/images/screenshot.png)

---

## 🚀 Overview

This project is a pixel-perfect reconstruction of the WhatsApp interface, repurposed as a playground for AI-driven character simulations. It features single and group chat dynamics where every "Contact" is an autonomous AI persona powered by Google's Gemini LLM.

### 🌟 What's New in v1.2.0 (The "Persona Proactivity" Update)
*   **AI Automation Engine**: Personas are no longer passive. They now monitor background context and can independently initiate conversations through randomized probability checks.
*   **Time-Gate Triggers**: Create custom "Daily Greetings" (e.g., Morning, Lunch, Dinner). The AI will automatically reach out during these windows with a unique "Done for today" visual tracker in the UI.
*   **Inactivity Check-ins**: If you haven't messaged a persona for a user-defined number of hours (e.g., 6-24 hrs), the AI will proactively check in on you with context-aware concern.
*   **Mobile Notification Drawer Support**: Full **PWA (Progressive Web App)** implementation including `manifest.json` and basic Service Worker. "Install" the app on Android/iOS to receive background notifications directly in your system tray.
*   **Advanced Testing Suite**: Explicit "Force Test" buttons for every automation type, allowing you to verify AI behavior and notification delivery instantly without waiting for timers.
*   **Intelligent Suppression**: Notifications and pings are automatically silenced if you are actively focusing on the relevant chat window, ensuring a frictionless UX.
*   **Tab-Focus Feedback**: Browser tab titles now dynamically flash `(1) New Message` when activity occurs in the background.

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
