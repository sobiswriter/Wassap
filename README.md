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
*   **Intelligent Catch-Up Engine**: Personas now automatically detect missed scheduling windows on app launch. If you miss a morning greeting, the AI will proactively apologize and "catch up" with natural context—ensuring only the latest missed window is addressed to avoid spamming.
*   **Smart Automation UI**: The automation list is now divided into **"Past Interactions"** and **"Upcoming Greetings"** with intelligent chronological sorting.
    *   **Past Interactions** are sorted **Latest First**, showing you exactly what just happened or what was recently caught up. 
    *   **Upcoming Greetings** are sorted **Earliest First** to show you the next scheduled window.
*   **Tri-State Visual Tracker**: Enhanced status badges for triggers: <span style="color: #00a884">●</span> **Completed**, <span style="color: #ff9800">●</span> **Caught Up**, <span style="color: #6366f1">●</span> **Skipped (Indigo)**, and <span style="color: #f43f5e">●</span> **Missed (Red)**.
*   **Persona Health & Diagnostics**:
    *   **Refresh & Debug Button**: A new tool in the Profile Panel to forcefully reset "stuck" agents and clear internal session locks.
    *   **Robust Status Management**: Implementation of `finally` blocks in AI response logic to guarantee that the "typing..." state is always cleared, preventing infinite hangs.
*   **Inactivity Check-ins**: Custom thresholds (6-24 hrs) for the AI to proactively message you if the conversation has stalled.
*   **Mobile Notification Drawer Support**: Full **PWA** implementation for native background notifications on mobile devices.

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
