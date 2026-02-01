# WhatsApp Persona Simulation Environment (v0.5)

A high-fidelity WhatsApp Web replica built with React 19 and Tailwind CSS, integrated with Google Gemini 2.0 to provide a sophisticated AI persona simulation experience.

![Version](https://img.shields.io/badge/version-0.5.0-brightgreen)
![React](https://img.sh/react)
![Gemini](https://img.shields.io/badge/AI-Gemini_3_Flash-blue)

---

## 🚀 Overview

This project is a pixel-perfect reconstruction of the WhatsApp interface, repurposed as a playground for AI-driven character simulations. It features single and group chat dynamics where every "Contact" is an autonomous AI persona powered by Google's Gemini LLM.

### Key Capabilities
*   **High-Fidelity UI**: Accurate Light and Dark modes with WhatsApp-specific color palettes and transitions.
*   **Persona Engine**: Create and customize AI contacts with specific roles, speech styles, and hidden system instructions.
*   **Multimodal Conversations**: Full support for image and document attachments. The AI "sees" images and reacts to them contextually.
*   **Group Dynamics**: Simulated group chats where multiple AI personas interact with each other and the user, including randomized turn-taking and "typing" indicators.
*   **Privacy-First AI**: Toggleable "Share AI Context" to control whether personas have access to your user bio.

---

## 🛠 Tech Stack

*   **Framework**: [React 19](https://react.dev/) (Functional components with Hooks)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Custom theme configurations)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **AI SDK**: [@google/genai](https://www.npmjs.com/package/@google/genai)
*   **Model**: Gemini 3 Flash Preview (Optimized for low-latency chat)

---

## 📦 Architecture

The project follows a modular component-based architecture:

-   **/components**: Pure UI components (Sidebar, ChatList, MessageInput).
-   **/services**: Core logic for API interactions (`geminiService.ts`).
-   **/types.ts**: TypeScript interfaces for Messages, Chats, and Profiles.
-   **/constants.ts**: Initial state and style configuration.
-   **App.tsx**: Main state orchestration and AI turn-taking logic.

---

## 🚦 Local Development

Since this project uses a "no-build" ESM module approach for rapid prototyping, running it locally is straightforward.

### Prerequisites
*   A modern web browser.
*   A [Google Gemini API Key](https://aistudio.google.com/app/apikey).

### Setup Instructions

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-username/whatsapp-ai-replica.git
    cd whatsapp-ai-replica
    ```

2.  **Configure Environment**:
    The application expects the `API_KEY` to be available in the execution environment. If you are hosting this via a simple static server, ensure the key is injected.

3.  **Run with a Local Server**:
    Because the project uses ES6 Modules, you must serve it over `http://`.
    
    Using **Node.js/npx**:
    ```bash
    npx serve .
    ```
    Using **Python**:
    ```bash
    python -m http.server 8000
    ```
    Using **VS Code**:
    Install the "Live Server" extension and click "Go Live".

4.  **Access the App**:
    Open `http://localhost:8000` (or your server's port) in your browser.

---

## 🧠 AI Configuration

Each persona's behavior is governed by the `systemInstruction` field. To modify a character's personality:
1.  Open the chat with the persona.
2.  Click the header to open the **Contact Info** panel.
3.  Scroll to **Persona Notes** and provide detailed instructions (e.g., "You are a grumpy accountant who hates small talk").
4.  Click **Save Changes**.

---

## 📜 License

This project is intended for educational and simulation purposes. WhatsApp is a trademark of Meta Platforms, Inc.

---

*Developed with ❤️ by sobiswriter*