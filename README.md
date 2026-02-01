# WhatsApp Persona Simulation Environment (v0.7)

A high-fidelity WhatsApp Web replica built with **React 19**, **Vite**, and **Tailwind CSS v3**, integrated with **Google Gemini** to provide a sophisticated AI persona simulation experience.

![Version](https://img.shields.io/badge/version-0.7.0-brightgreen)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-blue)

---

## 🚀 Overview

This project is a pixel-perfect reconstruction of the WhatsApp interface, repurposed as a playground for AI-driven character simulations. It features single and group chat dynamics where every "Contact" is an autonomous AI persona powered by Google's Gemini LLM.

### Recent Enhancements (v0.7)
*   **Theme Engine Overhaul**: Fixed invisible text issues in Dark Mode by implementing a robust CSS variable system.
*   **Premium Wallpapers**: Integrated high-fidelity WhatsApp-style doodle wallpapers for both light and dark themes.
*   **Bubble Polish**: Chat bubbles now dynamically adjust contrast and colors (Deep Green/Grey) in Dark Mode for a native feel.
*   **Layout Fixes**: Resolved overlaps in the Settings Popover and improved Sidebar responsiveness.

---

## 🛠 Tech Stack

*   **Framework**: [React 19](https://react.dev/)
*   **Build Tool**: [Vite 6](https://vitejs.dev/)
*   **Styling**: [Tailwind CSS v3](https://tailwindcss.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **AI SDK**: [@google/genai](https://www.npmjs.com/package/@google/genai)

---

## 📦 Architecture

-   **/components**: Pure UI components (Sidebar, ChatList, ChatWindow).
-   **/public/images**: High-fidelity wallpapers and assets.
-   **/services**: Core logic for Gemini API interactions.
-   **App.tsx**: Main state orchestration and AI turn-taking logic.

---

## 🚦 Local Development

### Prerequisites
1.  Node.js (v18+)
2.  A [Google Gemini API Key](https://aistudio.google.com/app/apikey).

### Setup Instructions

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-username/whatsapp-ai-replica.git
    cd whatsapp-ai-replica
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**:
    Create a `.env` file in the root directory and add your API key:
    ```env
    VITE_GEMINI_API_KEY=your_actual_api_key_here
    ```

4.  **Run Dev Server**:
    ```bash
    npm run dev
    ```

5.  **Access the App**:
    Open `http://localhost:5173` (or the port shown in your terminal).

---

## 🛑 Current Known Issues & Roadmap
-   **Context Sharing**: The "Share AI Context" toggle is functional but requires more granular persona memory persistence.
-   **Media Uploads**: While images and docs are supported, large file handling (over 4MB) may encounter API limits.
-   **Dark Mode Contrast**: While largely fixed, some 3rd-party library icons may still use fixed hex colors.

---

## 📜 License

This project is intended for educational and simulation purposes. WhatsApp is a trademark of Meta Platforms, Inc.

---

*Developed with ❤️ by sobiswriter*
