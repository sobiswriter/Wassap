# Android-first mobile polish review

Date: 18 October 2026. Status: user approved implementation; local UI work and automated/browser checks complete. Physical Android validation remains open.

## Design contract

Make the existing persona simulator feel more natural on Android: familiar chat hierarchy, reachable primary actions, stable scrolling, responsive controls, restrained motion, and legible light/dark surfaces. Preserve desktop behavior. Use WhatsApp's published Android screens as reference evidence; do not mix iOS-only geometry or experimental screenshots into the baseline.

The user explicitly chose **Android first**. iPhone browser compatibility remains a regression check. This is a polish pass, not a rebuild of WhatsApp's calling, status, or community services.

## Existing work to retain

Memory and design documentation already describe mobile spacing work, swipe-to-reply, long-press selection, reactions, haptics, bubble/status animations, emoji/GIF/sticker selection, image fitting, waveform seeking, playback speeds, single-player audio, and the compact custom-voice selector. The stylesheet already supports reduced motion. Improve consistency rather than reimplementing these features.

`rules.md` Rule 5.2 already mandates updating `memory.md` after every completed task. The repository uses `memory.md`, not `memories.md`.

## Review evidence

Reviewed rules, memory, design and architecture context, then selected UI components and shared styles. Used an isolated Playwright Chrome session against the existing production build at localhost:3013. This temporary review port does not change the documented development port 3000. Screens use bundled sample chats, not the user's browser profile. Examined inbox at 320/360/390/412 px; conversation at 320/390/412 px; attachment and emoji trays, contact profile, Settings, and light/dark appearance. These are desktop Chrome viewport checks, not Android hardware emulation or an IME test.

Reference images were actually viewed in the browser and captured from Meta's official design article. Local ignored evidence is in `output/playwright/`: `whatsapp-official-screens.png`, `inbox-320.png`, `inbox-360.png`, `inbox-390.png`, `inbox-412.png`, `chat-320.png`, `chat-390.png`, `chat-412.png`, `attachments-412.png`, `emoji-412.png`, `profile-412.png`, `settings-412.png`, `inbox-dark-412.png`, and `chat-dark-412.png`. These artifacts are local review aids and are not tracked release assets.

### Confirmed issues

| Priority | Finding and evidence | Proposed outcome |
| --- | --- | --- |
| High | Global mobile `input, button { font-size: 16px !important }` overrides component typography. Groups ends at x=362.27 px on a 320 px inbox, so it is clipped; it also slightly exceeds 360 px. Date buttons compute to 16 px despite the compact design specification. | Scope the input zoom safeguard, restore intentional button typography, and make every filter reachable with deliberate horizontal behavior. |
| High | The global mobile `.app-panel` rule forces bottom:0 and square/full-width geometry onto the attachment tray. Browser clicks on Attach and emoji are intercepted by the open tray. Tapping a message outside dismisses it. | Separate screen-panel geometry from tray geometry; keep a visible dismissal route, composer access, correct layering, and usable short-screen layout. |
| High | The chat banner claims end-to-end encryption and that nobody outside the chat can read it (`ChatWindow.tsx`), while AI content is sent to the selected provider. | Replace copied privacy claims with accurate local-storage/provider disclosure. This is a trust issue, not proof of a new data leak. |
| Medium | Favourites falls through to All in `ChatList.tsx`; no favourite filtering is implemented. Calls has no handler. Updates opens the app changelog; Guide occupies the communities-shaped destination. The search placeholder promises Meta AI but typing only filters names. | Make labels and states match existing capabilities. Recommend deferring new favourites/calls infrastructure and removing or clearly marking unsupported affordances, while keeping Guide and changelog reachable. |
| Medium | `animate-in`, `fade-in`, and `zoom-in` utilities are referenced in components but absent from the generated CSS; Tailwind config has no animation plugin. Custom bubble animations do exist. | Implement only needed local animation classes using existing motion tokens. Check entry and exit lifecycle, not just class names. No new dependency required. |
| Medium | Composer emoji target is 26x26 px; Attach and Camera are 24x24 px; header buttons are 36x36 px. Some header buttons have no accessible name, and navigation/actions use clickable divs. Viewport metadata disables pinch zoom. | Increase invisible touch areas toward 48x48 px without enlarging icons; use semantic controls, names, focus management, zoom and TalkBack-friendly states. |
| Medium | Opening Settings triggers a 404 for the Misty Forest preset in `constants.ts`. | Repair the resource or provide a deterministic fallback while preserving saved wallpaper selections/custom images. |
| Medium | Location reads one GPS fix but labels it Live Location; permission failure sends a fabricated shared-location message. Contact sends a placeholder card string; Poll inserts a text prefix. These were source-reviewed, not invoked. | Label limited actions honestly; show an error when GPS fails. Do not silently ship real-time tracking, polls, or a contacts backend in a visual update. |

### Visual refinements and validation needs

- Inbox: align Android font hierarchy, row density, inset dividers, avatar sizing, search/filter spacing, icon stroke, selection pills, badges, and floating-action shadow. Avoid global font changes that erase the user's message-size setting.
- Primary action: recommend direct new-chat entry from the green FAB; keep persona creation, group creation, calendar, profile and Settings reachable through the existing creation screen/overflow. This is a proposed navigation change for user review, not an implemented decision.
- Conversation: refine bubble grouping, tails, timestamp baselines, reply previews, date chips, wallpaper contrast and media sizing. Keep image containers fit-content with the documented 330 px cap, additionally constrained by available viewport space. Existing voice player capabilities remain intact.
- Trays: the present attachment grid uses large gradient circles and strong colored shadows; Meta's Android reference has quieter colored icons on light surfaces. Emoji tray should feel attached to the composer rather than a floating desktop popover. Preserve GIF/sticker uploads and AI Images.
- Motion: unify screen, menu, selection, reaction, send/mic and tray transitions. Incoming bubbles currently do not receive the `newOutgoingIds` entrance flag. Avoid replaying history animations. Audit permanent `will-change`, transition-all, and layout-animating exits using a real trace before calling them performance defects.
- Viewport: root uses `h-screen`; no dynamic viewport/VisualViewport handling was found in the selected files. Validate browser bars, keyboard open/close, rotation, large text and standalone PWA safe areas. Keyboard occlusion is a risk to test, not a reproduced finding.
- Gestures/scrolling: directional locks, cancellation, unread marker and reader-position protection already exist. Test diagonal swipes, hold-on-scroll, double threshold haptics, native Back dismissal order, emoji/keyboard switching, media load shifts and long histories. Preserve reader position; avoid adding virtualization without measurements.
- Settings/profile: retain the recent voice-selector fix. Reduce visual density through clearer sections, consistent rows, accessible switches and predictable Save/Close behavior; keep provider selection/unlock easy to reach and destructive actions clearly separated.
- Accessibility: audit contrast in both themes, font scaling, focus return/trapping and background interaction in panels; CSS reduced-motion support already exists, but programmatic smooth scrolling also needs validation.
- Align mobile breakpoint behavior: JavaScript uses `<768`, CSS mobile overrides use `<=768`, while Tailwind `md` starts at 768.

## Implementation order

Tasks and acceptance criteria are in `tasks/todo.md`. Start with CSS scope/viewport foundations, tray layering and input targets. Then refine inbox/conversation visual tokens and navigation, then motion/gesture consistency and secondary panels. Verify after each small slice. Reuse existing components and state; do not add a design framework or animation dependency for this work.

## Compatibility boundaries

- No clearing or replacing storage, no storage-key/database/store rename, no destructive migration. Chats, personas, memories, custom voices, media, keys, settings, pending outbox and background exchanges must survive reload/upgrade.
- Keep current shared member passkey and built-in Vertex Cloud authentication flow. Preserve direct Gemini API-key mode and both paths' photos, voice, journals, foreground/background and notification replies.
- Keep text choices limited to Gemini 3.8 Flash and Gemini 3.5 Flash-Lite; leave image/voice choices unchanged.
- No timing/provider/service-worker rewrites for a cosmetic goal. If UI lifecycle changes affect those paths, run focused regression checks before proceeding.
- No remote push. User owns deployment. Keep docs updated with actual behavior; do not describe proposed UI as shipped.

## Verification and limits

Each implementation slice requires TypeScript and production build, relevant focused tests for changed behavior, and visual/interaction checks. Final matrix: 320/360/390/412 px phones, 768 px boundary, 1024/1440 desktop, light/dark/reduced-motion, short/tall screen, large text, browser/PWA, empty/error/loading/offline/permission-denied states. Use representative existing-data fixtures to verify persistence without touching real users' data. Provider credentials must not appear in fixtures or artifacts.

Real Android testing is required for IME, browser-bar resizing, hardware Back, touch conflicts, haptics, TalkBack and 60/120 Hz frame pacing. No real provider calls, paid generation, notification delivery, physical recording or full security audit were performed during this UI review. The isolated initial cloud-auth request returned 401 while locked; this is expected and not an unlock regression.

## Sources and confidence

- [Meta design team's UI rationale and actual Android/iOS screens, 9 May 2024](https://www.meta.com/design-at-meta/blog/whatsapp-user-interface-update/): primary baseline for hierarchy, neutral surfaces, green accents, rounded outline icons, deeper dark mode, Android thumb-reachable navigation. This is a dated official reference, not proof that every October 2026 account has identical pixels.
- [Official chat filters announcement, 16 April 2024](https://about.fb.com/news/2024/04/whatsapp-chat-filters/).
- [Official favourites announcement, 16 July 2024](https://blog.whatsapp.com/choose-your-favorites-on-whatsapp): favourites are an actual selected set, not All under another label.
- [Official chat themes announcement, 13 February 2025](https://blog.whatsapp.com/chat-themes-to-reflect-your-style): per-chat themes are real, but adding a theme system is optional later scope, not needed for this polish pass.
- [Official March 2026 feature announcement](https://about.fb.com/news/2026/03/whatsapp-new-features-simplify-storage-switch-accounts/): checked for later product context; does not justify adding account/transfer/storage features to this UI pass.

Search results included beta and platform-specific redesigns. Those are not acceptance criteria. Preserve native Android conventions while adapting them to Wassap's existing AI features.

## Implementation outcome

Implemented locally on `codex/android-mobile-polish`: scoped mobile CSS/dynamic viewport, icon/touch hierarchy, inbox and supported navigation, composer tray geometry, accurate privacy/location wording, local entry animations, recent incoming/outgoing motion, reduced-motion scrolling, swipe click/haptic refinement, mobile panel focus/history handling, and bundled forest fallback. No runtime dependency, provider/model or data-schema change. SW shell cache v15 refreshes presentation assets only.

Validation passed: 17 automated tests, TypeScript, production build, diff whitespace check, and the checked-in fresh-context browser regression including all seven review widths, secondary panels, denied location, short screens, reduced motion and synthetic profile/key/voice/media/outbox persistence. See `todo.md` for the physical-device checks still outstanding. Existing audio synthesis/recording, real notification delivery and paid provider calls were not invoked.
