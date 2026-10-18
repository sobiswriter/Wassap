# Android mobile polish: implementation and verification

User approved implementation on 18 October 2026. Local work is on `codex/android-mobile-polish`; nothing pushed. No storage schema, credentials, provider/model or generation-timing changes.

## 1. Mobile CSS and viewport foundation
- [x] Scoped panel/field overrides; filters reachable at 320/360 px with no document overflow.
- [x] Consistent 768 px boundary; desktop layout retained; saved message/composer font variables retained.
- [x] Dynamic viewport fallback, safe-area padding, pinch zoom and Android keyboard-resize opt-in implemented.
- [ ] Physically verify keyboard/browser-bar/rotation and standalone-PWA resizing on Android.

## 2. Composer trays and touch access
- [x] Tray toggles and emoji handoff work; short-screen trays stay within the viewport.
- [x] Larger semantic composer/attachment controls, close buttons, outside dismissal, Escape/Back; existing attachments and voice actions retained.
- [x] Accurate privacy and single-fix location wording; denied location produces a status message without sending a placeholder.

## Checkpoint A
- [x] TypeScript, production build and relevant automated tests pass.
- [x] Browser fixtures retain profile, custom voice, saved key, media, pending outbox and chat/persona content through navigation/reload.
- [x] Existing automated tests for passkey/cookie validation, Studio SDK routing, cloud proxy and background routing pass.
- [ ] Live paid-provider/notification flows were not invoked in this UI task.

## 3. Inbox appearance and truthful actions
- [x] Consistent rounded-outline icon strokes, inset rows, filter hierarchy, light/dark surfaces and restrained FAB shadows.
- [x] Direct new-persona FAB; group/profile/calendar/settings retained in overflow; Guide/app Updates remain available.
- [x] Unsupported Calls/Favourites affordances omitted; name search and separate AI actions labelled honestly.
- [x] Group filter, search empty state, creation, Guide, Updates, Settings, profile, group panel and calendar open/close checked in the browser.

## 4. Conversation visual finish
- [x] Restored compact dates, refined conversation padding/header targets, preserved grouping/reply/audio controls.
- [x] Fit-content media capped at 330 px and available width; preserved custom font variables and wallpaper opacity.
- [x] Mobile/desktop/light/dark screenshots inspected and retained under ignored output/playwright/.
- [ ] Physical media/audio recording/playback and a full rich-message/large-text device matrix remain manual release checks.

## Checkpoint B
- [x] Browse/open/tray/keyboard-dismiss/back flows pass browser regression without changing stored content or generation timing.
- [x] Production build, TypeScript and UI screenshots verified after implementation.

## 5. Motion and gesture consistency
- [x] Missing local animation utilities implemented; transforms released after entry; new incoming/outgoing IDs expire rather than replaying loaded history.
- [x] Existing scroll anchoring retained; programmatic smooth scrolling respects reduced motion.
- [x] Reply threshold vibrates once and completed swipes suppress their synthetic click; existing directional/cancellation handling retained.
- [x] Browser Back/Escape dismissal, reduced motion, panel entry and narrow/short viewports checked.
- [ ] Physical diagonal touch/hold/swipe conflicts, haptics and 60/120Hz traces need Android hardware. No virtualization or unmeasured layer optimization was added.

## 6. Secondary panels and wallpaper resilience
- [x] Semantic Settings switches, predictable panel focus/Tab/Escape and inert mobile backgrounds; lazy mounting handled.
- [x] Existing voice-selector design retained and opened in browser; no voice option/provider control removed.
- [x] Misty Forest bundled locally; legacy URL resolved only at render time; custom URLs unchanged. Resolver test passes.
- [ ] TalkBack/contrast/large-text and real permission/recording states need device review; no WCAG certification is claimed.

## Checkpoint C: handoff
- [x] Browser widths 320/360/390/412/768/1024/1440; light/dark, short screen, denied location, focus, secondary panels, Back/Escape and reduced motion passed in a fresh test context.
- [x] `npm test`: 17 passed. `npx tsc --noEmit`, `npm run build`, `git diff --check`: passed.
- [x] README, design.md, architecture.md and memory.md synchronized; original research and source links retained in plan.md.
- [x] No secrets included in screenshots/test fixtures; no real user browser profile used. Test contexts, browser and temporary preview server closed at handoff.
- [ ] Device-only checks above are explicitly outstanding; project owner owns commit/push/deployment.

## Approved follow-up: archive and recording-based motion
- [x] Archive/unarchive metadata, inbox section, persistence and Back navigation.
- [x] Outlined handset beside chat search with accurate unavailable feedback.
- [x] Mobile chat push/parallax and profile forward/reverse transitions from the supplied recording.
- [x] Focused archive browser check, TypeScript, build and whitespace checks pass. No broad test rerun; physical Android calibration remains open.

## v1.9.7 phone screenshot fixes (18 October 2026)
- [x] Reproduce clipped composer outline; remove bars while preserving keyboard indicators on buttons.
- [x] Stable wallpaper behind messages/composer through simulated keyboard height and multiline growth; reset on orientation/width change and follow desktop resizes.
- [x] 12px diary chip with working modal; softer list/nav dividers, no phone right frame, matching body theme.
- [x] Synchronize package/lock, browser/social/Apple/PWA labels, foreground title restore, in-app Updates and documentation to 1.9.7; refresh shell cache v18 without changing installed-app identity or stored data.
- [x] 19 tests, TypeScript, production build, all four browser scripts and screenshot inspection pass. Existing data/provider checks pass; no real paid requests made.
- [ ] Confirm keyboard animation/crop on physical Android and installed PWA; desktop Chrome viewport simulation cannot exercise an actual IME.
