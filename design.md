# Wassap Design System (`design.md`)

This guide documents the design tokens, color palette, typography, layout dimensions, and UI components used in **Wassap**, maintaining pixel-perfect fidelity to the native WhatsApp Web and mobile experiences.

---

## 🎨 1. Color Palette & Theming

Wassap uses a class-based dark mode (`.dark`) driven by CSS custom properties and Tailwind CSS utility classes.

### A. Theme Colors Comparison Table

| Token / Usage | Light Mode (`:root`) | Dark Mode (`.dark`) | Notes |
| :--- | :--- | :--- | :--- |
| **Page Outer Background** | `#eae6df` | `#0c1317` | Neutral desktop surrounding backdrop |
| **Chat Viewport Background** | `#efeae2` | `#0b141a` | Main conversation scroll area |
| **Primary Panel Background** | `#ffffff` | `#111b21` | Sidebar, modals, popovers |
| **Header Background** | `#f0f2f5` | `#202c33` | Top navigation and chat title bar |
| **Input Footer Background** | `#f0f2f5` | `#202c33` | Message composer bottom bar |
| **Borders & Dividers** | `#e9edef` | `#222d34` | 1px clean separation lines |
| **Primary Text** | `#111b21` | `#e9edef` | Contact names, message body text |
| **Secondary Text** | `#667781` | `#8696a0` | Timestamps, status, last seen, subtitles |
| **Outgoing Bubble (User)** | `#d9fdd3` | `#005c4b` | Light pale green / dark pine green |
| **Incoming Bubble (Persona)**| `#ffffff` | `#202c33` | Pure white / dark slate grey |
| **Encryption Notice Box** | `#fff9c2` (text `#54656f`) | `#182229` (text `#8696a0`) | Security disclaimer pill |
| **Selection Overlay** | `rgba(0, 168, 132, 0.1)` | `rgba(0, 168, 132, 0.15)` | Double-tap / multi-select state |

### B. Iconic WhatsApp Brand Colors

```css
/* Core Brand Tones */
--wa-green-primary:   #25D366; /* Vibrant WhatsApp Green */
--wa-teal-accent:      #00A884; /* Active buttons, send icon, toggles */
--wa-teal-dark:        #128C7E; /* Header accents, legacy branding */
--wa-blue-ticks:       #53BDEB; /* Double read checkmarks */
--wa-danger-red:       #EA0038; /* Delete, destructive confirmations */
--wa-voice-mic-badge:  #00A884; /* Green mic badge on voice note avatars */
```

---

## 🔤 2. Typography & Fonts

### A. Font Family Stack
Wassap inherits WhatsApp's native desktop system font stack for clean legibility across all operating systems:
```css
body, input, button, textarea {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, Lucida Grande, sans-serif;
}
```

### B. Type Scale & Hierarchies

| Element | Size | Weight | Line Height | Color |
| :--- | :--- | :--- | :--- | :--- |
| **Chat Message Body** | `14.5px` (`--msg-font-size`) | 400 (Regular) | `19px` | `var(--text-primary)` |
| **Composer Input Field** | `17px` (`--input-font-size`) | 400 (Regular) | `22px` | `var(--text-primary)` (16px on mobile to prevent iOS zoom) |
| **Chat List Contact Name** | `16px` | 500 (Medium) | `20px` | `var(--text-primary)` |
| **Last Message Preview** | `13.5px` | 400 (Regular) | `18px` | `var(--text-secondary)` |
| **Timestamp (Chat & Bubble)** | `11px` | 400 (Regular) | `14px` | `var(--text-secondary)` |
| **Section & Category Headers**| `13px` | 600 (Semibold)| `16px` | `var(--wa-teal-accent)` / Secondary |
| **Modal & Popover Titles** | `17px` - `19px` | 600 (Semibold)| `24px` | `var(--text-primary)` |

---

## 📐 3. Layout Dimensions & Spacing

### A. Desktop Workspace Layout
```
+-------------------------------------------------------------------------------+
| Rail (60px) | Sidebar / ChatList (380px) | Chat Window (Flexible: 1fr)        |
|             |                            | Header (60px)                      |
| Chats       | Search Bar (48px)          |------------------------------------|
| Communities | -------------------------- | Scrollable Chat Messages Viewport  |
| Updates     | Active Chat Tiles (72px ea)| (Centered with max-w-[900px])      |
| Settings    |                            |                                    |
|             |                            |------------------------------------|
|             |                            | Input Composer Footer (62px)       |
+-------------------------------------------------------------------------------+
```

### B. Message Bubbles
- **Standard Text Bubble**:
  - `max-width: 65%` on desktop, `85%` on mobile.
  - Border radius: `8px`.
  - Consecutive message stacking: Corner tails are hidden on grouped messages from the same sender with tight `2px` vertical padding.
- **Media & Photo Bubbles (`.media-message-bubble`)**:
  - `width: fit-content !important;`
  - `max-width: 330px !important;`
  - `padding: 4px;`
  - `border-radius: 12px;`
  - Internal image wrapper: `border-radius: 8px; overflow: hidden;`
  - Image element: `width: 100%; height: auto; max-height: 420px; object-fit: cover;`
  - Caption text: `padding: 6px 8px 4px 8px; font-size: 14px;`

### C. Voice Note Audio Cards
- **Container**: Padded flex row matching native WhatsApp voice message layout.
- **Play/Pause Button**: `40px` circular green button (`#00A884`) with crisp white play/pause iconography.
- **Waveform Scrubber**: 35 interactive vertical bars with dynamic duration fill and click/drag seek listeners.
- **Speed Pill**: Compact pill button toggling between `1x`, `1.5x`, and `2x` playback rates.
- **Avatar Mic Indicator**: Micro green circular badge (`16px`) overlaid on the speaker's avatar.

### D. Mobile Responsive Breakpoint (`max-width: 768px`)
- Main container expands to `100vw` and `100vh` without outer margins or rounded desktop frames.
- Left sidebar and active chat window toggle as full-screen views.
- Mobile bottom navigation rail replaces the desktop left navigation rail.
- Floating Action Button (FAB) appears in the bottom right for fast persona creation.
- Native browser scrollbars are hidden (`width: 0px; height: 0px;`) for app-like presentation.
