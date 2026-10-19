# v1.9.9 reliability follow-up — 19 October 2026

## Latest correction: full notification turn and startup polish

Fixed the app dropping all but the last persona fragment. Browser normal/group/automated paths and worker reply/read paths now carry the entire current response with blank-line fragment spacing; the next response replaces it. Stale async notification lookups are revision-guarded, preserving nonblocking chat delivery. Portraits, inline reply and durable receipts remain.

Static startup now has a centered brand mark, indeterminate loader and recovery link, no external assets, explicit dark surface and reduced-motion support. Chrome regression verifies narrow/desktop layouts and two multi-fragment turns; offline panel/cold reload smoke, 61 tests, TypeScript and build pass. Android notification height/domain attribution remain platform controlled; no physical handset verification or deployment.

The reported Android black screen was not reproduced exactly. Investigation did reproduce an offline panel failure and several message-loss paths; those are fixed locally. No deployment or private-user-data testing was performed.

## Later correction: call continuity and no visible retry cycles

The owner's later screenshots supersede the paired notification request: persona reply only, and a sender profile photo. Worker updates were reading avatar while notification payloads supplied chatAvatar; corrected, and the square foreground icon is carried into worker data.

Ordinary chat now recovers within the existing provider call/turn, preserving recording and delivered/read ticks. It no longer uses a failure to revert status to pending and run a new visible persona turn. A terminal failure settles once via fallback. Offline-first pending sends remain recoverable and the minute safety ceiling remains.

Confirmed premature call-end paths were corrected: immediate closure on GoAway warning, fatal treatment of recoverable post-setup errors, duplicate disconnect callbacks, and an eight-second audio-backlog hang-up. Queues now tolerate 30 seconds of burst audio; suspended/overflow playback marks unheard audio without hanging up. Unrelated AI jobs are deferred, and browser-side chat/diary requests are cancelled at call start, preserving queued work for after hang-up. [Google documents GoAway as advance warning and supports session resumption](https://ai.google.dev/gemini-api/docs/live-api/session-management); a warning is not itself a reason to immediately cut the current reply.

61 unit/integration tests plus browser regressions cover normal audio bursts, suspended audio, disconnect deduplication, GoAway/35-second call continuation, one-flow voice recovery and photo-icon notification data. No real-phone/production reproduction proves these were the sole cause of the reported 30–44-second call ends. Media caption placeholder is `Add somethin..`. No push/deploy.

## Owner clarification: bounded retry and conversation pair

A later clarification caps a durable delivery turn at **three attempts or 60 seconds from the first attempt**, whichever ends first. Actual retry attempts remain at least 15 seconds apart; foreground lifecycle checks run every five seconds to settle expired work even offline. Durable text turns use one provider call per delivery attempt instead of nested retries. At exhaustion, the existing persona network fallback is saved once and the turn leaves the automatic queue. Active-request controllers use the remaining window; worker delivery mirrors the policy. Background suspension may defer the fallback until execution resumes. Unattempted offline/call-held input does not consume the window.

Notifications now supply **the latest user text + one blank line + latest persona fragment**. No decorative line glyphs or app-level text truncation; older turns are replaced. Two long messages cannot be guaranteed fully visible because the native card has OS-defined line limits. Unit policy tests, pair preservation and a browser active-deadline/terminal-replay test were added (57 unit/integration tests total).

## Findings and changes

1. **Incomplete offline shell.** Previous precaching omitted generated entry/vendor/lazy chunks, and asynchronous cache writes were not protected by fetch-event lifetime. Even a cached Settings chunk failed an offline module import because the response varied on `Origin`. The build now injects all JS/CSS paths into the worker, validates its syntax, and requires those resources before installation completes. Same-origin asset lookups ignore `Vary`; APIs and remote origins bypass shell caching. Worker v24 retains one previous shell cache for existing tabs and uses `waitUntil` for network/cache work. Bootstrap HTML has a readable reload fallback.
2. **Discarded pending sends.** The page removed queued items before generation completed and only queued sends when `navigator.onLine` was false. Every ordinary send is now queued before dispatch. Flushes run serially per chat, respect ongoing turns/calls/worker leases, and acknowledge only after a reply is saved. Reconnection, visible-page resumption and a 15-second visible-page timer retry weak-network failures. Saved `responseToMessageId` receipts avoid regenerating a response after interrupted acknowledgement. No storage reset/migration.
3. **Lost notification exchanges.** Inline replies were persisted only after the complete delayed response. Input now commits first. A worker claims a bounded lease transactionally, saves the full generated exchange and acknowledges its outbox item atomically before showing the notification. Failure releases the lease and retains work; supported Background Sync can retry it. Input/final exchanges have separate IDs, and page reconciliation deletes only its saved snapshot rather than clearing newer records.
4. **Avoidable delay and work.** Normal presence/typing pauses were repeatedly 1.8–2.5 seconds, on top of provider latency and configured stacking. They are now brief 250–450 ms cues, while text/TTS still starts eagerly. Configured message stacking remains intact. Removed leaking hard-timeout races; Studio uses SDK timeout/cancellation. The emergency busy watchdog allows bounded text+TTS to complete before 90-second recovery instead of dropping a legitimate slow voice response at 30 seconds. All secondary panels no longer execute eagerly at startup. Chat DOM starts at 80 messages, with incremental earlier messages and full-history search; all 1,000 seeded messages survived the regression test.
5. **Notification/UI cleanup.** Notifications replace the old body using the same chat tag and show the latest persona fragment, without decorative divider lines or accumulated previous user turns. Full replies remain in chat. Last seen wraps and the header can grow; call/search/menu keep 44px controls. Dark received bubbles, header, composer and base use `#0b1014`; green sent bubbles and light colors remain.

## Verification

- 54 unit/integration tests pass, including transaction-commit timing, durable transport failures, failed notification retention, recovery, complete transcript persistence, newest-only notification content and completed-item replay suppression.
- TypeScript check, production build and generated-worker syntax validation pass.
- Chrome synthetic-network test: two failed requests → pending queue → reload → recovery → one saved answer, preserved user message and all existing history. Reintroduced an already acknowledged item to simulate an interrupted acknowledgement; receipt recovery removed it without another model request.
- Chrome long-chat test: 1,000 stored messages → 80 initially rendered → 160 after loading earlier; readable last seen at 320/360/412px; repeated Back/open navigation; matching dark base tokens.
- Fresh worker-enabled context caches unvisited entry/vendor/CSS/panel chunks. First Settings open succeeds offline, followed by an offline reload. This test failed before the module-cache lookup fix.
- Existing mobile UI (320–1440px), light/dark wallpaper/composer/date/overflow, reactions, worker reload, both call transports and designed/replicated voice sample/fallback checks pass.
- Local deployment smoke and runtime dependency audit are rerun for handoff. The prior five build-only Tailwind/braces advisories remain as documented in `release-1.9.9.md`.

No real Google generation, microphone recording, subjective voice-quality comparison, physical Android GPU/background/notification-shade test or production authenticated check was performed. These tests establish specific recovery paths, not that every handset black-screen/crash report has the same cause.

## Browser limits and sources

The [notification API options](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification) allow body/title/icon/tag/actions, but provide no way to remove the browser's domain attribution or replace OS notification chrome. Native text line limits also remain OS-controlled; newest-only content avoids burying the new message under old history.

[Offline/background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) and [Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) depend on browser support and worker lifetime. Ordinary page generation may be deferred when Android suspends it; queued work resumes when available. No offline AI model or new persistent server job/push system was added. Do not promise always-on delivery after force-stop or immediate AI replies without connectivity.

Owner handoff: review/stage the changes, commit and `git push origin main`; the assistant must not push. After deployment run `npm run release:smoke -- https://wassapyo.vercel.app`, then test the affected Android phone on weak Wi-Fi/mobile data, background/resume, native notification Reply, voice note, and repeated navigation without clearing its saved data.
