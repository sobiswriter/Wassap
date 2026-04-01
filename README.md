# Wassap Persona Simulation (v1.3.0)

A high-fidelity WhatsApp Web replica built with **React 19**, **Vite**, and **Tailwind CSS v3**, integrated with **Google Gemini** and **Supabase Cloud** to provide a 24/7 proactive AI persona experience.

![Version](https://img.shields.io/badge/version-1.3.0-blueviolet)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![Supabase](https://img.shields.io/badge/Supabase-Cloud-green)
![Gemini](https://img.shields.io/badge/Gemini-1.5%20Flash-orange)

![App Screenshot](public/images/screenshot.png)

---

## 🚀 Overview

This project is a pixel-perfect reconstruction of the WhatsApp interface, repurposed as a playground for AI-driven character simulations. It features single and group chat dynamics where every "Contact" is an autonomous AI persona powered by Google's Gemini LLM.

### 🌟 What's New in v1.3.0 (The "Alive 24/7" Cloud Update)
*   **Supabase Cloud Backend**: Full migration from `localStorage` to a professional PostgreSQL cloud database. Your chats are now securely synced across all your devices in real-time.
*   **24/7 Independent Brain**: A dedicated **GitHub Action** heartbeat that wakes up your personas every 15 minutes, allowing them to initiate conversations even when your browser is closed.
*   **Native Real-Time Push Notifications**: Integrated with the **Web Push API** and VAPID protocol. Receive native mobile/desktop notifications from your AI personas directly in your system drawer.
*   **Smart Cloud-Sync Settings**: Your Gemini API key is automatically "tunneled" from your browser to your private cloud database, enabling the background brain to function without manual secret management.
*   **Automated Storage Maintenance**: Integrated Postgres Cron job that automatically purges messages older than 14 days to keep your cloud storage lean and free.

---

## ✨ AI Persona Features

*   **Proactive Automation**: Personas monitor background context and independently initiate conversations based on randomized probability checks.
*   **Time-Gate & Inactivity Triggers**: AI-driven "Daily Greetings" and context-aware inactivity check-ins.
*   **Natural Message Splitting**: Delayed, human-like message chunking based on sentence structure.
*   **Omni-Markdown Engine**: Advanced parsing for both `*WhatsApp*` and `**Standard Markdown**` syntaxes.
*   **Dynamic Status Emulation**: Real-time "online", "typing...", and time-calculated "last seen" states.

---

## 🛠 Tech Stack

*   **Frontend**: [React 19](https://react.dev/), [Vite 6](https://vitejs.dev/)
*   **Styling**: [Tailwind CSS v3](https://tailwindcss.com/)
*   **Cloud Backend**: [Supabase](https://supabase.com/) (PostgreSQL & Realtime)
*   **Automation**: [GitHub Actions](https://github.com/features/actions)
*   **AI Engine**: [Google Gemini 1.5 Flash](https://ai.google.dev/)
*   **Notifications**: [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

---

## 🚦 Cloud Setup & Deployment

### 1. Supabase Configuration
Execute the following SQL in your Supabase SQL Editor:
```sql
-- Create the Config table for secure settings sync
CREATE TABLE config ( id TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to config" ON config FOR ALL USING (true) WITH CHECK (true);
```

### 2. GitHub Secrets
To enable the 24/7 Heartbeat, add these secrets to your Repository:
- `SUPABASE_URL`: Your Supabase Project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase `service_role` secret.

### 3. Usage
1. Push your code to GitHub to trigger the automation.
2. Enter your **Gemini API Key** once in the app's Settings UI to sync it to the cloud.
3. Toggle **Desktop Notifications** to "On" and follow the browser prompt.

---

## 📜 License
This project is intended for educational and simulation purposes. WhatsApp is a trademark of Meta Platforms, Inc.

*Developed with ❤️ by sobiswriter*
