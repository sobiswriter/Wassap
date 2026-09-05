# Repository & AI Assistant Rules (`rules.md`)

These rules govern all automated modifications, code contributions, and AI assistant behaviors across the **Wassap** project. All human contributors and AI assistants must strictly abide by them.

---

## 🚨 1. Git & Deployment Rules (CRITICAL)

### **Rule 1.1: The User ALWAYS Pushes Updates — Never the AI**
> [!CAUTION]
> **THE AI ASSISTANT MUST NEVER RUN `git push`.**
> 
> - Pushing code to GitHub, Vercel, or any remote repository is strictly and exclusively performed by the project owner (the user).
> - The AI may inspect git status, create local commits if requested, or suggest git commands, but **MUST NEVER execute `git push`**.
> - If an update is complete, summarize what was modified and provide the exact commands for the user to commit and push on their own.

---

## 🛡️ 2. Quality & Verification Standards

### **Rule 2.1: Mandatory Verification Pipeline**
Before finishing any coding task or declaring a bug resolved, the AI must execute and confirm:
1. `npx tsc --noEmit`: Ensure **zero** TypeScript compiler errors across the codebase.
2. `npm run build`: Ensure Vite produces a clean production bundle without bundling or syntax errors.

### **Rule 2.2: Dual-Provider Preservation**
Wassap supports two distinct AI paths:
1. **Built-in Cloud (Vertex AI)**: Serverless/local proxy calls requiring passcode validation.
2. **Custom API Key (Gemini AI Studio)**: Direct browser calls using the user's personal key.

Never refactor code in a way that breaks or removes either of these two paths. Both must remain fully functional and easily toggleable from the UI.

---

## ⚡ 3. Vercel Serverless Function Guidelines

### **Rule 3.1: Serverless Runtime Self-Containment**
- Files in `/api/gemini/` run as isolated Vercel serverless functions.
- Do **not** use cross-file internal ESM imports between API endpoints (e.g. `import ... from './image.js'`) unless fully bundled. Keep endpoints self-contained or share logic via robust Node/npm packages to avoid `ERR_MODULE_NOT_FOUND` in production.
- Always use the unified `normalizePrivateKey` and multi-credential resolver for `@google/genai` Vertex AI calls:
  - Check `GCP_SERVICE_ACCOUNT_KEY`, `GOOGLE_APPLICATION_CREDENTIALS_JSON`, `GOOGLE_CREDENTIALS`.
  - Check `GCP_CLIENT_EMAIL` and `GCP_PRIVATE_KEY` (with PEM normalization).
  - Check fallback `VERTEX_API_KEY`, `GEMINI_API_KEY`, and `API_KEY`.

---

## 🎨 4. Design & UI Authenticity Rules

### **Rule 4.1: Pixel-Perfect WhatsApp Fidelity**
- Respect WhatsApp Web color tokens, spacing, typography, and layout rules as detailed in `design.md`.
- Media message bubbles (`.media-message-bubble`) must use `width: fit-content; max-width: 330px;` so image containers wrap tightly with captions, avoiding blank white or dark space.
- Audio voice notes must always include interactive waveforms, dynamic durations, and speed toggle pills (1x / 1.5x / 2x).

### **Rule 4.2: Authentic In-Chat Image Realism**
- For in-chat photo generation (`@img` / `@image`), never produce glossy, airbrushed, or studio-staged looks unless explicitly requested by the user.
- Enforce the 2-step pipeline: Context & Caption Synthesizer first, followed by smartphone camera prompt steering (Mode A: Selfie, Mode B: Candid, Mode C: POV).
- When generation fails or times out, always invoke the fail-safe excuse generator so the persona stays in-character.

---

## 📝 5. Codebase Hygiene & Documentation

### **Rule 5.1: Preserve Code Comments & Context**
- Maintain existing comments, docstrings, and helper utilities.
- When adding new features or adjusting architectures, update `architecture.md`, `design.md`, and `README.md` to keep all documentation synchronized.

### **Rule 5.2: Always Update `memory.md` Upon Task Completion**
> [!IMPORTANT]
> **EVERY FINISHED TASK MUST UPDATE `memory.md`.**
> 
> - Whenever a feature, bug fix, refactor, or architectural change is completed, the AI assistant **MUST** update [`memory.md`](memory.md).
> - Specifically update:
>   1. The **Current State & What Was Just Worked On** section to document what was just done.
>   2. The **Feature Milestones Completed** checklist or changelog if a new milestone/version was reached.
>   3. Any new architecture patterns, components, endpoints, or environment variables introduced.
> - This guarantees that any new AI assistant session can immediately pick up where the last one left off without having to search or re-scan the codebase.
