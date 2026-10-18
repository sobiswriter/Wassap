# Wassap Design System (`design.md`)

This guide documents the design tokens, color palette, typography, layout dimensions, and UI components used in **Wassap**, maintaining pixel-perfect fidelity to the native WhatsApp Web and mobile experiences.

## v1.9.7 mobile refinement

- Diary date chips use 12px text and retain their save-to-diary action.
- Wallpaper sits behind the complete conversation, including the composer. Keep the crop stable during mobile height changes; reset on width/orientation changes.
- Do not draw a textarea focus outline inside the clipped composer pill. Keep visible keyboard focus on actionable controls.
- Decorative row/navigation dividers use low-alpha tokens (dark 3.5%, light 4.5%). The inbox right border is desktop-only; form/control borders retain their contrast.
- Match the body background to the chat theme to avoid exposed viewport seams.


---

## 🎨 1. Color Palette & Theming

Wassap uses a class-based dark mode (`.dark`) driven by CSS custom properties and Tailwind CSS utility classes.

### A. Theme Colors Comparison Table

| Token / Usage | Light Mode (`:root`) | Dark Mode (`.dark`) | Notes |
| :--- | :--- | :--- | :--- |
| **Page Outer Background** | `#eae6df` | `#0b1014` | Deeper, ultra-dark native WhatsApp backdrop |
| **Chat Viewport Background** | `#efeae2` | `#0b1014` | Main conversation scroll area |
| **Primary Panel Background** | `#ffffff` | `#0b1014` | Sidebar, modals, popovers, mobile list |
| **Header Background** | `#f0f2f5` | `#182229` / `#0b1014` | Top navigation and chat title bar |
| **Input Footer Background** | `#f0f2f5` | `#182229` | Message composer bottom bar |
| **Borders & Dividers** | `#e9edef` | `#1f2c34` | 1px clean separation lines |
| **Primary Text** | `#111b21` | `#e9edef` | Contact names, message body text |
| **Secondary Text** | `#667781` | `#8696a0` | Timestamps, status, last seen, subtitles |
| **Outgoing Bubble (User)** | `#d9fdd3` | `#005c4b` | Light pale green / dark pine green |
| **Incoming Bubble (Persona)**| `#ffffff` | `#182229` | Pure white / dark charcoal slate |
| **Encryption Notice Box** | `#fff9c2` (text `#54656f`) | `#182229` (text `#8696a0`) | Security disclaimer pill |
| **Selection Overlay** | `rgba(33, 192, 99, 0.1)` | `rgba(33, 192, 99, 0.15)` | Double-tap / multi-select state |

### B. Iconic WhatsApp Brand Colors

```css
/* Core Brand Tones */
--wa-green-primary:   #21C063; /* Verdant Pulse - Official WhatsApp Accent */
--wa-green-hover:     #1EB05B; /* Hover & Active state */
--wa-dark-bg:         #0B1014; /* Authentic WhatsApp Android/iOS Ultra Dark */
--wa-blue-ticks:      #53BDEB; /* Double read checkmarks */
--wa-danger-red:      #EA0038; /* Delete, destructive confirmations */
--wa-active-pill:     #103629; /* Dark forest green active tab capsule */
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

### D. Audio Soundscape Design Tokens
- **Sent Message Pop Sound (`/msgsentpop.mp3`)**:
  - Calibrated volume: `0.85` gain via Web Audio API `GainNode`.
  - Frequency profile: Low-frequency subtle pop replicating WhatsApp Web / Mobile message transmission.
  - Trigger: Centralized on outgoing message dispatch (`sendMessageToChat`).
- **Incoming Message Chime (`/whatapp.wav`)**:
  - Calibrated volume: `1.0` gain via Web Audio API.
  - Frequency profile: High-fidelity WhatsApp incoming double chime.
  - Trigger: Dispatched on persona response arrival.
- **In-App Foreground Policy**:
  - Strictly active only when `!document.hidden`.
  - Silent during background tabs, minimized browser, and native background push alerts to eliminate duplicate sounds.

### E. Message Selection Toolbar & Actions
- **Selection Action Bar**:
  - Position: Floating header bar replacing chat title bar during selection mode.
  - Left: Selection counter (`{N} selected`) and dismiss button (`X`).
  - Right Actions: Reply (`CornerUpLeft`), Copy (`Copy`), Save as Memory (`Sparkles` with green glow), Delete (`Trash2` with red accent hover).
- **Deletion Confirmation Modal**:
  - WhatsApp-native centered modal with blurred backdrop (`bg-black/50`).
  - Confirmation text displaying exact message count.
  - Destructive primary button: `#EA0038` ("Delete for me").

### F. Date Memory & AI Diary Modal Design
- **Header**: WhatsApp emerald theme with Book/Quill iconography and date badge.
- **Title Field**: Integrated input with customizable entry title (defaulting to date or chat topic).
- **Action**: "Generate AI Diary" button with animated sparkle spinner and multi-model fallback.
- **Journal Canvas**: Parchment-toned textarea with relaxed leading (`leading-relaxed`), capturing intimate first-person persona reflections.

### G. Mobile Responsive Breakpoint (`max-width: 767px`)
- Main container uses `100dvh` with a `100vh` fallback; desktop starts at 768px consistently with JavaScript and Tailwind. Android keyboard resize opts into layout-viewport resizing.
- Mobile uses Roboto/Helvetica Neue/Arial/system fallback, preserving the existing message-size control and its composer scale. Focused fields stay at least 16px; buttons keep component-specific typography.
- Left sidebar and active chat window toggle as full-screen views.
- Mobile bottom navigation rail replaces the desktop left navigation rail.
- Floating Action Button (FAB) appears in the bottom right for fast persona creation.
- Native browser scrollbars are hidden (`width: 0px; height: 0px;`) for app-like presentation.

### H. Motion Excellence, Tactile Physics & Haptics Tokens
- **Message Bubble Motion**:
  - **Entrance Transition**: Fast, subtle CSS animation (`bubble-enter`: 180ms `cubic-bezier(0.16, 1, 0.3, 1)`, scale `0.96` to `1.0`, opacity `0` to `1`). Newly appended incoming/outgoing messages animate; loaded history does not replay. Recent IDs expire after 240ms.
  - **Press Compression Feedback**: `active:scale-[0.995] active:brightness-95` on bubble touch for immediate physical response within the first few frames.
  - **Consistent Touch Targets**: Added `touch-btn` and `touch-icon` micro-scale transitions across composer icons, send button, and action controls.
- **Haptic Vibration Signatures (`utils/haptics.ts`)**:
  - `tap`: 10ms micro-vibration for emoji/button presses.
  - `selection`: 35ms tactile confirmation for message selection.
  - `send`: 15ms pulse on message transmission.
  - `reaction`: 20ms pop when reacting.
  - `threshold`: 25ms confirmation when crossing the reply threshold; release does not vibrate a second time.
  - `delete`: `[25, 45, 25]` warning pattern on destructive action.
- **Anchored Quick Reaction Tray (`ReactionTray.tsx`)**:
  - Restrained spring animation emerging from the bubble interaction point (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
  - WhatsApp-native floating capsule (`bg-white dark:bg-[#202c33] rounded-full shadow-2xl px-2 py-1.5 border app-border`).
  - Reaction badges scale smoothly on attach with a micro-pop animation.
- **In-App WhatsApp Emoji Tray (`EmojiPickerTray.tsx`)**:
  - Anchored at `bottom: calc(100% + 4px)` above the composer; full available width minus 16px, 390px on desktop, capped at 420px.
  - Height capped by `calc(100dvh - 150px)`; the attachment tray has its own scrollable height cap. Generic panel colors never change a tray's positioning or radius.
  - Thumb-friendly 8-column emoji grid, category pills, real-time search, and `localStorage` recent emojis.
- **Constrained Swipe-to-Reply Gesture**:
  - Constrained horizontal translation up to 55px with elastic damping and directional locking.
  - Activation threshold at 36px damped displacement; cancel/scroll gestures preserve reader position. A completed swipe suppresses its synthetic click.

### Android polish contract (18 October 2026)
- Chat rows support a 450ms touch/mouse hold, cancelling after 10px movement or pointer cancellation. Selection replaces the list header with count, Back, Pin/Unpin and Archive/Unarchive icons, with green avatar checks and row highlights. Desktop right-click/Space/Shift+F10 select; Escape cancels. Stable sorting places pinned chats first, and a compact pin glyph appears in the preview row. No unrelated delete/mute actions were added.
- Recording follow-up: mobile inbox/chat use a 260ms push with subtle inbox parallax; contact info enters over 240ms and reverses over 220ms before unmounting. Reduced-motion users receive immediate profile dismissal. Chat header includes a 23px outlined handset (1.8px stroke) beside search. Archived uses an archive-box row/count and a dedicated list with Back navigation.
- Reference: [Meta's published Android design and screenshots](https://www.meta.com/design-at-meta/blog/whatsapp-user-interface-update/). Use consistent rounded-outline icons around 1.8–1.9px stroke, 24px glyphs and 48px mobile composer/header targets. Larger tap areas do not require larger icons.
- Inbox uses inset dividers, three supported filters, direct persona-creation FAB and semantic bottom navigation. Guide/app Updates retain their real meaning; no simulated Calls backend is implied.
- Local `animate-in`/fade/zoom/slide utilities provide 150–260ms panel/menu entry. They reset animation variables to avoid inherited movement; completed animations release transforms for gestures. Existing reduced-motion CSS and programmatic chat scrolling respect the system preference.
- Mobile panels receive dialog semantics, focus isolation/return and keyboard dismissal; underlying inbox/chat are inert while a panel is open. Pinch zoom is enabled.
- Media remain fit-content, at most 330px and additionally constrained by available width. Custom wallpapers have a bundled doodle fallback; the retired forest preset renders the bundled forest without storage migration.
- Physical Android IME, haptics, TalkBack and 60/120Hz calibration remain device validation, not claims established by desktop Chrome screenshots.



## Cloud access and import feedback (18 October 2026)
- Keep the existing Settings passkey form, hint, lock control, and provider choices. Unlock validation runs on the server; disable submission while it is in progress and display a useful error on failure.
- Keep text model choices to Gemini 3.8 Flash and Gemini 3.5 Flash-Lite. Voice/image selectors retain their existing choices.
- Reject invalid persona backup files before changing app state; preserve the existing import flow for valid backups.
