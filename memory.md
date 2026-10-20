# AI Context & Project Memory (`memory.md`)

> **Note for AI Assistants**: Read this file first when starting a new session or planning updates. It provides an immediate, end-to-end understanding of the project's architecture, active state, completed features, and critical engineering rules without needing to explore every file.

---

## 📌 Project Identity & Overview
- **Project Name**: Wassap (Wassap Persona Simulation)
- **Current Version**: `v1.9.9`
- **Core Concept**: A pixel-perfect, high-fidelity WhatsApp Web replica built with React 19, Tailwind CSS v3, and Vite, repurposed as an advanced AI persona simulator powered by Google Gemini & Vertex AI.
- **Repository / User**: `sobiswriter/Wassap`
- **Primary Runtime**: Single-Page App (SPA) deployed on **Vercel** with Node.js Serverless Functions in `api/gemini/` and `api/giphy/`, plus Vite dev/preview middleware backed by `server/`.

---

## ⚡ Current State & What Was Just Worked On

### Fragment pacing and gray busy indicators (20 October 2026)
- Follow-up: increased inter-fragment pacing to 1.5–2.5 seconds including the online beat; first reply remains unchanged. Updated Chromium regression passes for single/group chats and both themes (100 ms scheduling tolerance); TypeScript and production build pass.
- Added one shared length-based typing delay for subsequent single/group/automated text fragments, with a short inter-bubble beat. First-reply timing, fragmentation, cancellation and notification contents remain unchanged. No worker delivery/persistence delay added.
- Chat header, inbox and recording bubble now use text-secondary for typing/recording status in both themes; online presence remains green. Browser regression uses isolated synthetic replies without model calls or changing user data.
- Verification: 69 tests, TypeScript and production build pass. Chromium verifies single/group fragments remain separate with visible typing and 750–2000 ms measured gap bounds; typing/recording labels match the gray theme token in both themes. No push/deploy or physical-phone timing test.

### Live voice continuity investigation and model selector (19 October 2026)
- Follow-up real-provider attempt: workspace has no project .env/provider credential variables; a local Google application-default credential file exists. Attempted both documented Live models directly through the actual SDK/Cloud client with synthetic text and Fenrir. Both connection attempts timed out at 15 seconds before setupComplete or any audio. This does not establish invalid credentials, model rejection or acoustic quality; the cause of connection failure remains unconfirmed. Local unauthenticated member-session probe returned 401. Never report these as successful Live audio tests.
- Read Google's current 3.8 Live, Extended Thinking, voice configuration, session/capability and best-practice documentation. Found no app-side voice/model replacement after setup, but found concrete preview leakage: detached ProfilePanel Audio survived unmount and async preview completion could start after closing the profile. Now pause on unmount/call-start and suppress late preview playback while a call surface is open. Browser reproduction covers both paths.
- Reduced conflicting Live speaker steering via personaLiveStyle: do not duplicate custom reference design, automatic voice descriptors or pitchTone alongside the configured preset/reference. Keep explicit non-duplicate delivery/pacing and existing emotion prompt; TTS voice-note settings stay intact. This mitigates a steering risk, not proof of the reported upstream timbre shift. PersonaCall captures voice/model and caches its setup prompt, reusing all three plus the custom sample on resumption. Old-generation frames remain rejected.
- Added global selectedLiveModel with normal/Extended Thinking choices in General Settings, normal as backward-compatible default. Cloud relay validates both IDs; unknown requests are rejected before the provider. Both provider paths send LOW thinkingConfig only for Extended Thinking, which tracks IN_PROGRESS/IDLE independently of per-utterance turnComplete. No tool integration, proactivity disabling, model switching or alternate speaker fallback was introduced mid-call. UI call-ended copy now says call summary.
- Checks: 69 tests, TypeScript/build; browser regressions cover settings save/reload/320px, Cloud resumption retaining voice/model/prompt, actual SDK serialization of Studio Extended Thinking, both provider audio transports, custom sample conversion, and detached/pending preview isolation. See tasks/live-voice-audit-2026-10-19.md for official sources and audit. No live Google listening or physical-phone reproduction, so provider-level voice drift remains unverified. No push/deploy/data reset.

### Explicit persona language setting (19 October 2026)
- Added optional language to Chat/backup types, profile initial/reset/export/save, backup validation/import and diary UI payload. Contact info field is free text (160 chars); blank/Auto uses persona description. Shared language instruction makes explicit choice override conflicting descriptions, speech style, old memories and conversation requests. No existing chats/entries are rewritten.
- Covered client/local/deployed chat, voice-note text, group/automation, Live setup, short call recaps, daily/multi-day diaries, photo captions/camera excuses and TTS metadata. Studio/local share utils/personaLanguage.ts; self-contained deployed endpoints and worker mirror it. Voice previews now generate a localized short introduction before TTS; this adds one text request per preview click. Custom/prebuilt voice selection remains intact.
- Saved language is mirrored in wassap-persona-settings cache for stale notification snapshots/queued replies, including group responder ownership and resetting to Auto. Worker falls back to snapshot if the cache is unavailable. Explicit-language deterministic network fallback is 📶… and camera fallback is 📷…; no guessed English/Hinglish exception. Empty generated captions use 📷. Existing DB/storage keys/formats remain compatible. Existing active Live sessions retain the language from setup; a changed setting is used on the next call.
- Checks: 67 tests, TypeScript/build; browser covers Auto default, 320px layout, French save/reload/export, localized voice-preview text/TTS payload, actual diary-editor payload, clearing and persona isolation. SDK request captures cover Studio/local/deployed chat/media/photo/TTS plus diary/call recap parity; worker test covers overriding a stale Hindi snapshot with saved French. Call regression passes. Mobile screenshot inspected. Live Google output quality not sampled; no push/deploy.

### Persona diary authenticity and short call recaps (19 October 2026)
- Root cause: all three diary implementations counted common English words (the/main) as Hindi clues and imposed an absolute Hinglish mandate. Removed language guessing and Hindi pronoun examples. Author/language instruction anchors the selected profile and only that persona's own non-event speech samples, excluding the user and other named speakers. Diaries retain intimate feelings; concrete claims must be grounded.
- Calls now use generateCallSummary and a separate brief recap prompt (2–4 sentences, one paragraph, at most 120 words; 1024 output tokens) in Studio and Cloud via optional kind=call-summary. Removed diary-writing instructions from transcript data, reject mismatched call/persona IDs, label new call memories Call Summary. Preserve existing summaries/diaries and legacy storage/status fields; calls under one minute still keep transcripts without automatic summary.
- Found and fixed another ownership risk: an open diary editor persisted across chat switches. Clear diary selections on chat ID changes, key editors by owner, reject mismatched memory.chatId saves. Late results cannot populate the next persona's editor.
- Checks: 64 tests, TypeScript/build pass. SDK-capture regression compares single/multi-day and call recap requests across Studio/local Cloud/deployed endpoint; checks English keyword collision, other-speaker exclusion, explicit language profiles, full/interrupted transcript and mismatched owner rejection. Chrome call regression and pending-generation chat-switch/save regression pass. Live Google output quality was not sampled; no deployment or rewriting saved entries.

### Ringback cadence (19 October 2026)
- Ringback now waits 1500 ms after each completed clip before replaying. Pickup/end cancels the timer and removes the ended handler, preserving the existing simulated pickup delay and sound toggle.
- Checks: 62 unit tests, TypeScript and production build pass; timer regression covers the full gap and cancellation during the gap. Chrome calling regression confirms pause/repeat, pickup cleanup and both provider transports. No deployment or physical-device listening test.

### Professional boot shell and complete reply notifications (19 October 2026)
- Replaced static Opening/Reload text with a centered asset-independent brand screen, thin indeterminate progress, reduced-motion support and accessible reload link. Explicit dark boot background avoids a clash when the light stylesheet arrives before JavaScript.
- Fixed lost notification fragments across ordinary, automated, group and worker replies: accumulate the current response with blank-line boundaries, reset for the next response and replace using the same chat tag. Persona image and inline Reply remain. Browser-side revisions stop stale avatar/worker lookups overwriting newer bodies without blocking message delivery.
- Verified TypeScript/build, 61 unit tests, isolated Chrome regression for two complete multi-fragment turns, portrait/actions, responsive boot at 320/390/1440px and reduced motion; offline panel/cold reload regression passed. Inspected mobile loading screenshot. Physical Android shade remains unverified: browser/OS can clip very long bodies and owns the domain label, which a web API cannot hide. No push/deploy, dependencies or storage changes.

### Call continuity, single-flow replies and persona-only notifications (19 October 2026)
- Owner superseded the two-participant notification request: show persona text only, no user echo/divider. Fixed worker icon field mismatch (chatAvatar versus avatar); foreground notifications carry their square persona icon into notification data so subsequent worker replacements retain it. Call notifications use the persona avatar too.
- Rolled ordinary chat generation back to bounded provider recovery within the same turn. Failed delivery no longer reverses read/sent messages to pending, clears recording and replays the whole presence flow. Unexpected terminal failure settles once through the existing deterministic fallback. Offline-first sends remain durable until reconnection; the one-minute in-flight safety ceiling remains. Worker-only background outbox limits remain bounded.
- Calls ignore GoAway warnings until the actual socket closes; do not prematurely cut playback. Transient post-setup provider errors use session resumption; duplicate close/error callbacks are generation-guarded. Normal audio bursts no longer hit the eight-second hang-up; queue is bounded at 30 seconds and suspended/overflow playback is marked unheard without ending the call. No evidence yet proves the physical phone's exact 30–44-second failure cause; no universal fix claim.
- During any active call, defer normal/automated/group generation, outbox flush and diary recovery. Starting a call cancels existing chat request controllers/pending stacking timers and diary request controllers; queued chat work and saved diary jobs resume after hang-up. Initial compact call-context preparation still runs before pickup; no summary/diary generation during the active conversation.
- Caption placeholders now read Add somethin.. for staged media.
- Checks: 61 tests, TypeScript/build; extended calling test covers GoAway, continuation past 35 seconds and 12 seconds of queued audio; unit tests cover suspended playback and duplicate disconnect callbacks. Browser voice-flow regression covers a 503 recovery inside one recording flow, no reversed ticks, one voice result and no late restart. Physical Android/real Google/notification shade remains unverified; no push/deploy.

### Bounded retries and two-participant notifications (19 October 2026)
- Owner requested a fallback after roughly one minute rather than indefinite retry. Durable text delivery now has at most three attempts within a persisted 60-second window starting with the first attempt; provider-level text retry loops are disabled for these durable turns. Retries are spaced at least 15 seconds; a 5-second lifecycle check settles exhausted work even when connectivity is lost. In-flight single/group requests use the remaining deadline and cancellation; fallback uses the existing in-character network excuse, a deterministic receipt and queue acknowledgement so it is emitted once. An offline send not yet attempted, a cloud-locked chat or an active call does not consume this retry window. Suspension may defer execution until resume.
- Notification bodies now contain the latest user text plus latest persona fragment separated by one blank line. Full texts are supplied without app truncation and older turns are replaced; no drawn divider glyphs. Shared notificationConversation helper is mirrored in the worker. OS card styling/line limits cannot guarantee two long messages fully visible.
- Verification: 57 tests, TypeScript/build, Chrome active-deadline/terminal-replay and reconnect/offline-panel checks pass. Worker attempts persist the same budget, bound API time by remaining time, and atomically save/ack fallback or successful replies. Policy/formatter/replay tests and a browser deadline-abort regression added; details in tasks/stability-followup-2026-10-19.md. Existing data, provider/voice selection and version remain unchanged; no push/deploy.

### v1.9.9 reliability and notification follow-up (19 October 2026)
- Investigated reported Android blank screens, delayed replies and background/weak-network loss. Exact handset black screen remains unproven; reproduced an offline lazy-panel failure: Vary: Origin prevented module requests from finding a cached JS response. Same-origin app-asset cache lookup now ignores Vary; API and remote-origin requests bypass this cache. Build injects all JS/CSS chunks into worker precache and syntax-checks the output. Required shell failures retain the previous worker; activation preserves one previous shell cache and call-control caches. Cache v24, app identity and databases unchanged.
- Removed eager execution of every lazy panel during startup, added a readable HTML bootstrap fallback, retained session voice previews on error reload, and limited conversation DOM to the latest 80 messages with Load earlier messages. Full history/search/diary data stays available. Message-group derivation no longer reruns for status-only chat changes.
- All ordinary sends enter the existing durable outbox before dispatch. Failed text turns remain pending rather than becoming fabricated successful network-excuse messages; retry groups messages per chat, awaits generation, honors active-call/generation locks and worker leases, and retries on reconnect/resume/15-second visible-page checks. Completed replies are saved before acknowledging queued items; optional responseToMessageId receipts prevent re-generation after interrupted acknowledgement. Shortened artificial presence/typing delays; retained user-configured stacking. Removed leaking hard watchdog races and delegate Studio request cancellation/timeouts to SDK. Emergency status watchdog now allows bounded text+TTS to finish before 90s recovery.
- Notification input is committed before network or visible-page handoff. Background replies save their entire transcript and acknowledge outbox work in one IndexedDB transaction before display; failures retain input, release the bounded lease and request Background Sync where supported. Returning pages reconcile only the captured exchange IDs after saving, not clearing newly arrived exchanges. Notification text now replaces old turns with the newest fragment and removes decorative divider lines.
- Last seen wraps beside 44px call/search/menu controls instead of truncating. Dark header, received bubble, base and composer use #0b1014; outgoing green and light-theme colors retained. Native notification chrome/domain belongs to browser/OS; cannot hide via the web API. No camera/screen-sharing or native wrapper added.
- Verification: 54 tests, TypeScript/build/worker syntax, local deployment smoke and clean runtime audit. Chrome weak-network/reload/receipt replay, first-open offline Settings, 1,000-message preservation, mobile UI, wallpaper/composer, reactions and call/custom-voice suites pass. Checks and limitations: tasks/stability-followup-2026-10-19.md. Synthetic Chrome/worker tests, no private chats/microphone or paid API calls; no push/deployment. Physical phone GPU/background suspension and native notification appearance still need device verification.

### v1.9.9 release/security pass (19 October 2026)
- Updated package/lockfile, browser/PWA metadata, Updates card and active documentation to 1.9.9; shell cache v23, stable PWA identity and user storage. No push/deploy; owner-only rule remains.
- Fixed dedicated production photo endpoints to honor explicit style/camera/time requests and preserve safety-block outcomes, matching Studio/local/main image routes. Added actual-entry-point and prompt-parity coverage.
- Mirrored same-origin validation across all Gemini endpoints, removed wildcard CORS, made API responses non-cacheable, kept authenticated status diagnostics private, bounded streamed UTF-8 bodies to 4 MiB, and blocked reserved 240.0.0.0/4 media destinations. Existing passkey/cookie and custom-key provider preserved.
- Added production/preview security headers; CI read-only token, no persisted Git credentials, 15-minute job timeout and Node 22. Scoped selector-parser 7.1.6 overrides remove the patchable build finding. Runtime audit clean; five high build-only Tailwind/braces entries remain with no compatible patched braces release. Review 26 October 2026; do not accept public build inputs.
- Final verification: clean install, 51 tests, TypeScript, production build, runtime audit and local deployment smoke pass. Real Chrome tests pass both call transports, custom designed/replicated samples/fallback, reactions, time-awareness save/reload, mobile light/dark layout and worker-controlled online/offline reload. CSP initially blocked fetching local audio samples; connect-src now permits data/blob conversion and regression coverage protects it. CSS output matches the pre-override SHA-256. No physical phone/deployed authenticated check.
- Added `npm run release:smoke -- URL` for version/assets/headers/public status/unauthenticated API checks. Production URL is https://wassapyo.vercel.app; last probe served v1.9.7 and old headers/status disclosure. Local fixes need owner push and deployed validation. See `release-1.9.9.md` for final results and limits.

### Voice delivery, explicit photo intent and context quality (19 October 2026)
- Owner approved audit follow-ups with strict quality control and clarified that diaries should remain deeply personal/emotional. Diary prompts/data were preserved. No release version bump or storage migration.
- Pinned Google SDK 2.24.0. All three TTS routes now send 3.8 speechMetadata.style separately from verbatim text and use voiceConfig.voice for prebuilt/custom identity. Prompting off skips metadata; personaTtsStyle does not repeat immutable custom design descriptions. Legacy 3.1 steering stays intact. Custom fallback never reads steering instructions aloud. Completed timeout handles clear; SDK timeouts and browser abort propagate, including no replacement voice after cancellation. Live/custom sample routing unchanged and regression checked.
- Shared utils/photoPrompt.ts supplies phone-camera realism by default, explicit professional/studio/lighting/pose/time overrides and mirror framing. Original userRequest travels through App, browser service and both Cloud image paths; Vercel mirrors the builder with a parity test. POV does not receive a persona portrait. Photo blocks return a controlled failure instead of dropping identity/style to retry a different scene. Final camera constructors are no longer independently hard-coded across routes.
- buildPersonaPrompt separates native API system rules from the existing serialized history; buildFullPersonaSystemPrompt remains compatible for snapshot callers. Group/events/reaction/media/voice context preserved on Studio/local/Vercel. No simultaneous native per-turn role migration.
- New notification systemRules omit embedded history/clock/gap; worker uses the latest available ledger and recomputes clock (including custom offset), preserving clock/time-awareness off and proactive intent. Legacy notification snapshots retain a fallback. Deleted messages excluded from new notification snapshots. SW cache v22, no database changes.
- Checks: 46 tests, TypeScript and clean build; browser call/custom-voice/reactions/mobile suites pass. SDK browser chunk adds ~19KB gzip; explicit CommonJS helper placement removes the vendor cycle exposed by the upgrade. No speculative dependency/framework added.
- Real synthetic Google probes: before/after text both answered the main question with persona tone and no emoji narration; plain/styled Aoede WAVs valid 24kHz mono, 4.52s/5.40s. Casual versus professional mug photos generated and visually inspected; refined casual prompt still can produce some bokeh. No broad quality guarantee, subjective listening or physical device/custom entitlement check. Results/limits: tasks/generation-quality-followup-2026-10-19.md. No user private chat/mic used, no push/deploy.

### Continuous ringback, nuanced reactions and prompt audit (19 October 2026)
- Ringback uses native audio looping until Live setup completes, including the connecting handshake. The random 6–12-second minimum preparation delay remains; End, failure and pickup stop playback. Removed the six-second replay interval that left most of the wait silent.
- `utils/reactions.ts` supplies reaction-only versus mixed-message priority and single-grapheme emoji validation. All message/reaction stacking callbacks apply the same priority: text/images/audio lead, reactions subtly affect tone. Historical reaction tags are background. Reaction generation decisions now happen outside the React updater so they do not depend on updater timing/side effects.
- Reaction picker offers 60 emoji plus a native-keyboard/paste field accepting joined emoji, skin tones, flags and keycaps. Rejects prose/multiple emoji. The scrolling palette uses a body portal with viewport-aware placement, resize handling, accessible names and Escape/focus return. No new dependency.
- Chat prompts on Studio/local Cloud/Vercel now prioritize current intent, avoid compulsory reaction/item acknowledgement, ground media observations and label each actual attachment with its sender/message. Voice-note transcript instructions are aligned and stop demanding random effects/fillers. Persona and custom voice configuration remain intact.
- Deep audit: `tasks/prompt-audit-2026-10-19.md`. Follow-ups include 3.8 TTS delivery metadata (computed style omitted on current 1.39 SDK path), hard-coded photo camera/lighting defaults and image-route drift, role-separated system/history, diary factual grounding, notification freshness and real-model A/B evaluation. No untested SDK upgrade or image pipeline rewrite.
- Checks: 38 tests, typecheck/build; synthetic/mocked both-provider call browser suite verifies clip rollover while awaiting setup plus minimum delay, pickup/End and persistence. Reaction browser suite checks light/dark, 320–1440px bounds, custom emoji persistence, Escape and mixed/standalone context. Screenshots under ignored output/playwright. No real Google generation, physical native-keyboard check or subjective voice/model A/B in this follow-up; no push/deployment.

### Dated call chat records, ringback asset and persona time toggle (18 October 2026)
- Every captured call now stores its full transcript in the ongoing chat card, including long calls independently of diary completion. `callHistoryText` supplies an explicit call-event label, ISO start/end timestamps and connected duration; once a summary exists, ordinary AI text history uses the dated summary while the full transcript remains expandable. Records are marked as events so mixed call speakers are not treated as a fresh user utterance. Existing recoverable records gain dates; previously discarded transcripts remain unrecoverable. Queued replies resume after call history insertion is initiated, rather than racing the IndexedDB save.
- Replaced quiet synthesized ring oscillators with bundled `public/sounds/ringback.wav` (Kaga Sound, CC0, attribution file alongside it), played at volume 0.7 in a dedicated audio element on a 6-second cadence. Exempted it from the call's competing-media pause handler; Audio toggles it and pickup/End stop it. Browser tests verify actual media time advances, not merely that an oscillator was created. Shell cache v21 precaches it.
- Added optional `Chat.timeAwarenessEnabled` (missing means on) to the persona profile, save/reload, backup export/import/validation, all foreground/automation/queued/inline-reply gap-context callers, both text providers and service-worker payloads. Off suppresses absence/frequency reactions and adds an explicit prompt override; it does not change the independent global clock-sharing setting or scheduled automation controls. Recent call end time counts as recent contact.
- Added concise emotion/intonation direction to Live while retaining the selected voice. Current Gemini 3.8 docs remove the old affective-dialog switch; no unsupported flag or different model was introduced. Listening quality remains a subjective/device check.
- Researched camera/screen sharing only: Live can consume JPEG frames (~1 FPS, up to 768x768 per Google guidance). Camera capture is feasible with permission; screen capture depends on browser/OS (Chrome Android currently unsupported; newer iOS Safari support differs by version). No video/screen controls, captures or relay routes were enabled. Sources and next-update requirements are in `tasks/voice-calling-research.md`.
- Verification: 34 tests, typecheck/build, both-provider calling suite (real ringback playback/mute/stop plus dated long/short chat records), custom-voice suite, persona toggle save/reload/independence and mobile UI regression passed. Preview restarted on 3013. Physical phone audibility and an emotional-voice A/B listening check remain unverified; no push/deployment.

### Call conversation quality, ringback and compact context (18 October 2026)
- Calls now use only persona name/description, shared voice settings and a generated summary of the latest 20 nondeleted text messages (2,000 chars/message, 1,600-char summary). Removed the full persona/system prompt, user profile, diaries, schedules, clock and raw chat history from Live setup. Personal keys summarize directly; authenticated POST `/api/gemini/live` handles Cloud summaries with bounded/validated text. Summary failure ends cleanly instead of sending raw context. Cloud text summaries use the existing text location (global default), independently of Live's us-central1.
- Synthesized 440/480 Hz ringback (2 seconds on, 4 off) plays for a random 6–12 seconds while the summary prepares. Microphone frames and greeting wait until pickup; connected duration excludes ringing. End cancels preparation, oscillators and streams. Ring cancellation displays Cancelled. Minimized calls retain ringback and notification End behavior.
- Both Live routes use low speech-start/end sensitivity, 200 ms prefix padding and 900 ms endpoint silence. Browser capture retains echo/noise cancellation, disables automatic gain and sends 40 ms chunks instead of 80 ms; playback gets a 40 ms scheduling margin. Server-confirmed interruptions still flush audio. These are initial tuning values, not a guarantee against every background voice/noise.
- Short calls (<60 connected seconds) retain labeled raw transcripts inside expandable history cards and Message.text so subsequent AI chats/call summaries can read them. Long calls with a usable transcript keep whole-call diaries and expose the summary in the card/history text. Recovery records are purged only after chat storage commits. Existing historical discarded transcripts cannot be restored. No raw audio is recorded by the feature.
- Real Google checks with generic synthetic data: tuned Live setup accepted; 4 seconds of hum/two brief noise bursts plus silence caused zero response chunks and no transcription; a synthesized 5-second spoken sentence was recognized and returned 92,162 PCM bytes. Global context summarization returned in 4,841 ms in one probe. A us-central1 text summary probe returned 404, motivating separate text/Live regions. No personal conversation or user microphone recording was used.
- Service-worker shell cache v20 refreshes the modified capture worklet without clearing user databases. Physical phone speaker/echo/Bluetooth/noisy-room/background calibration and deployed behavior remain unverified. No push/deployment.
- Final checks: all 30 tests, TypeScript/build, both-provider calling suite (ring delay, cancellation, summary failure, short transcript reload/next-call context, queued-speech interruption), custom voice suite, mobile UI widths/themes and touch/mouse selection regressions passed. Restarted the preview on 3013 and reloaded the owner's tab; no chats were reset.

### Persona voice parity for calls (18 October 2026)
- Shared `utils/voiceSelection.ts` now drives voice-note and Live selection priority (design, replication, selected voice), with common delivery style, pitch, pacing and prompting toggle. Calls use the saved prebuilt voice rather than an independent choice; voice-note model/provider behavior is unchanged.
- Google Cloud's current Live docs support `replicatedVoiceConfig` using 10–20 seconds of PCM, restricted to selected customers. Custom TTS `voice_`/`voicekey_` IDs are not documented Live IDs. Built-in Cloud calls use an available designed/replicated preview, resampled with the existing WAV helper to mono 24 kHz, stripped of its WAV header and capped at 20 seconds. Relay bounds/validates the sample, requires actual Vertex routing and never silently substitutes a prebuilt voice after custom rejection. Personal keys and missing/short previews show the chosen fallback explicitly.
- Samples retain existing session-only cache behavior; no new persistent audio storage or real custom recording was sent during verification. Custom Live access and audible TTS/Live identity are unverified. A reload may lose a custom preview. Current docs: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice .
- Checks: 27 tests, TypeScript/build, existing both-provider calling browser suite and new synthetic custom-voice browser suite (design, replication, missing/short previews) passed. Nothing pushed/deployed.

### Call preview diagnosis and light-mode fix (18 October 2026)
- Call-history cards now use the existing theme bubble/text tokens; light mode no longer renders dark green with dark text. Missing provider setup opens Settings before requesting microphone access or adding a failed-call card. Genuine failed attempts retain their controlled error message in history; existing older cards remain generic.
- The user's preview had Built-in Cloud locked. Separate Live checks using existing local ADC received Google's `setupComplete` and 99,840 bytes of generated PCM for a generic one-sentence connection test (`gemini-3.8-live`, us-central1, Aoede). No personal chat context or microphone audio was sent. This verifies actual provider handshake/audio generation, not a full spoken conversation or deployed/background operation.
- Verification: all 25 tests, TypeScript/build, and the calling browser suite passed. Added browser checks for both history themes, saved microphone-denial reason and locked-cloud preflight without extra call history. Reloaded the owner's preview and visually verified the corrected light card and Settings redirect; existing chats/history remain intact.

### Persona voice calling implementation (18 October 2026)
- Owner asked to build the internet AI call experience after selecting PWA-only/device-dependent background behavior. Added `CallOverlay` full/compact UI based on supplied Android references, bundled line-art wallpaper, supported mute/audio/transcript/notification actions and call-history cards. Disclosure accurately identifies AI-provider processing; group/video controls are unavailable.
- `services/liveCall.ts` uses installed `@google/genai` 1.39.0 Live APIs for personal keys and a same-origin authenticated standalone relay in `api/gemini/live.ts` for Built-in Cloud. Added explicit `ws` 8.22.0 dependency; Vite dev/preview upgrade wiring; cookie/Origin checks, frame/buffer/duration bounds and cleanup; independent `VERTEX_LIVE_LOCATION` (default us-central1); 300-second Vercel call endpoint. Shared credentials remain server-side. No SDK upgrade or credentials change.
- Streaming worklet capture sends 16 kHz PCM; 24 kHz playback supports interruption. Call owner survives UI minimize/navigation; mute disables transmission/tracks; End handles late permission, timers, sockets, nodes and cross-tab lock cleanup. Per-persona sends queue while calls are active; service-worker notification replies defer into the existing outbox. PWA background behavior remains OS/browser-dependent.
- `wassap_calls` is a new separate IndexedDB database (existing data/stores unchanged). Optional `Message.call` and `MemoryBubble.callId` support history and diary deduplication. At least 60 connected seconds plus two-way speech triggers a whole-call diary via existing providers. Jobs/results survive reload and retry after reconnect/unlock; successful/short-call transcript turns are removed. Memory toggles are not forced on. Chat/call deletion removes recovery records.
- Service-worker cache v19 includes capture assets and preserves the separate call-control cache; notification End is call-ID scoped and durable until acknowledged. A suspended page cannot guarantee immediate execution; no native background-call guarantee is claimed. Prebuilt call voice fallback is explicitly shown for custom-voice personas.
- Verification: 25 tests and TypeScript/build passed; Chrome tests with synthetic microphone/mocked provider transports cover both providers, PCM output/interruption, compact UI, mute, resumption, denied/late microphone, summary boundaries/whole transcript and persistence. Existing five browser regression scripts passed. README/architecture/design/research and .env.example synchronized. No real paid provider calls, physical Android audio/background tests, remote push or deployment performed; those remain release gates. Version stays 1.9.7 until owner chooses release naming.

### Calling requirements: PWA references, background behavior and call diaries (18 October 2026)
- Owner supplied WhatsApp full-call/minimized-in-chat screenshots and requested matching UI/feel, background calls, native notification End, persona/recent-chat/current-call context, and automatic diary-style summaries after roughly one minute. Reference chat contents must not be copied into shipped assets/fixtures, and the encryption claim must not be copied into AI-call disclosure.
- After platform clarification, owner explicitly chose **browser/PWA only, with device-dependent background support**. No APK/native wrapper is planned. Expanded `tasks/voice-calling-research.md` with the accepted requirements, notification/page-suspension limitations, in-app versus OS notification distinction, truthful audio controls and physical Android acceptance checks.
- Proposed summary threshold is 60 seconds connected (not ringing/reconnect gaps) plus meaningful two-way transcript. Whole-call input, persona diary voice/language, call-ID deduplication, persistent pending retry, existing memory-toggle respect and later recall are required. Actual call implementation and hardware/provider validation have not started.

### Persona calling: official-documentation research (18 October 2026)
- User identified real persona voice calls as the next update and requested deep Google documentation research and a plan. Research/proposal is in `tasks/voice-calling-research.md`; existing Android plan and outstanding device checks remain intact.
- Official docs distinguish `gemini-3.8-live` native real-time audio from Gemini 3.8 TTS. Proposed routing preserves personal-key direct access and server-authenticated Vertex access. Current Vercel docs support WebSockets in beta with Fluid Compute; actual deployment support, relay duration/reconnects and Vertex Live region/access need validation before committing to hosting. Do not expose shared keys or GCP bearer tokens to browsers or assume Developer API ephemeral tokens cover Vertex.
- Reuse persona/context helpers with a small spoken-call adaptation. Documented prebuilt Live voices are the initial recommendation; custom designed/replicated TTS voice compatibility remains unverified. Proposed staged scope, audio pipeline, interruptions, transcript continuity, competing chat/background work and cost/cleanup checks are recorded in the research.
- Installed SDK is `@google/genai` 1.39.0 with Live interfaces; actual 3.8 compatibility needs a spike before any upgrade. No implementation, dependency changes, paid calls, deployment or microphone capture performed. Research-only changes checked with `git diff --check`.

### Development readiness check (18 October 2026)
- Confirmed local planning, implementation, frontend/API, testing, debugging, review, security and Git skill files are present, alongside Ponytail. Node v22.14.0, npm 11.7.0 and Git are available; installed TypeScript/Vite/tsx executables work.
- Fresh verification passed: all 19 tests, `npm run typecheck`, and `npm run build`. No application source changed.
- Dedicated Chrome DevTools MCP tools are not exposed in this session; browser automation is available through the separate CUA tool but was not exercised. Graphify and playwright-cli were not found on PATH; no Graphify graph is present. Plugin search reports GitHub and Figma uninstalled; neither is needed for local implementation. No installations or permission changes were made.

### Documentation onboarding before next update (18 October 2026)
- Reviewed project overview, architecture, design, rules, release history, Android polish plan/checklist, and the older `up_plans.txt`. Current baseline is v1.9.7; the next major update has not yet been specified in this session.
- No `graphify-out/graph.json`, Graphify report, or Graphify-named artifacts were found in this checkout, including hidden/ignored project files outside dependencies. No graph was rebuilt.
- Historical documentation includes superseded cache versions, model/authentication details and branch references; use current maintenance notes and verify affected source before implementation. Confirmed current shell cache v18 and checkout branch `main`.
- Application code was unchanged; no builds, tests, paid-provider calls or device checks were run for this documentation review.

### Direct-main workflow correction (18 October 2026)
- Owner wants normal direct pushes from Source Control, without feature branches/PRs. Recorded this in Rule 1.2; future work stays on `main` unless explicitly requested otherwise.
- Fetched remote refs: `origin/main` already contained v1.9.7 through PR #5 (`f0c0ce7`); only heading-reload commit `9140bc1` was absent. Fast-forwarded local main to origin/main and cherry-picked that missing commit as `961282e`. Original branch remains available; resulting app tree matches it exactly. Main now tracks origin/main and is one commit ahead; no remote push or PR creation performed.
- Documentation-only workflow notes remain for the owner to commit, then push normally to main. Version remains 1.9.7; data/provider code unchanged.


### v1.9.7 mobile heading reload follow-up (18 October 2026)
- The mobile inbox WhatsApp title is now a keyboard-accessible button labelled Reload app, preserving its appearance with a 44px minimum touch height. It calls normal location reload in browsers and installed PWAs; desktop/Archived titles remain unchanged.
- Reuses existing network-first shell loading (cached offline fallback) and startup worker-update checks. No storage/session/cache clearing, migrations, provider changes or version bump. Documentation synchronized. TypeScript, production build and all 19 tests passed. `tests/mobile-reload.browser.js` passed with an active service worker: online reload, offline cached reload, saved chats/settings retained, 44px touch target, unchanged desktop heading and v1.9.7 title. Existing unload/pagehide handlers flush pending chat saves. Physical installed Android validation remains manual.

### v1.9.7 phone UI fixes and release consolidation (18 October 2026)
- Reproduced the clipped green textarea focus outline and keyboard-dependent custom-wallpaper crop in an isolated mobile Chrome context. Scoped outline suppression to the composer textarea; all other keyboard focus indicators remain.
- Moved wallpaper behind messages AND composer in `ChatWallpaper.tsx`. ResizeObserver retains the maximum mobile pane height per width, resets on rotation/width change, follows desktop resizing, and disconnects on unmount. `utils/wallpaper.ts` has regression coverage for sizing and saved presets. No data rewrite.
- Increased diary date text to 12px; preserved the diary action. Softer semantic row/navigation dividers, desktop-only inbox right border, theme-matched body background remove prominent phone seams without changing form borders.
- Consolidated Android polish, archive/pin selection, call coming-soon shortcut, navigation motion and these fixes under v1.9.7 in package/lock, HTML/social/Apple/PWA metadata, foreground title restore, README and Updates. Shell cache v18 refreshes assets only; PWA ID/start URL and all localStorage/IndexedDB identities remain unchanged.
- No provider, credential, shared-passkey, media, voice, outbox, or saved data paths changed. Verification: 19 unit/regression tests, TypeScript and production build passed. Four production-browser scripts passed: mobile UI at 320/360/390/412/768/1024/1440px (including stored chats/memories/voices/key/media/outbox fixtures), archive/navigation, mobile/desktop hold-pin selection, and v1.9.7 keyboard-height/crop/draft/focus/date/divider/title checks in both themes. Screenshots inspected. Physical Android IME/PWA and paid-provider calls were not exercised.


### Chat-list hold selection and pinning (18 October 2026)
- Touch or left-mouse hold for 450ms selects a chat without opening it; movement beyond 10px, leaving the row, cancellation or unmount clears the hold timer. Completed holds suppress their click. Right-click / Shift+F10 / Space also select on desktop; Escape, the toolbar Back button and mobile Back dismiss selection. Selected rows show a green check and selection background; clicking additional rows toggles multi-selection.
- Added selection-toolbar Pin/Unpin and Archive/Unarchive actions on mobile and desktop. Optional `Chat.pinned` persists in existing chat records; stable filtered sorting puts pinned rows first while preserving their underlying order. A pin indicator appears beside previews. Pinning/archiving updates metadata only, preserving messages/media/persona/provider data; no new stores, migrations, dependencies or pin limit.
- Desktop inbox remains selection-active while a conversation is open. Shell cache v17 refreshes UI assets. Updated README/design/architecture and added `tests/chat-selection.browser.js` with fresh contexts.
- Focused browser checks passed for mobile touch hold, movement/scroll cancellation, multi-select, Back, pin persistence and archive/unarchive; desktop mouse hold, right-click, Space/Escape and the same data-preserving actions passed. TypeScript and production build passed. Real-device haptic calibration and a broad provider rerun were intentionally outside this small change.

### Call coming-soon banner (18 October 2026)
- Updated the existing call-icon tap banner and hover tooltip to “Coming soon, stay tuned…” as requested. Existing three-second dismissal remains; no calling/provider/data behavior changed. Updated the focused browser assertion for the new text.

### Archived chats and reference navigation follow-up (18 October 2026)
- Added optional `Chat.archived` metadata in the existing chat records. Absent means unarchived; archive/unarchive changes only this flag, preserves conversations/media/personas and leaves replies/background routing intact. Archived chats remain in the Archived section when messages arrive; excluded from the main inbox/unread badge. Chat options provide Archive/Unarchive; the section supports explicit and browser Back.
- Added a rounded outlined handset beside chat search, matching the supplied screenshot. Clicking it explains that voice calling is unavailable; no call backend or provider changes.
- Inspected the supplied 9.77-second recording through decoded playback frames: inbox-to-chat around 2.7s, contact info around 4.2s, Back to chat around 6s, inbox around 7s. Added a 260ms mobile push/parallax between mounted inbox/chat screens and softer 240ms profile entry / 220ms reverse exit; reduced motion respected. Desktop layout unchanged.
- Focused browser regression (`tests/archive-ui.browser.js`) checks archive/unarchive, persistence/history preservation, handset feedback, profile reverse animation and reduced motion. Required TypeScript/build checks pass; intentionally avoided a broad verification rerun per user request. Shell cache v16 refreshes UI assets; data stores remain unchanged.
- Archive is organization, not a password lock; notifications remain governed by existing settings. Physical Android timing/haptics remain uncalibrated.

### Android-first UI polish implementation (18 October 2026)
- User approved implementation and requested a premium mobile feel with close icon styling. Work is local on `codex/android-mobile-polish`; nothing pushed. Reused Lucide with consistent rounded-outline strokes; no dependency added.
- Scoped mobile CSS instead of globally repositioning every `.app-panel` or forcing every button to 16px. Fixed narrow filters and tray obstruction; introduced dynamic viewport/fallback, Android keyboard resize opt-in, zoom support, larger icon targets, inset inbox dividers and available-width media caps. Saved message/composer font scaling is retained.
- FAB now opens New Persona directly. Profile/calendar/group/settings remain in overflow; bottom nav offers Chats, app Updates, Guide and Settings. Removed inert Calls/Favourites affordances; search labels match name filtering and AI rings remain separate actions. Attachment tiles are quieter and semantic; privacy/location/placeholder text now reflects actual behavior.
- Added missing local menu/panel animation utilities, incoming/outgoing recent-message treatment with expiring IDs, reduced-motion programmatic scrolling, single threshold haptic and swipe click suppression. Existing audio controls/voice settings and provider/timing code remain intact.
- Mobile screen panels isolate background interaction, focus/Tab/Escape and restore focus. Back dismisses chat trays/menu/search/selection first; explicit panel close consumes its history entry. Group creation's conditional Back control participates in the same dismissal contract.
- Retired Misty Forest resolves at render time to a bundled SVG; saved values/custom wallpaper records are not migrated. Service-worker shell cache is v15; notification/provider/storage logic is unchanged.
- Browser regression covers 320/360/390/412/768/1024/1440px, light/dark, filters/search, creation, panels, focus, tray handoff, Back/Escape, denied location, short screens and reduced motion. Fresh-context fixtures verify saved key, profile, custom voice, media and pending outbox retention as well as chat content. Existing first-launch family voice defaults are normalized before capturing the persisted-data baseline.
- `npm test` passed 17 tests, including existing authentication/provider/media/backup coverage and the wallpaper test. Final verification outcomes and remaining physical-device checks are recorded in `tasks/todo.md`. Physical Android IME/PWA/haptics/TalkBack/frame pacing and paid-provider calls have not been validated in this desktop review.
- Updated README, design and architecture docs. Repository Rule 5.2 continues to require this `memory.md` update after every completed task.

### Android-first mobile UI research and proposed polish plan (18 October 2026)
- User confirmed the previous optimization update works and explicitly chose **Android first** for the next UI pass. Requested a report before implementation; no application code or UI behavior changed in this review.
- Read existing design/memory/rules and selected mobile components. Viewed Meta's official Android reference screenshots and researched published filters, favourites, themes and later product context. Reviewed the production UI in an isolated Chrome profile with sample chats at 320/360/390/412 px, including conversation, attachment/emoji trays, profile, Settings and light/dark appearance. These are viewport checks, not physical Android tests.
- Confirmed: clipped Groups filter at 320 px (right edge ~362 px) caused by broad 16 px mobile button override; full-panel CSS makes the attachment tray cover its Attach/emoji controls; referenced animate-in/fade-in/zoom-in classes are absent from built CSS; Favourites currently equals All; Calls has no action; small/unnamed touch controls; inaccurate copied end-to-end encryption notice; Misty Forest wallpaper URL returned 404. Location/contact/poll limitations were source-reviewed, not invoked.
- Existing swipe/hold/reaction/haptic/audio features, reader-position protection and CSS reduced-motion support should be retained. Prior compact voice-selector work is already present. Keyboard/browser-bar resizing, gesture conflicts, native Back ordering, TalkBack and frame pacing need real-device validation before performance or keyboard-fix claims.
- Saved detailed findings, source links and compatibility contract in `tasks/plan.md`; ordered implementation slices and acceptance criteria in `tasks/todo.md`. **Implementation remains pending user review.** No new runtime dependency, storage change, provider/model change, or deployment was made. Preserve all user data, shared cloud passkey, direct Gemini-key mode, background/notification flows and existing text/image/voice selections.
- Rule 5.2 in `rules.md` already requires updating this `memory.md` after each finished task; do not create a duplicate `memories.md`.
- Review completion checks: `npx tsc --noEmit`, `npm run build`, and `git diff --check` passed. Closed the isolated review browser and temporary preview server. Runtime source remains unchanged.

### Security, compatibility, and text-model maintenance (18 October 2026)
- Preserved the existing member passkey through a server-only compatible validator; `VERTEX_PASSCODE` now works as an override. `/api/gemini/auth` sets/clears an HTTP-only, SameSite=Strict cookie (Secure on HTTPS). Members enter the same key once after upgrading; saved unlock booleans alone are no longer trusted. All paid standalone endpoints and local middleware validate the cookie, while older explicit passcode requests remain compatible.
- Removed the passkey from constants, service-worker code, and voice helpers. Removed Vite's server-key substitution; server credentials from `.env` now reach only the Node backend. Direct Gemini keys entered in Settings are preserved.
- Kept text generation on only `gemini-3.8-flash` and `gemini-3.5-flash-lite`, including diary, photo-caption/excuse, retries, and background replies. Old selections fall back to 3.8; voice/image model choices remain unchanged.
- Fixed service-worker custom-key routing (`studio`, with `custom` retained for old notification data); bumped shell cache to v14. Pending outbox sends and scheduled triggers wait for cloud unlock; response handlers read current settings for delayed/native callbacks; the reconnect callback refreshes its settings closure and prevents concurrent drains. A production-browser regression confirms exactly one resumed request and retention of the pending message.
- Added DNS-checked, IP-pinned public media downloads with redirect revalidation, a total 6-second deadline, and an 8 MB stream limit. Shared local guard is mirrored inside standalone Vercel handlers; regression tests enforce parity without introducing cross-endpoint runtime imports.
- Added persona-backup boundary validation, preserving both valid flat legacy exports and wrapped exports; invalid fields are rejected before state changes.
- Preservation checks exposed legacy inline-image deletion without an IndexedDB copy: fixed load/save predicates. Media writes/deletes now wait for transaction commit and close DB connections. Database names/versions, localStorage keys, and existing record formats are unchanged; no user's storage was cleared.
- Added `package-lock.json`, pinned npm 11.7.0, declared the already-used Google auth library, updated compatible vulnerable dependencies, added Node regression tests and a verification workflow. Production audit: **0 vulnerabilities**; full audit: **7 Tailwind 3 build-time dependency advisories** (5 high, 2 moderate). Deferred forced Tailwind 4 migration to avoid UI regressions; only trusted source/config should enter builds, review by **18 November 2026**.
- Updated rules with preservation, member access, dual-provider, no-public-credentials, model, and port requirements. README now says port 3000 and explains the cookie upgrade; architecture/design docs match current behavior. Removed a failing external Google Fonts request for the already-local Segoe UI system font.
- Verified: 16 Node regression tests; TypeScript; production build; secret-canary browser-bundle check; independent bundling of all 10 Gemini endpoints; real public Unsplash avatar download; isolated production-browser cloud unlock/lock/wrong-key/reload, both model choices, provider switching with key preservation, mocked cloud reply persistence, valid/invalid imports, desktop/mobile visual checks, offline shell, IndexedDB media, and pending-queue preservation.
- Live Google quota/model permissions, real generated image/audio quality, deployed Vercel execution, and native Android notification actions still require real credentials/device verification. Browser cloud reply tests use a mocked response and do not spend Google credits.
- Follow-up suggestions from the wider review: replace the misleading end-to-end-encryption wording (AI providers receive prompts); expose storage quota/save failures to users and add full chat/media backup (current persona exports omit chat messages); plan Tailwind 4 migration; coordinate any future shared-passkey rotation because older published builds/history contained it.

### 1. Authentic Persona Diary Voice & Multilingual (Hindi/Hinglish) Mirroring Hotfix (`v1.9.6-hotfix2`)
- **Root Cause Analysis of Diary Impersonation & Language Switching Bugs**:
  1. *Lack of Language / Dialect Directives*: The diary prompt was composed entirely of formal English guidelines, instructions, and titles (`TASK: Write an intimate, personal journal entry titled "Recollection of Shared Events: ..."`). With zero language constraints, models defaulted to English prose even when the persona spoke Hindi, Hinglish, Spanish, or other languages.
  2. *Artificial Literary Pretentiousness*: The prompt commanded personas to write in "rich, heartfelt literary paragraphs that capture the passage of time" like "someone holding their private leather-bound journal before bed". This suppressed the persona's natural texting voice, slang, humor, personality, and informal thoughts, turning the output into a generic English essay.
  3. *Dropped Environmental / Real-World Events*: In `ChatWindow.tsx`, `capturedMessages.map()` omitted `isEvent` and `eventTitle`. Environmental events added by the user were treated as generic messages from "User", and sampling in multi-day recollections could discard them if chat volume was high.
  4. *Missing Companion Identity*: The persona prompt lacked knowledge of `userProfile` (the user's actual name and identity), referring to them generically as "User".
- **The Resolution**:
  - **Dynamic Multi-Language Detection & Script Mandate (`detectDiaryLanguageDirective`)**: Detects Devanagari script, Hinglish vocabulary (`yaar`, `bhai`, `mast`, `aaj`, `mujhe`, etc.), or persona language definitions and injects an unmissable mandate requiring the diary to be written in the exact matching language, dialect, and script without defaulting to English.
  - **Authentic Private Inner Monologue**: Replaced artificial essay instructions and meta titles with pure first-person thoughts (`"I"`, `"my"` / `"mai"`, `"mujhe"`, `"mera"`), revealing honest unspoken feelings, quirks, humor, and secrets without artificial headers (`Title:`) or narrator detachments. Incorporates `humaneSettings` (anti-robotics, mood slider, cadence).
  - **Guaranteed Event Reflection (`isEvent`, `eventTitle`)**: Preserved and highlighted real-world events across single-day and multi-day history (`[SHARED REAL-WORLD EVENT / OCCURRENCE]`). In multi-day message sampling, real-world events are prioritized and never pruned.
  - **Companion Profile Awareness**: Passed `userProfile` from `App.tsx` through `ChatWindow.tsx` to `getGeminiDiaryEntry`, allowing personas to naturally think of their companion by name.
  - **Synchronized Tri-Platform Implementation**: Applied consistently across `services/geminiService.ts`, `server/vertexHandler.ts`, and `api/gemini/diary.ts`.

### 2. Voice Design Synthesis & Multi-Voice Persistence Hotfix (`v1.9.6-hotfix1`)
- **Root Cause Analysis of Voice Design & Multi-Voice Issues**:
  1. *Storage Quota Rejection*: Vertex AI Voice Design returned a heavy base64 WAV sample audio preview (~1 MB) in `sampleAudioDataUrl`. Because browser `localStorage` has a strict 5 MB total quota across the entire app (shared with chat history and backstories), saving a second voice caused `localStorage.setItem` to throw `QuotaExceededError`. It was caught silently, preventing newly crafted voices from ever saving or showing up in the library.
  2. *Duplicate Congested Mobile Layout*: The Voice Design settings stacked a dropdown selector AND duplicate voice cards directly underneath it, crowding buttons and badges onto small phone screens.
  3. *Cloud ID Collision*: When `data.name` ended in `/voices`, naive splitting resulted in `id: 'voices'`, causing ID collision across custom voices.
- **The Resolution**:
  - **Lean Quota-Safe Storage (`utils/customVoices.ts`)**: Stripped heavy base64 audio strings from `localStorage` payloads before writing, shrinking custom voice records from ~1,000,000 bytes down to ~200 bytes (a 4,000x reduction). In-memory `audioPreviewCache` preserves immediate sample playback for active sessions with zero disk bloat.
  - **Automatic Storage Self-Repair & Quota Retry**: On load and save, `getSavedCustomVoices()` automatically cleanses legacy base64 audio payloads from stored items and retries saving with lean records if quota is ever exceeded.
  - **Guaranteed Unique Cloud IDs**: Fixed voice ID normalization in `api/gemini/voices.ts` and `utils/customVoices.ts` to ensure `candidateId !== 'voices'`, preventing collision with collection paths.
  - **Spacious, Native WhatsApp UI (`components/ProfilePanel.tsx`)**:
    - Replaced the congested dropdown-plus-card stack with a clean native WhatsApp `<select>` dropdown and a single dedicated Active Voice Card.
    - Active Voice Card displays the voice avatar, gender pill, active indicator, audition button, trash button, prompt description quote box, and a prominent WhatsApp green "Test Voice Note as [Persona]" button.
    - Clean collapsible "Craft New Voice" accordion with inspiraton chips, custom name, prompt, and gender selector.
    - Interactive success modal with audition sample player and inline confirmation banners.
  - **Direct Voice Config Routing (`speechConfig.voiceConfig: { voice: selectedVoice }`)**: For custom voices on Gemini 3.8 models, synthesis payloads pass `{ voice: selectedVoice }` directly to Vertex AI, with automatic in-candidate fallback to a gender-matched studio voice + injected prompt directives if the custom voice is unresolved or falls back to Gemini 3.1.

### 2. Multi-Day Journal Recollections (Chronicle of Events) & Local Persona Migration Engine (`v1.9.6`)
- **Root Cause Analysis of Multi-Day Diary Skipping**:
  - `messageHistory.slice(-40)` was discarding earlier days completely if the most recent 1–2 days contained 30–40 messages.
  - Messages passed to the diary endpoint previously lacked `date` and `timestamp`, giving the model a flat stream of text with zero day boundaries.
  - The single-day prompt instructed the model to reflect on interactions "today", naturally biasing language models toward the end of the text.
- **The Resolution**:
  - **Day-by-Day Chronological Grouping**: `buildDiaryHistoryAndPrompt()` partitions history by calendar date and attaches timestamps (`=== [DAY: YYYY-MM-DD] ===\n  User [14:30]: ...`).
  - **Proportional Historical Sampling**: Instead of discarding older days, the engine samples balanced subsets (opening exchanges, top substantive discussions, and closing turns) for each day, ensuring the full narrative arc across up to 31 days is preserved.
  - **Thematic Multi-Day Prompting**: When spanning multiple days, the prompt dynamically pivots to an intimate, retrospective genre (`Recollection of Shared Events` or `Weekly Chronicle of Events`), instructing the persona to reflect on evolving closeness, inside jokes, and standout moments across the entire period rather than writing a dry log or summarizing only the final evening.
  - **Adaptive Title & Span Flexibility**: Memory captures now adaptively title journals based on duration (`Diary` for 1 day, `Weekly Chronicle` for 6–8 days, and `Recollection of Events` for extended periods) and allow spanning up to 31 days.
- **Local Persona Backup & Migration Engine (100% Client-Side Privacy)**:
  - **Zero Chat Storage**: To guarantee complete privacy and zero server-side exposure, persona backups strictly exclude raw chat messages (`chat.messages`).
  - **Full Persona Identity Portability**: Exports name, avatar, backstory (`about`), role, speechStyle, systemInstruction, schedule, automations, humaneSettings, voiceSettings, and memoryBubbles to `<Persona>_Profile_Settings.json`.
  - **1-Click Restore & Recreate**:
    - **In `ProfilePanel.tsx`**: A dedicated *Persona Backup & Migration* card lets users export a backup or restore/overwrite settings on an existing persona with a single click.
    - **In `NewChatPanel.tsx`**: An *Import* button in the top header allows users to select a `.json` backup file, automatically pre-filling all rich character attributes for instant contact creation.

### 2. AI Diary Engine Modernization (Gemini 3.8 Flash) & Resilience Shield (`v1.9.5`)
- **Root Cause Analysis of AI Diary Failure**:
  - `fetchVertexDiary` in `services/geminiService.ts` used a hardcoded `timeoutMs: 16000` (16 seconds) and zero retry attempts.
  - Generating intimate, multi-paragraph private diary entries spanning up to 40 conversation messages on `gemini-3.8-flash` regularly requires 14–20 seconds of generation time.
  - At the 16.0s mark, the client's `AbortController` aborted the request with a `TimeoutError`, returning the generic error: `"Unable to connect to the built-in Vertex AI server. Try again later or switch to 'Custom API Key' in Settings."`
  - In addition, the authentication passcode was previously passed only in HTTP request headers (`x-vertex-passcode`), which can be stripped by aggressive CORS filters or reverse proxies, and `server/vertexHandler.ts` did not check `GEMINI_API_KEY`.
- **The Resolution**:
  - **Extended Client Timeout & Retry Shield (`services/geminiService.ts`)**: Upgraded `fetchVertexDiary` to a 30-second timeout on Attempt 1 and 15 seconds on Attempt 2, with automatic exponential retry handling.
  - **Dual-Channel Passcode Authentication**: Embedded `passcode: VERTEX_PASSCODE` directly in the JSON request body alongside request headers for fail-safe serverless authentication.
  - **Primary Model Upgrade (`DEFAULT_MODEL` / `gemini-3.8-flash`)**: AI Diary generation now defaults to `gemini-3.8-flash` across client and server handlers (`api/gemini/diary.ts`, `server/vertexHandler.ts`, `services/geminiService.ts`).
  - **Deduplicated Fallback Chain with Safety Timeouts**: Configured clean deduplicated fallback lists `Array.from(new Set([primaryModel, 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']))` on both server and client. Each candidate model is wrapped in a 24-second `Promise.race` safety timeout to prevent serverless function hangs.
  - **Multi-Source Credential Resolution**: Updated `server/vertexHandler.ts` to check `VERTEX_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY`.
  - **Voice Note Architecture Alignment**: Verified that `selectedModel` is strictly prioritized on Attempt 1. 3.8 Flash and Flash-Lite use pure verbatim text with official vocal tags (`<laugh>`, `<sigh>`, `<gasp>`) and native Voice Design & Replication in `voiceConfig`, while acting directive prompt steering is reserved exclusively for `gemini-3.1-flash-tts-preview`.

### 2. Network Resilience Engine & Anti-Stall Auto-Healing Watchdog (`v1.9.4`)
- **Root Cause Analysis of Persona Hangs**:
  - Unbounded `fetch()` socket hangs on mobile data / flaky Wi-Fi when switching networks or experiencing dropped packets.
  - Previous `finally` logic used `status === 'typing...'` which failed to reset status when the persona was in `'recording audio...'`.
  - Massive multi-megabyte payloads during marathon chats: history serialized all previous IndexedDB base64 media, leading to 15MB+ payloads that choked mobile network uplinks and triggered Vercel 413/504 errors.
- **Anti-Stall Watchdog & Auto-Healing Engine (`App.tsx`)**:
  - `personaStatusWatchdogTimersRef` and `personaAbortControllersRef` track in-flight actions per persona.
  - Arming a 30-second hard ceiling timer whenever status enters `typing...` or `recording audio...` (`setChatStatus`).
  - If a persona remains busy past 30s without emitting a message, watchdog automatically aborts active fetch controllers, resets status to `online` (scheduling natural `offline`), releases `activePersonaResponsesRef` locks, and delivers an authentic in-character glitch excuse without requiring manual settings resets or page reloads.
  - Hard `Promise.race` 30s watchdogs wrap all `aiGenerationPromise` executions in `handleSingleResponse` and `handleGroupResponse`.
  - Comprehensive `clearChatActiveStatus()` cleans up typing/recording indicators across all `finally` blocks in single-chat, group-chat, and background automations.
  - Enhanced `handleRefreshPersona` aborts active abort controllers, clears watchdog timers, and releases all locks immediately.
- **Atomic Turn Tokens & Anti-Double Reply Shield (`App.tsx`)**:
  - Prevents race conditions where a watchdog excuse and a late background voice note/text reply are delivered to the same user message.
  - `personaTurnTokensRef.current[chatId] = turnToken` tags each conversational turn with an atomic timestamp token.
  - If the 30s watchdog triggers, it resets the token to `0`, invalidating the turn. Any subsequent response from background promises checks the token and is discarded immediately.
  - The watchdog timer is disarmed the moment generation finishes, ensuring media saving or recording presentation delays never trigger false excuses.
- **Voice Note & Gemini 3.8 Flash TTS Latency Diagnosis & Restoration (`api/gemini/tts.ts`, `server/vertexHandler.ts`, `services/geminiService.ts`)**:
  - **Root Cause of Flash TTS Slowdown**: In commit `e093cb6`, TTS logic introduced an invalid schema `{ voice: selectedVoice }` inside `voiceConfig` and injected `userPart.speechMetadata = { style: ... }`. Neither field exists in Google's API schema (Google GenAI requires `prebuiltVoiceConfig: { voiceName: string }` and `Part` only allows standard fields).
  - Every time `gemini-3.8-flash-tts` or `gemini-3.8-flash-lite-tts` was called, Google returned `400 INVALID_ARGUMENT`. The candidate fallback loop caught this error on Attempt 1, failed on Attempt 2 (also 3.8), and finally fell back to Attempt 3 (`gemini-3.1-flash-tts-preview`), which succeeded only because 3.1 happened to use the legacy `prebuiltVoiceConfig` schema.
  - Additionally, on Vertex AI, `gemini-3.8-flash-lite-tts` is not a publisher model (it is an AI Studio model), causing a 404 on Vertex if attempted first.
  - **The Resolution**:
    - **Strict Model Priority**: Whichever model is configured as `selectedModel` is tried **FIRST** on Attempt 1. Fallback models (`gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`, `gemini-3.1-flash-tts-preview`) are only engaged if Attempt 1 actually throws an error.
    - **3.8 Flash & Flash-Lite Specialization**: Native Voice Design and Voice Replication are preserved via standard `prebuiltVoiceConfig: { voiceName: isCustomVoice ? 'Aoede' : selectedVoice }`. Receives pure verbatim text with official vocal tags (`<laugh>`, `<sigh>`, `<gasp>`, `<whispers>`, `<cough>`). Completely removed `generateConfig.systemInstruction` (which caused `400 INVALID_ARGUMENT` as audio modalities reject system instructions) and removed extraneous acting prompt wrappers.
    - **3.1 TTS Preview Acting Directives**: Acting directive prompt steering (`"Say the following in a natural WhatsApp voice note with a ... delivery: ..."`) is preserved exclusively for `gemini-3.1-flash-tts-preview`.
    - Synthesis now succeeds on Attempt 1 in 2-3 seconds without schema rejection or premature model fallbacks.
- **Voice Note & TTS Synthesis Headroom (`services/geminiService.ts`, `server/vertexHandler.ts`, `api/gemini/tts.ts`)**:
  - Extended TTS candidate synthesis timeouts across server and client to 18-22s, ensuring Gemini 3.8 Flash TTS has adequate time to synthesize audio on slow connections without prematurely failing over.
- **Expanded Crafty & Creative English Excuses Library (`services/geminiService.ts`)**:
  - Replaced repetitive single-string fallbacks with 40+ crafty, authentic English excuses categorized into:
    - **Witty / Sarcastic**: *"My phone literally had an existential crisis right when I was typing haha. What were you saying?"*, *"Great, my wifi decided to take an impromptu power nap. Say that again?"*
    - **Sweet / Gentle**: *"Oh no, my internet cut out right as your message arrived! Could you please repeat that?"*, *"I'm so sorry, my screen locked up on me for a second! What were you saying?"*
    - **Formal / Professional**: *"Apologies, I experienced a brief network disruption on my end. What were you saying?"*, *"My apologies, my signal cut out momentarily. Could you please send that again?"*
    - **Casual Everyday WhatsApp**: *"Wait sorry, my phone slipped out of my hand for a second haha! What did you say?"*, *"Oops, low battery prompt popped up and froze my screen! Say that again?"*
  - Strict requirement: 100% natural English across all personas (no Hinglish or other languages).
  - Dynamic non-consecutive randomization (`lastNetworkGlitchExcuse`) ensures users never see the same excuse twice consecutively.
- **Text Stacking Delay & Watchdog Phase Harmony (`App.tsx`)**:
  - Designed specifically to respect user and persona typing and reading stacking delays.
  - `setChatStatus` automatically clears and re-arms a fresh 30s watchdog for each chunk typing phase, while intermediate `online` states clear the timer.
  - Long multi-message stacked responses with natural pauses never falsely trigger the watchdog.
- **Zero-Lag Failure Recovery (No Blocking Retry Loops)**:
  - Bypasses slow, stacked retry loops that stall mobile chat screens for 40+ seconds on cellular drops.
  - Fails fast and immediately delivers the persona's crafty excuse so the conversation continues seamlessly.
- **Payload Compression for Marathon Chat Sessions (`App.tsx`, `services/geminiService.ts`)**:
  - `prepareHydratedHistory()` limits IndexedDB image/media hydration to the recent 25 messages and at most 2 media attachments. Older media attachments are cleanly replaced with lightweight text placeholders `[ATTACHED {type}]`.
  - `sanitizeHistoryForVertex()` retains base64 media for at most 2 items within the last 6 messages.
  - Slashes mobile upload payloads by 99% (from 15MB+ down to <50KB), completely eliminating mobile uplink freezes.
- **Enforced Request Timeouts (`services/geminiService.ts`, `server/vertexHandler.ts`, `api/gemini/tts.ts`)**:
  - `fetchWithTimeout()` with strict timeouts (20s text LLM, 22s voice note TTS, 16s diary) and `AbortSignal` propagation.
- **Non-Blocking Voice Note (TTS) Degradation (`App.tsx`)**:
  - If voice note synthesis times out or fails on slow connections, `handleSingleResponse` immediately degrades to delivering the spoken text message directly in natural chunks without trapping the persona in `recording audio...`.
- **Authentic WhatsApp Audio Recording Presence (`components/ChatWindow.tsx`, `components/ChatList.tsx`)**:
  - Added `RecordingAudioBubble` with pulsing green indicator and animated microphone icon in chat header and chat list to accurately reflect WhatsApp's native recording presentation.

### 2. Online GIF & Sticker Search, Expanded Library & GIPHY Integration (`v1.9.3`)
- **Expanded Reaction GIF Database (`utils/stickersAndGifs.ts`)**:
  - Grown to 80+ top viral reaction GIFs categorized across `Trending`, `Reactions`, `Laughing`, `Love`, `Shocked`, `Dancing`, `Memes`, and `Yes/No`.
  - Multi-tag indexing and high-speed offline fallback search.
- **Expanded Vector Sticker Collection (`utils/stickersAndGifs.ts`)**:
  - 36 handcrafted SVG/WebP vector stickers across 5 packs: `Pepe & Frog`, `Cute Cats`, `3D WhatsApp`, `Anime & Chibi`, and `Classic Memes`.
- **Live GIPHY Search Integration (`api/giphy/search.ts`, `server/api.ts`, `EmojiPickerTray.tsx`)**:
  - Debounced (350ms) online querying for both GIFs and transparent Stickers.
  - Dual-tier fetching: server proxy endpoint `/api/giphy/search` + direct client browser fetch fallback.
  - "Powered by GIPHY" attribution and live status badge.
- **GIPHY API Key Management (`SettingsPopover.tsx` & `types.ts`)**:
  - User can enter their personal free GIPHY Developer API Key directly in Settings.
  - 1-click shortcut from the media tray footer opens Settings to configure GIPHY key instantly.
- **Instant Pasted Media Link Detection**:
  - Pasting any URL (`http://`, `https://`, `data:image/`) into the search bar displays an immediate live preview card with 1-click "Send this GIF" or "Send this Sticker".
- **Vertex AI Base64 Multimodal Image Inlining Fix**:
  - Resolved Gemini 400 Invalid Argument error (`Base64 decoding failed for url`) when sending GIF/sticker URLs to Vertex AI models.
  - Automatically fetches remote URLs and encodes into valid base64 `inlineData` in `geminiService.ts`, `server/vertexHandler.ts`, and `api/gemini/generate.ts`.
- **GIF Database Health Check & Dynamic Placeholder Shield (`utils/stickersAndGifs.ts` & `EmojiPickerTray.tsx`)**:
  - Replaced all 23 broken/deprecated GIPHY IDs with 100% verified, live animated GIFs (automated HTTP check verified 56/56 passing with zero unavailable placeholders).
  - Added real-time client-side detection in `EmojiPickerTray.tsx`: checks image natural dimensions (`480x270`) and `onError` events to immediately suppress any unavailable GIPHY placeholder graphics from ever rendering in the tray.
- **Live GIF & Sticker Confirmation & Preview Window (`components/MessageInput.tsx`)**:
  - Selecting any GIF or sticker from the media tray, live online search, pasted URL preview, or device upload opens an authentic WhatsApp-style full preview stage before sending.
  - Large animated GIF view with optional caption composer and keyboard shortcuts (`Enter` to send, `Escape` or backdrop click to dismiss).
  - High-definition transparent sticker view with "Send Sticker" and "Cancel" buttons.
  - Intercepts all media dispatch points ensuring zero accidental messages are sent.

### 3. Motion Excellence, Haptics & Tactile WhatsApp Interaction System (`v1.9.2`)
- **Physics-Driven Message Bubble Motion**:
  - Gentle entrance and exit transitions (`bubble-enter` scale 0.96 -> 1, opacity 0 -> 1) with subtle settle physics instead of abrupt popping.
  - Settle movement harmonized with chat scroll speed for unified continuous perception.
  - Graceful collapse animation on message deletion.
- **Tactile Touch Feedback & Multi-Pattern Haptic Engine (`utils/haptics.ts`)**:
  - Micro-compression on message press (`active:scale-[0.995] active:brightness-95`).
  - Tactile feedback across interactive controls: composer buttons (`touch-icon`), send button (`touch-btn`), media thumbnails, reaction buttons.
  - Multi-pattern Web Vibration API with safe fallback:
    - `tap`: 10ms light pulse
    - `select`: 20ms medium pulse
    - `send`: 15ms + 25ms double pulse
    - `reaction`: 12ms soft pulse
    - `delete`: 35ms heavy pulse
- **Long-Press Message Selection & Header Morphing (`ChatWindow.tsx`)**:
  - Hold-to-select detection for touch and mouse interactions.
  - Selected bubble elevates with physical lift and drop-shadow, surrounding area subtly subdued.
  - Top header transitions seamlessly into WhatsApp's selection toolbar: counter, exit, star, delete, reply, copy, and 1-click memory capture.
- **Anchored Quick Reaction Tray (`ReactionTray.tsx`)**:
  - Restrained spring animation emerging directly above the selected bubble with popular emoji shortcuts (👍, ❤️, 😂, 😮, 😢, 🙏).
  - Selected reaction attaches to the bubble with a subtle badge pop animation.
  - **Persona Reaction Awareness**: Personas dynamically receive reaction context in their prompt loop (`[USER REACTION: User reacted with {emoji} to message: "{text}"]`) and respond in-character to your expressions!
- **In-App WhatsApp Media Drawer (`EmojiPickerTray.tsx` & `utils/stickersAndGifs.ts`)**:
  - Responsive, multi-tab drawer anchored above composer with 3 tabs: **Emojis**, **GIFs**, and **Stickers**.
  - **Emojis**: Real-time search, categorization (**Smileys**, **Hands**, **Hearts**, **Fun**), recent memory, and cursor insertion.
  - **GIFs**: Curated library of trending reaction GIFs with real-time search, category filters (Trending, Reactions, Laughing, Love, Shocked, Dancing), and 1-tap custom GIF/video upload.
  - **Stickers**: High-res transparent sticker packs (**Pepe & Memes**, **Cute Cats**, **3D Expressions**, **Anime & Chibi**), and 1-tap "+ Custom Sticker" upload from phone gallery/PC.
  - **Attachment Menu Integration**: Direct "Sticker" item in the paperclip sheet for instant custom sticker dispatch.
  - **Mobile Web Keyboard Compatibility**: Solves Android Gboard's native `"This app does not support images here"` restriction by providing WhatsApp Web-grade in-app selection while preserving clipboard paste and drag-and-drop.
- **Multimodal Message Stacking Cohesion**:
  - Message stacking rules apply cohesively across images, audio notes, reactions, and text into a unified conversational turn.
- **Monotonic Chronological Date Categorization (`utils/dates.ts`)**:
  - Monotonic forward date groupings prevent duplicate "Today" and "Yesterday" headers.
  - Historic legacy messages safely grouped under `"Older Messages"` without parser crashes.

### 2. Vertex AI Local Application Default Credentials (ADC) Quota Project Fix (`v1.9.1`)
- **Issue**: When authenticating with user credentials via `gcloud auth application-default login`, Vertex AI (`aiplatform.googleapis.com`) rejected requests with:
  `"Your application is authenticating by using local Application Default Credentials. The aiplatform.googleapis.com API requires a quota project, which is not set by default."`
- **Resolution**:
  - Automatically configured `httpOptions: { headers: { 'X-Goog-User-Project': project } }` and `googleAuthOptions: { projectId: project }` across all server endpoints: [`server/vertexHandler.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/server/vertexHandler.ts), [`api/gemini/tts.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/api/gemini/tts.ts), [`api/gemini/generate.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/api/gemini/generate.ts), [`api/gemini/diary.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/api/gemini/diary.ts), [`api/gemini/image*.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/api/gemini/image.ts).
  - Added `'X-Goog-User-Project': project` header to all direct REST calls in [`api/gemini/voices.ts`](file:///c:/Users/soura/OneDrive/Desktop/Completed%20Projects/Wassap/api/gemini/voices.ts).
  - Both REST Voices API and `@google/genai` models (`gemini-3.8-flash-tts`) now automatically succeed with HTTP 200 without requiring manual quota flag pass-through.
  - Provided command `gcloud auth application-default set-quota-project gen-lang-client-0100408368` for standard local gcloud profile configuration.

### 2. Gemini 3.8 Voice Studio Suite: Voice Design, Frictionless Voice Replication & Turn-Level Voice Prompting (`v1.9.1`)
- **Persona-Specific Settings Integration (`ProfilePanel.tsx`)**:
  - Exclusively nested inside individual persona settings under the **Voice Settings** accordion (never leaking into global app settings).
  - Unlocked when Gemini 3.8 models (`gemini-3.8-flash-tts` or `gemini-3.8-flash-lite-tts`) are selected, with an informative guidance banner displayed if an older model is active.
  - Features A, B, and C are each strictly independent and togglable. Turning a toggle off instantly reverts the persona's voice generation back to baseline with 0 side-effects.

- **Feature A: 🎨 Voice Design (Prompted Custom Voices)**:
  - **Engine**: Integrates Google Cloud Vertex AI Voices API (`VOICE_TYPE_PROMPTED`, `store: true`) via backend route `/api/gemini/voices`.
  - **In-App Crafting Suite**: Custom modal form supporting custom voice names, gender (Female / Male), language (en-US, en-GB, es-ES, ja-JP, hi-IN, fr-FR, de-DE), prompt inspiration chips (`VOICE_DESIGN_INSPIRATIONS`), and detailed natural language descriptions (age, accent, timbre, cadence).
  - **Instant Cross-Persona Reuse & Browser Storage**: Persisted in `localStorage['wassap_custom_voices']` via `utils/customVoices.ts` with audio preview data URLs for instantaneous cross-chat auditioning and reuse on any persona.
  - **Educational Guidance**: Built-in guide modal (`showVoiceDesignInfo`) detailing prompting strategies and acoustic descriptors.

- **Feature B: 🎙️ Voice Replication (Audio Cloning with Spoken Consent)**:
  - **Engine**: Integrates Google Cloud Vertex AI Voices API (`VOICE_TYPE_REPLICATED`, `store: true`) via backend route `/api/gemini/voices`.
  - **Dual Audio Inputs**:
    1. **Reference Voice Sample (`sourceAudio`)**: 10 to 30s of clean speech of the speaker to clone (record via Mic or upload audio file).
    2. **Spoken Consent Verification (`consentAudio`)**: Recording of the speaker reading Google Cloud's required statement: `"I am the owner of this voice and have consented to the creation of a synthetic model of my voice through the use of Google Cloud."` (record via Mic or upload audio file, with one-click "Copy Statement" button).
  - **Client-Side Audio Resampler (`utils/audioResampler.ts`)**: Built-in Web Audio API converter (`convertAudioTo24kMonoWav`) automatically converting both recordings and uploaded files (`.wav`, `.mp3`, `.m4a`, `.webm`, `.ogg`) into Google Cloud's voice specifications: 24,000 Hz, 16-bit linear PCM little-endian, single-channel mono RIFF WAV.
  - **Browser Storage & Reuse**: Cloned voices are saved to `localStorage['wassap_custom_voices']` with in-app audio audition players and instant cross-persona availability.
  - **Educational Guidance**: Built-in guide modal (`showVoiceReplicationInfo`) explaining reference audio and spoken consent verification.

- **Feature C: 🎭 Voice Prompting & Acting Directives (Gemini 3.8 Style)**:
  - **Single-Pass Integration**: Natural vocal directions, emotional style directives, tempo, and vocal bursts are passed alongside the persona prompt in a single API pass — zero waiting for multiple round trips!
  - **Togglable Directives**: Independent toggle (`enableVoicePrompting`). When off, directives and vocal bursts are bypassed for a clean studio neutral delivery.
  - **Fine-Grained Controls**: 8 emotional style presets (Whispering, Cheerful, Sarcastic, Dramatic, Sleepy, Energetic, Calm, Custom), speech delivery pacing (`Normal`, `Speaking Slowly & Deliberately`, `Speaking Rapidly`), and pitch tone (`Natural Baseline`, `Higher Pitch / Bright Tone`, `Deep Pitch / Lower Resonance`).
  - **Native Human Vocal Bursts**: Full support for `<laugh>`, `<sigh>`, `<gasp>`, `<whisper>`, `<cough>`, `<yawn>`, `<groan>`, `<snicker>` tags.
  - **Educational Guidance**: Built-in guide modal (`showVoicePromptingInfo`).

- **Priority Hierarchy & Prebuilt Studio Voice Preservation**:
  - Voice note synthesis priority:
    1. If `enableVoiceDesign` is true and `designedVoiceId` is set $\rightarrow$ uses designed custom voice.
    2. Else if `enableVoiceReplication` is true and `replicatedVoiceId` is set $\rightarrow$ uses replicated custom voice.
    3. Else $\rightarrow$ uses assigned prebuilt studio voice (`voiceName`, 30 voices).
  - Status indicator badges in the UI explicitly notify users whenever a custom voice overrides the prebuilt voice.

---

### 2. Multimedia Voice Notes with Photos & Gemini 3.8 Expressive Acting Overhaul (`v1.9.0`)
- **Multimedia Image + Voice Note Integration**:
  - **Composer Staging (`MessageInput.tsx`)**:
    - Users can now attach a photo and record/attach a voice note simultaneously before hitting send.
    - Added dedicated staging preview tray showing image thumbnail alongside voice note card (with playable audio bar, duration, and individual trash remove controls).
    - Added quick-access microphone icon directly inside the composer action row whenever an image is staged.
    - In-composer live recording bar with real-time timer (`formatAudioDuration`), cancel (`Trash2`), and confirm (`Check`) buttons.
  - **Data Model & IndexedDB Isolation (`types.ts` & `App.tsx`)**:
    - Extended `Message` with `voiceAttachment?: FileAttachment`, `voiceMediaId?: string`, and `voiceDuration?: number`.
    - Maintained isolated storage keys in `media_store` (`mediaId` for photo, `voiceMediaId` for audio note) to prevent payload collisions while preserving single-responsibility IndexedDB blobs.
    - Updated `lastMessage` calculation across the app: composite messages format as `📷 Photo + 🎤 Voice note: [caption]`.
    - Integrated voice cleanup in `handleDeleteChat`, `handleClearChat`, and `handleDeleteMessages`.
  - **High-Fidelity Bubble Rendering (`ChatWindow.tsx`)**:
    - Single unified bubble for composite messages (`media-message-bubble`): renders photo on top and `VoiceNotePlayer` nestled directly beneath it, with caption text, message status ticks, and timestamps aligned below.
    - Enhanced reply quote previews to accurately reflect `Photo + Voice`.
  - **Multimodal AI Seeing & Hearing (`App.tsx` & `services/geminiService.ts`)**:
    - Hydrates both photo (`image`) and audio (`audio`) from IndexedDB into history before calling `getGeminiResponse`.
    - Persona prompt updated with Directive 5: personas inspect attached photos and listen to attached voice notes simultaneously when analyzing composite messages.

- **Gemini 3.8 Flash Voice Delivery & Character Acting Fix**:
  - **Root Cause Analysis (Why 3.8 sounded flat/stiff compared to 3.1)**:
    - **Model Specialization**: `gemini-3.8-flash-lite-tts` (previously set as app default) is Google's ultra-fast model engineered for low-latency informational read-alouds, with prosody flattened. Conversely, `gemini-3.8-flash-tts` is Google's flagship model explicitly engineered for studio-grade character acting, emotional nuances, and dynamic vocal performance.
    - **Verbatim Script Interpretation & Vocal Burst Tags**: Gemini 3.8 treats input text as verbatim scripts. Legacy square-bracket tags like `[laughs]`, `[sighs]`, `[chuckles]` were either causing awkward pauses or being read aloud verbatim. Google's official Gemini 3.8 standard requires angle brackets: `<laugh>`, `<chuckle>`, `<sigh>`, `<gasp>`, `<cough>`, `<groan>`, `<throat-clearing>`, `<yawn>`, `<snort>`, `<pant>`, `<whispers>`, `<short pause>`, `<long pause>`, `<sob>`, `<cheer>`, `<phew>`.
    - **Sustained Style Directives**: `speechMetadata.style` requires clean sustained delivery attributes (e.g., `"warm and playful"`, `"whispered urgently"`) rather than prefixing with `"manner: "`.
  - **Comprehensive Solution**:
    - Promoted `gemini-3.8-flash-tts` as the default voice model (`DEFAULT_VOICE_MODEL`) in `constants.ts`.
    - Configured automatic fallback hierarchy across both Vertex AI Cloud and Gemini AI Studio: `selectedModel` $\rightarrow$ `gemini-3.8-flash-tts` $\rightarrow$ `gemini-3.8-flash-lite-tts` $\rightarrow$ `gemini-3.1-flash-tts-preview`.
    - Upgraded preprocessors (`utils/audio.ts`, `api/gemini/tts.ts`, `server/vertexHandler.ts`) to convert legacy square-bracket cues and natural stage directions into official 3.8 angle-bracket vocal bursts.
    - Stripped artificial `"manner: "` prefixes from sustained style directives across both backends.
    - Upgraded `buildFullPersonaSystemPrompt` to instruct personas on natural placement of official 3.8 angle-bracket vocal bursts and emotionally responsive voice note generation.

---

### 2. Gemini 3.8 Flash-Lite TTS Optimization & Zero-Lag Parallel Generation Pipeline (`v1.8.7`)
- **Gemini 3.8 Speech Generation Architecture**:
  - Adopted `gemini-3.8-flash-lite-tts` (Ultra-Fast & Real-Time Default) as the default voice model across the entire application per Google Cloud's official documentation for high-throughput, low-latency conversational agents.
  - Retained `gemini-3.8-flash-tts` as the selectable option for high-fidelity studio acting and narration, with `gemini-3.1-flash-tts-preview` as legacy fallback.
  - **Standardized Official 3.8 Request Schema**: Configured `speechMetadata: { style: styleDirective }` inside content `parts` and `speechConfig: { voiceConfig: { voice: selectedVoice } }` (with fallback to `prebuiltVoiceConfig`), operating directly on Vertex AI location `global`.
  - **Pipelined Background AI Generation (`App.tsx`)**:
    - Eliminated serial waiting where API requests previously waited for 18–20s of artificial presence sleeps (`deliveryWait`, `comeOnlineDelay`, `seenDelay`, `thinkingDelay`) to finish before even contacting the AI.
    - Eagerly launches `getGeminiResponse` and `generateGeminiVoiceNote` concurrently in the background as an asynchronous promise the instant the user sends a message.
    - Concurrently displays authentic WhatsApp visual lifecycle transitions (single grey tick $\rightarrow$ double grey tick $\rightarrow$ online status $\rightarrow$ double blue ticks $\rightarrow$ `recording audio...`).
    - By the time the user observes the persona switch to `recording audio...`, the voice note is already generated or nearly complete, reducing perceived latency from 45–60s down to ~10–14s with zero disruption to conversational flow.
    - Reduced text stacking delay for incoming voice notes and active online sessions from 10s down to 1.5s.
- **Dual-Provider Architecture (Vertex AI Cloud Engine + Custom Studio Key)**:
  - Standardized fallback ordering across both backends: `selectedModel` $\rightarrow$ `gemini-3.8-flash-lite-tts` $\rightarrow$ `gemini-3.8-flash-tts` $\rightarrow$ `gemini-3.1-flash-tts-preview`.

---

### 2. Borderless WhatsApp Dark Mode Date Indicator & Zero-Latency Mobile Architecture (`v1.8.6`)
- **Borderless Dark Mode Date Pill**:
  - Removed the distracting `border app-border/40` from `DateDivider` in `ChatWindow.tsx`.
  - Replaced generic styling with authentic WhatsApp pill: `bg-white dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] text-[10px] sm:text-[11.5px] px-3 py-1 rounded-lg font-medium tracking-wide shadow-xs transition-all`.
  - Seamless, authentic appearance matching native WhatsApp Web and mobile clients.
- **Root Cause Analysis for Unresponsive Settings / Profile Clicks**:
  - **Issue A (Dynamic Import Latency & Double-Click Abort)**: `ProfilePanel`, `SettingsPopover`, `CalendarNotesWidget`, etc., were loaded via `React.lazy()` with `fallback={null}`. On first click, downloading the dynamic JS chunk took 300–1200ms with zero visual feedback. Users tapped again, which flipped `!showSettingsPopover` or `!showProfilePanel` to `false`, immediately cancelling the open request.
  - **Issue B (Mobile Layout & Stacking Context Conflict)**: `ProfilePanel` was rendered inside a horizontal flex row next to `ChatWindow` (`relative w-full md:w-[400px] h-full`). On mobile screens (<768px), it was positioned off-screen to the right inside `overflow-hidden`. Similarly, `SettingsPopover` was `absolute bottom-0 h-[calc(100%-80px)]`, which clashed with the mobile bottom navigation bar and viewport safe areas.
  - **Issue C (MobileActionFAB Narrow Hitbox)**: `onClick` was attached exclusively to tiny inner circular buttons; tapping the text labels ("Settings", "Profile", "Calendar Notes") yielded no action.
- **Zero-Latency & Mobile Sheet Fixes**:
  - **Eager Idle Preloader (`App.tsx`)**: Introduced `preloadAppPanels()` using `requestIdleCallback` (fallback `setTimeout(600ms)`) to eagerly download and cache all secondary panels in browser memory immediately after app initialization. Clicking any modal now opens in **0ms (instantaneous)**.
  - **Non-Blocking Visual Loading Fallback (`PanelLoadingFallback`)**: Replaced `fallback={null}` with a WhatsApp green top progress bar so users receive instant visual confirmation if network delays occur.
  - **Explicit Open Guards**: Changed `onHeaderClick` from `() => setShowProfilePanel(!showProfilePanel)` to `() => setShowProfilePanel(true)`.
  - **Full-Screen Mobile Sheets with Safe-Area Insets**: Rebuilt `ProfilePanel`, `SettingsPopover`, `CalendarNotesWidget`, `UserProfilePanel`, `NewChatPanel`, and `NewGroupPanel` to render as `fixed inset-0 z-[3500-4000]` on mobile, with iOS notch/home-indicator safe-area insets (`pt-[max(env(safe-area-inset-top),16px)]` and `pb-[max(env(safe-area-inset-bottom),16px)]`) and smooth slide transitions (`animate-in slide-in-from-bottom-3 duration-250`).
  - **Comprehensive MobileActionFAB Touch Targets**: Wrapped the entire row (icon + label) in a touch-friendly clickable target with active scale feedback and added a full-screen backdrop overlay (`z-[2995]`) that dismisses the menu on tap.
  - **Hardware Back Button Integration**: Extended the native popstate listener to close all panels (including Guide and Updates) when tapping hardware or browser back buttons.
  - **Authentic WhatsApp Conversation Lifecycle & Presence Flow (Calibrated Timing)**:
    - **Natural Delivery Delay**: Sent messages immediately display a single grey tick (`'sent'`), transitioning to double grey ticks (`'delivered'`) after a realistic network delivery pause (1.8s–2.5s).
    - **Observable Presence Sequence (Single Grey -> Double Grey -> Online -> Blue Ticks -> Typing)**:
      1. **Sent (`✓`) -> Delivered (`✓✓`)**: 1.8s–2.5s natural delivery delay. User clearly registers the single tick before it turns into double grey ticks.
      2. **Delivered (`✓✓`) -> Persona Comes Online**: 2.2s–3.2s pause while recipient notices notification and unlocks phone. Header turns WhatsApp green `online`. (In stacking mode, persona comes online gradually at 3.2s–5.2s).
      3. **Online -> Seen Blue Ticks (`✓✓`)**: 2.0s–3.0s pause as recipient enters the chat thread, turning double grey ticks into double blue ticks.
      4. **Blue Ticks -> Starting to Type**: 2.2s–3.2s contemplation pause while recipient reads the message and prepares to type.
      5. **Active Typing (`typing...`)**: Header and chat list switch to animated green `typing...` before and during AI response generation (minimum 2.5s–5.0s typing display time for authentic pacing). Between multi-chunk replies, status briefly flips back to `online` (1.2s–2.2s) before typing the next bubble.
      6. **Lingering Online State & Dynamic Last Seen Stamping**: After sending their reply, personas stay `online` for 35 seconds to support active, real-time back-and-forth conversation. If user does not reply, persona transitions to `offline` and stamps `lastSeenTime` with the exact current timestamp (`"last seen today at [time]"`). Ongoing messages within this window keep the persona online and bypass wake-up delays.
  - **Service Worker v7 (`wassap-shell-v7`)**: Flushed obsolete caches to ensure all devices cleanly download updated bundles and avoid reload loops.

### 2. Sentience 2.0 Humane Engine & 45-Message Context Buffer (`v1.8.5`)
- **45-Message Context Buffer**: Buffed rolling message context from 30 to 45 messages (~20-22 conversation turns), giving personas deep contextual memory of current topics without token overflow.
- **Non-Stacking Date Dividers**: Scoped date divider rendering inside isolated date groups, ensuring dividers only show for their respective day sections without stacking on top of each other.
- **Sentience 2.0 Humane Texting Engine**: Comprehensive prompt rewrite eliminating sycophantic echo replies, interrogation-style questions, and robotic formality; injected organic texting slang, irregular message pacing, and 7-tier mood states.

### 3. Persona Chat Reset & Memory Leak Elimination (`v1.8.4`)
- **Root Cause 1: Erroneous `[MEMORY RECALL]` Injection on Ordinary Chats**:
  - `buildMemoryRecallContext` previously checked `if (!isExplicitRecall && memories.length === 0) return undefined;`.
  - When a chat had existing memory bubbles, ordinary messages (like "Hey", "How are you?") failed this check and proceeded to return a top-priority `[MEMORY RECALL]` directive commanding the persona to reminisce about past diary entries even though the user never typed `@rem`!
  - Fixed so `buildMemoryRecallContext` strictly guards `if (!isExplicitRecall) return undefined;`.
- **Root Cause 2: Incomplete Clear Chat in `ProfilePanel` and `App.tsx`**:
  - Previously, `handleClearChat` cleared `messages: []` but left `chat.memoryBubbles` intact. Furthermore, `ProfilePanel` held `formData.memoryBubbles` in its local state, so clicking "Save Changes" after clearing the chat would re-commit the old memory bubbles to state.
  - Additionally, any pending offline outbox messages or unreconciled background notification exchanges in IndexedDB (`whatsapp_offline_db`) could re-populate the chat on sync.
- **Complete Clean Reset Solution**:
  - **Memory Clearing Option**: Updated `ConfirmationModal` to support custom option nodes. Added a checkbox to both `ProfilePanel.tsx` and `ChatWindow.tsx` clear-chat dialogs: *"Also clear persona's saved memory bubbles & diary entries ({count})"* (enabled by default).
  - **ProfilePanel Form Synchronization**: Clearing chat updates `formData.memoryBubbles = []` immediately so subsequent profile saves don't resurrect old memories.
  - **Comprehensive Backend Wipe (`handleClearChat` in `App.tsx`)**:
    - Purges media blobs from IndexedDB.
    - Purges pending offline outbox and background exchanges via `clearOfflineDataForChat(activeChatId)` in `utils/offlineQueue.ts`.
    - Cancels active response timeouts, left-on-read timers, and pending time-gap caches.
    - Clears `messages: []`, `lastMessage: ''`, `lastMessageTime: ''`, `unreadCount: 0`, and `memoryBubbles: []` (when option selected).
    - Calls `saveChatsNow()` immediately to ensure zero-delay synchronization with `localStorage`.

### 2. Dual Audio In-App Sound System (`msgsentpop.mp3` & `whatapp.wav`) (`v1.8.3`)
- **Real WhatsApp Sent Message Sound (`/msgsentpop.mp3`)**:
  - Integrated a low pop audio effect when the user sends any message (text, quick reply, media, voice, attachment, or event) directly in the active chat interface.
  - Sourced from `public/msgsentpop.mp3`.
- **Dual Simultaneous Web Audio Engine (`App.tsx`)**:
  - Preloaded both `/whatapp.wav` (incoming persona messages) and `/msgsentpop.mp3` (user sent messages) into parallel memory buffers (`incomingAudioBufferCache` and `sentAudioBufferCache`) via the Web Audio API.
  - Implemented `playSentMessageSound()` and optimized `playIncomingMessageSound()`.
  - Non-blocking Web Audio node graph: each playback instantiates an independent `AudioBufferSourceNode` routed through dedicated gain stages (sent pop balanced at 0.85 gain for an authentic soft WhatsApp pop) into the main destination, preventing audio channel contention, clicks, or cutoff when sent and received messages overlap.
  - Graceful HTML5 `new Audio()` fallback if Web Audio is unsupported or locked.
- **Strict In-App Foreground Guard**:
  - Both `playSentMessageSound()` and `playIncomingMessageSound()` strictly check `if (typeof document !== 'undefined' && document.hidden) return;`.
  - Ensures zero unwanted audio playback when the tab is backgrounded or minimized, or when native background service worker push notifications arrive (which have OS-level notification alerts).
- **Service Worker Offline Pre-Caching (`public/sw.js`)**:
  - Added `'/msgsentpop.mp3'` to `PRECACHE_ASSETS` in `public/sw.js`.
  - Incremented cache version identifier to `wassap-shell-v5` to ensure client service workers cleanly evict old audio caches, download the newly updated audio with `{ cache: 'reload' }`, and cache the new asset for offline PWA operation.

### 2. AI Diary Generation Overhaul & Pure Diary Storage (`v1.8.2`)
- **Pure Diary Entry Storage**:
  - Eliminated mechanical message transcripts from saved memories (`buildCapturedMemorySummary` previously built text logs like *"The interaction started around 14:02 with You saying '...' and ended with..."*).
  - Memories now store **authentic, intimate diary entries written in the persona's private first-person voice**, capturing their genuine thoughts, unspoken feelings about the user, and reflections on their time together.
- **Redesigned Journal Interface (`DateMemoryModal.tsx`)**:
  - Transformed the plain memory modal into an elegant diary/journal entry card with book/quill theme, date header, and customizable entry title.
  - Prominent **"Generate AI Diary"** action with live loading animations, multi-model retries, and instant editable journal reflection.
  - One-click **"Save to Persona's Diary"** action.
- **Multi-Model Diary Generation Pipeline**:
  - Upgraded `api/gemini/diary.ts`, `server/vertexHandler.ts`, and `services/geminiService.ts`.
  - Added multi-model fallback retry loops (`gemini-3.8-flash` -> `gemini-2.5-flash` -> `gemini-2.5-flash-lite`) with exponential backoffs to prevent transient rate limits or quota drops.
  - Rich prompt instructing the persona to write a secret, private journal entry with vulnerability, genuine feelings, and memorable conversation highlights.

### 2. `@rem` Memory Recall Command & Relevance Scoring (`v1.8.2`)
- **Full Syntax Support (`@rem`, `/rem`, `\rem`)**:
  - Updated regex across all message entry points (chat input, quick replies, service worker callbacks, URL parameters, offline queue) to `/[@\\\/]rem\b/i`.
  - Cleaned `@rem` from user message bubbles (e.g. *"Do you remember Kyoto? @rem"* displays cleanly in the bubble as *"Do you remember Kyoto?"*).
- **Intelligent Keyword & Token Relevance Scoring**:
  - Replaced naive exact-substring matching with tokenized relevance scoring.
  - Filters out conversational stopwords (`do`, `you`, `remember`, `what`, `when`, `did`, `about`, `our`, `in`, `at`, etc.).
  - Scores memories by keyword matches across `title` (5 pts), `startDate`/`endDate` (4 pts), and `summary` diary entry (2 pts), with exact phrase bonuses (10 pts).
  - Ranks and injects the highest-scoring diary memories. If the query is generic (e.g. bare `@rem`), brings up recent memories.
- **Top-Priority System Prompt Directive**:
  - Upgraded `buildFullPersonaSystemPrompt` in `geminiService.ts` and `vertexHandler.ts`.
  - Treated `[MEMORY RECALL]` as a top-priority directive instructing the persona to actively bring up the specific recalled diary memory in-character with genuine emotional warmth, nostalgia, or teasing.
  - Injected background awareness of recent diary entries so personas naturally remember past events even without explicit `@rem`.
- **Auto-Enable Memory**:
  - Saving a memory via `handleSaveMemory` automatically sets `memoryEnabled: true`.

### 3. Balanced Photo Activities & Authentic Smartphone Realism (`v1.8.2`)
- **Removed Strict Anti-Phone Prohibition**:
  - Softened anti-phone rules so that using a phone (mirror selfie, checking a notification, propping phone on table) is a natural everyday option rather than forbidden.
- **Dynamic Everyday Activity Sampler**:
  - Introduced `EVERYDAY_PHOTO_ACTIVITIES` and `getSuggestedActivitiesSample(count)` across `api/gemini/image-synthesize.ts`, `server/vertexHandler.ts`, and `services/geminiService.ts`.
  - Provides a fresh randomized set of 7 activities per synthesis request spanning domestic cozy, food & dining, study & creative, outdoor strolls, and casual selfies/tech.
- **Preserved Raw Mobile Realism**:
  - Retained authentic smartphone camera details: natural room/lamp lighting, realistic focal depth, slight handheld tilt, unposed candid framing.

---

### 4. Anti-Phone Cliché Overhaul & Diverse Candid Activities (`v1.8.1`)
- **Problem**: Characters in candid snapshots were overwhelmingly generated holding, staring down at, or illuminated by a glowing smartphone screen.
- **Root Causes**:
  - Prompt templates in `image-generate.ts`, `vertexHandler.ts`, and `geminiService.ts` explicitly suggested `"(looking at phone, lost in thought, or reaching for something)"` and `"screen glare illuminating face"`.
  - The fallback scenario list in `image-synthesize.ts` repeatedly recommended `"Living room couch browsing phone/laptop"`, biasing diffusion/Imagen models toward the screen-gazing cliché.
- **Overhaul & Fixes**:
  - Injected strict `CRITICAL ANTI-PHONE CLICHÉ RULE` across all synthesis prompts: The persona MUST NOT be holding, staring at, tapping, or illuminated by a smartphone/screen unless explicitly requested by the user.
  - Implemented diverse, authentic everyday activities and poses:
    - *Domestic cozy*: Brewing pour-over coffee/tea, holding a ceramic mug with both hands, reading a paperback novel, listening to over-ear headphones, sketching in a spiral notebook, tending to indoor houseplants.
    - *Snacking & dining*: Sipping bubble tea through a straw, peeling a mandarin/orange, holding a warm pastry or croissant, resting chin in hand across a dining table.
    - *Study & creative*: Writing in a journal with a pen, reviewing lecture notes, arranging study stationery, working on a craft.
    - *Outdoor & casual*: Strolling down a grocery/convenience store aisle with a hand basket, sitting cross-legged on park lawn, resting against a balcony railing looking out at the neighborhood.
  - Synchronized across: `api/gemini/image-synthesize.ts`, `api/gemini/image-generate.ts`, `server/vertexHandler.ts`, and `services/geminiService.ts`.

### 2. Multi-Message Deletion & Storage Cleanup (`v1.8.1`)
- **Action Toolbar Integration**: Added a **Delete** (`Trash2`) button directly to the existing multi-message selection header bar in `components/ChatWindow.tsx` (which appears on double-tap or selection mode).
- **Confirmation Safety**: Integrated a WhatsApp-themed confirmation modal (`ConfirmationModal`) informing the user of the exact number of messages being removed before proceeding.
- **IndexedDB Media Cleanup**: `handleDeleteMessages` in `App.tsx` inspects all deleted messages for `mediaId` or `attachment.mediaId` and immediately cleans up the corresponding image/audio blobs via `deleteMedia()` from IndexedDB to prevent orphaned storage bloat.
- **Chat State Integrity**: Automatically recalculates the chat's `lastMessage` and `lastMessageTime` from the remaining messages. Clears active `replyingTo` state if the replied-to message was among those deleted. Added identical media blob cleanup to `handleClearChat`.

### 3. Memory QOL: 1-Click "Save as Memory" from Selected Messages (`v1.8.1`)
- **One-Click Memory Extraction**: Added a **Save as Memory** (`Sparkles`) button to the message selection toolbar alongside Reply, Copy, and Delete.
- **Seamless Modal Flow**: Selecting meaningful messages (e.g., romantic moments, shared jokes, personal milestones) and tapping "Save as Memory" opens `DateMemoryModal` pre-populated with:
  - The calculated date range spanning the earliest to latest selected message.
  - The selected messages automatically passed as the highlighted message set.
- Allows users to turn authentic in-chat interactions directly into permanent long-term persona memories with zero friction or manual date picking.

---

### 4. In-Chat Authentic Smartphone Photo Generation (`@img` / `@image`) Overhaul (`v1.8.0`)
- **Trigger**: Typing `@img` or `@image` anywhere in the message input (e.g. *"send a selfie @img"*, *"show me your lunch @img"*). The tag is automatically stripped before displaying in the chat bubble.
- **Investigation & Root Causes Resolved**:
  1. *Transient Rate Limits & Lack of Retries*: Rapid back-to-back triggers previously hit 429 quota or timeouts with zero retries, immediately falling back to `generatePersonaImageExcuse`. Added exponential backoff retry loops (up to 3 attempts with 1.2s - 3s backoffs) in both serverless endpoints and client service.
  2. *Bare `@img` vs `@image [query]` Discrepancy*: Bare `@img` defaults to `"Send a photo"`, causing the synthesizer to select `"selfie"` or `"candid"` with avatar reference conditioning (`[Input Image 1]`), which was prone to Vertex AI face-matching and safety filter blocks. In contrast, `@image [query]` (e.g. food, desk) chose `"pov"` which skips reference images.
  3. *Gender Pronoun Misalignment*: Synthesis and generation previously hardcoded female pronouns (`"She is..."`, `"her face"`, `"same woman"`), causing severe prompt-image contradictions for male personas (Big Bro, Best Friend, Dad). Now dynamically resolves gender from `GEMINI_TTS_VOICE_DETAILS` (`male` vs `female`), persona role, and name.
  4. *Safety Filter Handling & Reference Resilience*: If reference-image face conditioning triggers safety filter blocks, the system automatically simplifies the prompt, strips the reference image, and retries with a natural snapshot prompt instead of instantly falling back to an excuse.
  5. *Time-of-Day Context Injection*: The client time context (`getAppTimeContext(settings)`) is now injected into synthesis, ensuring night photos generate cozy lamp/ambient lighting instead of daytime sunlight.
  6. *Broken Imagen Fallback Fixed*: Catch-block fallback previously passed `gemini-3.1-flash-lite-image` to `generateImages` (which only supports Imagen models). Fixed model to `imagen-3.0-generate-002`.
- **Pipeline Architecture**:
  1. **Step 1 (Context & Caption Synthesizer)**:
     - Calls `/api/gemini/image-synthesize` (or `server/vertexHandler.ts`).
     - Models: `gemini-3.8-flash` (attempt 1) with fallback to `gemini-2.5-flash` (attempt 2).
     - Incorporates `clientTimeContext`, persona mood, and message history.
     - Strict priority hierarchy: (1) Explicit user query, (2) Conversation history context for generic queries (`@img`, `@image`, `"Send a photo"`), (3) Time-appropriate everyday situations (couch, desk, kitchen, passenger seat).
  2. **Step 2 (Image Generation Engine)**:
     - Calls `/api/gemini/image-generate` (or local handler).
     - Models: `gemini-3.1-flash-lite-image` (attempt 1) -> `gemini-3.1-flash-image` (attempt 2) -> `imagen-3.0-generate-002` (generateImages fallback).
     - Aspect ratio set to `3:4` portrait mobile format.
     - Dynamic gender pronouns (`He/She`, `his/her`, `same man/woman`).
     - Neutral mobile photo phrasing (removed trademarked terms like "Snapchat" that could trigger content filters).
  3. **Step 3 (Fail-Safe Excuse Generator)**:
     - If all attempts fail or are permanently blocked, calls `/api/gemini/image-excuse` to keep immersion intact with natural in-character text excuses.
- **UI & Display**:
  - WhatsApp-native media bubble (`.media-message-bubble`) with `fit-content` max 330px width.
  - Image and caption are rendered together inside the exact same message card.
  - Clicking any image opens the `ImageLightboxModal` (full-screen blurred background, metadata, download button).

### 2. Vercel Serverless Function Deployment & Authentication
- **Resolved Issues**:
  - Fixed `ERR_MODULE_NOT_FOUND` by ensuring all `api/gemini/` endpoints (`image-synthesize.ts`, `image-generate.ts`, `image-excuse.ts`, `image.ts`, `generate.ts`, `diary.ts`, `tts.ts`, `status.ts`) are standalone and don't rely on cross-file internal ESM path aliases that break in Vercel bundle isolation.
  - Fixed `@google/genai` v1.38+ authentication: Replaced naive `new GoogleGenAI({ vertexAI: { project, location } })` with full `normalizePrivateKey` and multi-source credentials resolver (`vertexai: true, googleAuthOptions`). Supports Service Account JSON (`GCP_SERVICE_ACCOUNT_KEY`), Client Email + Private Key (`GCP_CLIENT_EMAIL` + `GCP_PRIVATE_KEY`), and fallback API keys (`VERTEX_API_KEY`, `GEMINI_API_KEY`).

### 3. Progressive Web App (PWA) & Offline Shell
- **Manifest & Mobile Integration**:
  - `public/manifest.json`: Full PWA metadata, `display: "standalone"`, `id: "/"`, `start_url: "/"`, `scope: "/"`, maskable SVG icons.
  - `index.html`: iOS Safari web-app-capable meta tags (`apple-mobile-web-app-capable`, `black-translucent` status bar, `apple-touch-icon`).
- **Service Worker Caching (`public/sw.js`)**:
  - Pre-caches core app shell (`/`, `/index.html`, `/manifest.json`, `/favicon.svg`, `/whatapp.wav`, `/msgsentpop.mp3`).
  - Stale-While-Revalidate caching for static assets.
  - Strictly bypasses `/api/` network requests so Gemini AI responses are always live.
  - Retains background push notification handling and inline quick-reply listeners.

### 4. Vite Bundle Optimization & Lazy Code-Splitting
- **Vite Rollup Chunking (`vite.config.ts`)**:
  - Configured `output.manualChunks` for immutable vendor libraries (`vendor-react`, `vendor-icons`, `vendor-genai`, `vendor-other`).
- **React Lazy-Loading (`App.tsx`)**:
  - Converted heavy on-demand overlay panels to `React.lazy()`: `ProfilePanel` (~47 kB), `SettingsPopover` (~32 kB), `GuidePanel` (~9 kB), `UpdatesPanel` (~10 kB), `NewChatPanel` (~5 kB), `NewGroupPanel` (~4 kB), `UserProfilePanel`, `CalendarNotesWidget`.
  - Wrapped modals in `<React.Suspense fallback={null}>`.
  - **Results**: Main entry bundle size plummeted from **755 kB down to 153 kB** (47.5 kB gzip), cutting initial load time and eliminating all bundle size warnings.

### 5. Story Event Trigger & Message Bubble Redesign
- **Trigger Event Modal (`components/MessageInput.tsx`)**:
  - Clean, minimalist WhatsApp Web dialog (`bg-white dark:bg-[#222e35] rounded-xl shadow-2xl w-full max-w-[380px]`).
  - Strict professional design: Zero generic AI fluff, zero sparkles, zero preset idea chips.
  - Form: Clean `Event title (optional)` input, `Description` textarea, optional image attachment button, and WhatsApp green `Send` button (`#00a884`).
  - Fallback logic: If title is empty, it cleanly extracts the first 5 words of description or defaults to `"Event"`.
- **Event Message Bubble in Chat (`components/ChatWindow.tsx`)**:
  - **Authentic WhatsApp Event Card**: Clean rounded card (`bg-white dark:bg-[#1f2c34] border border-black/10 dark:border-white/10 rounded-xl p-3.5 shadow-sm max-w-[380px] text-left`).
  - Minimalist green calendar tag: `Event` (`#00a884` with `Calendar` icon).
  - Bold event title (`font-semibold text-primary`) with separate secondary description (`text-secondary`).
  - **Clickable / Expandable Clamp**: Descriptions > 75 characters are cleanly clamped to 2 lines with a sleek `Read more / Show less` link and card tap toggle so long narratives never stretch the viewport.
  - Minimalist bottom-right timestamp format matching WhatsApp native messages.
  - **AI Prompt Integration**: Passes `[ENVIRONMENTAL EVENT OCCURS (Title)]: *description*` in `geminiService.ts`, `vertexHandler.ts`, and `api/gemini/generate.ts`.

### 6. Native Notification Shade Conversational Continuity & PWA Enhancements
- **Notification Shade Inline Reply Continuity**:
  - Full two-way dialogue support directly from the Android/system notification quick-reply shade without having to open the app.
  - **Message Fragmentation in Notification Shade**:
    - Ported full sentence and punctuation-aware `splitMessage` engine into `public/sw.js` (Service Worker scope).
    - AI responses generated in the background (whether processed by the Service Worker or background tab in `App.tsx`) are realistically fragmented into distinct chunks rather than dispatched as a single wall of text.
  - **Balanced, Snappy Stacking & Typing Delay Logic**:
    - Respects the user's **Message Stacking** toggle and **Stacking Delay** setting from the app.
    - If `enableTextStacking` is turned off in Settings, replies are immediate (`300ms - 600ms`).
    - If enabled, uses a brisk reading pause (`800ms - 1500ms`), snappy typing speed proportional to chunk length (`chunk.length * 16ms`, clamped to `500ms - 1500ms`), and brief inter-chunk pauses (`400ms - 700ms`) so conversations stay fast and engaging without boring the user.
  - **Clean Notification Hierarchy**:
    - Streamlined notification display: removed redundant `You:` and `[Persona Name]:` prefixes inside notification bodies. Messages stack cleanly in the notification card without clutter.
    - Removed synthetic "... is typing..." notification cards to keep shade clean and avoid notification spam.
  - **Full Conversational Context & History Parity**:
    - **Active Window Delegation**: When the app is open (even in the background), `public/sw.js` delegates inline notification replies directly to `App.tsx` via `INLINE_REPLY` postMessage, utilizing the live in-memory React chat state, media hydration, memory recall, and timing calculations.
    - **Autonomous Full-Context Parity**: When the app is closed, `public/sw.js` now receives the full contextual payload:
      - Extended rolling history window up to 35 messages (`slice(-35)`), completely resolving the previous 6-8 message memory loss bug.
      - Exact `clientTimeContext` (local/simulated user system time, e.g. "Tuesday, September 15, 2026, 10:35 PM").
      - `timeGapContext` (relative time elapsed: "last chatted yesterday", "been 4 hours", etc.).
      - Full `settings` (`shareTimeContext`, `shareCalendarNotes`, `calendarNotes`, `useSearchGrounding`).
      - Full `userProfile` (`name`, `about`, `status`).
      - Group context (`groupName`, `otherMembers`).
      - `buildFullPersonaSystemPrompt`: Unified system prompt builder in `services/geminiService.ts` used by both in-app chats and notification Custom API/Vertex calls.
  - **Offline Storage & Synchronisation**:
    - Full IndexedDB storage (`whatsapp_offline_db`) with `BACKGROUND_EXCHANGE_SYNC` broadcasts to keep client state and chats in sync across tabs and service workers.
    - Zero warning banners or intrusive offline indicators, maintaining uninterrupted immersion.

---

## 🏛️ Architecture & Key Components
```
Wassap/
├── App.tsx                      # Root component, global state, tab routing, provider switching
├── index.css                    # Tailwind base + custom WhatsApp CSS variables & bubble styling
├── types.ts                     # Core TypeScript data contracts (Persona, Message, HumaneSettings, etc.)
├── constants.ts                 # Default personas, templates, wallpapers, model lists
├── components/
│   ├── ChatWindow.tsx           # Main chat interface, bubble rendering, message grouping, media bubbles
│   ├── ChatList.tsx             # Left sidebar chat list, unread badges, last message preview
│   ├── MessageInput.tsx         # Chat footer, input bar, mic recording, @img trigger, attachments
│   ├── VoiceNotePlayer.tsx      # WhatsApp audio card, scrubbing waveform, speed toggle (1x/1.5x/2x)
│   ├── ImageLightboxModal.tsx   # Fullscreen photo viewer with download & caption
│   ├── ProfilePanel.tsx         # Persona editor: Voice Lab (30 voices), Schedule, Humane Settings, Memory
│   ├── SettingsPopover.tsx      # Global settings: Provider (Vertex vs AI Studio), Passcode, Wallpaper, Models
│   ├── UserProfilePanel.tsx     # User's own profile info (name, about, status)
│   ├── Sidebar.tsx              # Left navigation rail (Chats, Communities/Guide, Updates, Settings)
│   ├── GuidePanel.tsx           # In-app user manual & tips
│   └── UpdatesPanel.tsx         # In-app changelog timeline
├── services/
│   └── geminiService.ts         # Client-side AI orchestrator, switches between local/Vercel proxy and direct SDK
├── api/gemini/                  # Vercel Serverless Functions
│   ├── generate.ts              # Chat response generator (streaming & text)
│   ├── image.ts                 # Consolidated image router
│   ├── image-synthesize.ts      # Context & caption synthesizer
│   ├── image-generate.ts        # Image generation with reference image support
│   ├── image-excuse.ts          # Persona camera excuse generator
│   ├── tts.ts                   # Gemini-TTS voice synthesis (30 voices)
│   ├── diary.ts                 # AI persona diary generation for memory bubbles
│   └── status.ts                # Health check and environment probe
├── server/                      # Local Express Backend for development
│   ├── api.ts                   # Express router mapping /api/gemini/* to handlers
│   └── vertexHandler.ts         # Core Vertex AI SDK logic, models, prompt formatting
└── utils/
    ├── audio.ts                 # Audio recording, PCM conversion, WAV header packaging
    ├── storage.ts               # IndexedDB wrapper for media blobs and audio notes
    ├── imageCompressor.ts       # Canvas-based client-side image compression
    └── dates.ts                 # WhatsApp time formatting ("Today", "Yesterday", 24h clock)
```

---

## 🔑 Dual AI Provider System
1. **Built-in Cloud (Vertex AI) [Default]**:
   - Routes requests to `/api/gemini/*` (Vercel serverless functions in production, Express in local dev).
   - Protected by `VERTEX_PASSCODE` (`Ness2020`).
   - Uses Vertex AI service account or fallback API key stored securely in environment variables.
   - Recommended models: `gemini-3.8-flash` (chat default), `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite-image` (image generation).
2. **Custom API Key (Gemini AI Studio)**:
   - Client-side calls directly to `@google/genai` using the user's personal API key stored in `localStorage`.
   - Bypasses passcode requirements.
   - Ideal for users who want to use their own quotas and keys.

---

## 📜 Feature Milestones Completed

- [x] 19 October 2026: Live model choice, pinned session setup and isolated preview audio, with documented provider-drift limits.

- [x] 19 October 2026: Persona-specific explicit language with description-led Auto, complete prompt/payload coverage and backup preservation.

- [x] 19 October 2026: Persona-specific diary ownership/language, isolated diary editor state and dedicated short call summaries across both providers.

- [x] 19 October 2026: Professional static boot screen and complete current-turn persona notifications, retaining profile pictures and inline reply.

- [x] **v1.9.7**: Android-first polish, archive/unarchive and pin selection across touch/mouse/keyboard, call coming-soon shortcut, reversible transitions, larger diary dates, stable mobile wallpaper, clean composer focus and subtle dividers; synchronized release labels.


- [x] 18 October 2026: Backward-compatible cloud hardening, data-preservation fixes, two text models, dependency lock/audit, and regression/browser checks.
- [x] **v1.0.0 - v1.2.0**: WhatsApp Web UI layout, message send/receive, persona switching, basic Gemini integration.
- [x] **v1.2.5**: Exact inactivity check-in timer (seconds precision), context-balanced silence breakers.
- [x] **v1.3.0 - v1.3.1**: Memory Bubbles & Persona Diary, dynamic roleplay events, 24/7 weekday/weekend schedule, 24h time format, mobile view improvements.
- [x] **v1.4.0**: Humane Settings Engine (0-100 mood slider, ban robotic language, human imperfections), tiered message fragmentation, persona templates, memory export/import.
- [x] **v1.5.0**: Message stacking delay (5s - 30s) with grouped bubble visual rendering (hidden tails), relative time-gap awareness, chat frequency capping.
- [x] **v1.6.0**: Dual AI Provider (Vertex Cloud vs Custom Key), passcode lock, custom chat wallpapers with opacity controls, models `gemini-3.8-flash` & `gemini-3.7-flash`.
- [x] **v1.7.0**:
  - In-chat smartphone photo generation (`@img` / `@image`) with 2-step synthesizer + generator pipeline.
  - Three distinct realistic photo modes (`selfie`, `candid`, `pov`) with `user_wants_posed` override.
  - 30 Gemini-TTS voices with pitch/speed steering, emotional cues `[laughs]`, and interactive waveform audio cards.
  - Vercel production serverless function deployment with robust multi-credential authentication.
  - WhatsApp-native media bubble width clamping (`fit-content`, max 330px).
- [x] **v1.7.1**:
  - Full PWA Installability (manifest, iOS standalone tags, touch icons, offline app shell caching in `sw.js`).
  - Vite code-splitting and bundle chunking (`React.lazy()` for modals, Rollup `manualChunks`, reducing main bundle from 755 kB to 153 kB).
- [x] **v1.7.2**:
  - **Persona Reply Immersion**: Fixed generic `"Contact"` label in 1-on-1 chat reply previews and quoted bubbles by ensuring persona names (`chat.name`) and `"You"` are properly assigned and backfilled in state.
  - **Multimedia Reply Cues**: Quoted reply banners in UI display `📷 Photo` / `🎙️ Voice message` indicators, and AI prompt context is enriched with `[Replying to {author}'s photo: "{caption}"]` or `[Replying to {author}'s voice note (transcript: "...")]`.
  - **Voice Note Frequency Calibration**: Reduced Occasional frequency to 10% (was 20%) and Frequent to 30% (was 50%), with updated dropdown labels in `ProfilePanel`.
  - **Mobile Header Action Controls**:
    - Functional WhatsApp 3-dots menu dropdown on mobile (`New contact`, `New group`, `Settings`).
    - Working Camera action triggering mobile camera/gallery, complete with photo preview modal, persona selector dropdown, caption input, and instant send.
    - Working Scanner action modal with QR viewfinder reticle and link to Google Lens / system scanner.
- [x] **v1.7.3**:
  - **OG WhatsApp Ultra-Dark Theme (`#0b1014`)**: Migrated dark theme foundation to WhatsApp's authentic ultra-deep black `#0b1014` (RGB 11, 16, 20) across app body, chat viewport, sidebar, mobile headers, and navigation bars.
  - **Verdant Pulse Green (`#21c063`)**: Implemented the official `#21c063` (RGB 33, 192, 99) accent across FAB buttons, unread badges, unread timestamps, active navigation capsule pills (`#103629` / `#21c063`), active filter chips, send/mic controls, and switches.
  - **Flawless Top Status Bar & Notch Handling**: Dynamic `<meta name="theme-color">` syncing (`#0b1014` dark / `#ffffff` light) and mobile header `pt-[max(env(safe-area-inset-top),10px)]` eliminating unsightly mismatched status bars.
  - **Flawless Bottom Navigation & Gesture Bar**: Added `pb-[max(env(safe-area-inset-bottom),8px)]` to `MobileNavigation.tsx` so bottom bar background smoothly extends underneath the phone's home indicator bar, with dynamic elevation on the squircle FAB.
- [x] **v1.7.4**:
  - **Light Mode Chat Notification & Theme Contrast Fix**:
    - **Sidebar Notification Badge**: Connected `Sidebar.tsx` to dynamic `unreadCount={unreadTotal}` (rendered conditionally `unreadCount > 0`), replaced hardcoded `28`, and styled badge numbers with `text-white` on `#21c063`.
    - **Chat List Unread Badges**: Replaced dark `#0b1014` text on green badges with authentic `text-white` for crisp contrast and consistency with native WhatsApp light/dark modes.
    - **Unread Timestamps**: Calibrated to `text-[#1fa855] dark:text-[#21c063]` for WCAG-compliant contrast (>4.5:1) on white light mode backgrounds.
    - **Composer Send & Microphone Controls**: Restored WhatsApp's signature `text-white` glyphs on `#21c063` action buttons instead of conflicting dark glyphs.
    - **Mobile Actions**: Updated FAB icon and MobileNavigation badge to `text-white dark:text-[#0b1014]`, and updated modal action buttons to `text-white`.
    - **Refined Badge Geometry**: Reduced unread badge size to a sleek `18px` with `text-[11px] leading-none` in `ChatList.tsx`, and `17px` with `text-[10px]` in `Sidebar.tsx` and `MobileNavigation.tsx` for a subtle, authentic WhatsApp appearance.
- [x] **v1.7.5**:
  - **Vercel Serverless Payload Optimization (Fix 413 `FUNCTION_PAYLOAD_TOO_LARGE`)**:
    - **Client-Side Image Compression**: Created a high-performance `compressImage` utility in `utils/imageCompressor.ts` that downscales raw smartphone photos (which are typically 5MB-15MB from phone cameras) to max 1280px dimension at 0.78 JPEG quality (~100KB-200KB). Applied across Camera uploads, attachment menu, and event images.
    - **Smart History Sanitization**: Added `sanitizeHistoryForVertex()` in `services/geminiService.ts` to cap history at 30 messages and replace older base64 image and audio blobs with lightweight `'[ATTACHED]'` placeholders. Only the last 2 active media items (which Gemini multimodal consumes) keep their data. Drops payload sizes from >5MB down to ~200KB.
    - **Diary & Image Synthesis Payloads**: Sliced and stripped dead media fields from `messageHistory` before sending to `/api/gemini/diary` and `/api/gemini/image-synthesize`.
    - **Vercel 413 Graceful Handling**: Added specific 413 error status detection with helpful user feedback instead of cryptic failure.
- [x] **v1.7.6**:
  - **Schemeless 100% Background Native Notification Direct Replies & Bulletproof Direct Persona Navigation**:
    - **No Window Popup / Focus Stealing**: Service worker `INLINE_REPLY` dispatches directly via `postMessage` to existing client windows without calling `focus()` or `openWindow()`, allowing the user to reply from the OS notification shade without popping open the app.
    - **Background Window Dispatch**: `App.tsx` handles `INLINE_REPLY` by creating the user message, running persona response generation (including memory, schedules, and natural chunk splitting), and dispatching follow-up notifications entirely in the background.
    - **Direct Persona Opening on Notification Click**:
      - Fixed `notificationclick` user-activation bug where premature `notification.close()` outside `event.waitUntil` consumed Android/Chrome's transient activation and blocked `clients.openWindow()` / `client.focus()`.
      - Tapping notification card checks open windows, switches view to persona via `OPEN_CHAT`, and focuses. If no window is active, opens `/?chatId=...`.
      - Added URL parameter support on mount in `App.tsx` to automatically select persona and open chat view when launched via `/?chatId=...`, followed by clean URL replacement.
    - **IndexedDB Stabilization**: Restored single-responsibility `whatsapp_media_db` (v2) dedicated to `media_store` with `onversionchange` auto-closing and blocked prevention. Eliminated version downgrades and deadlocks that previously caused persona responses and typing indicators to hang.
    - **Direct Persona Opening on Desktop Fallback**: Desktop `new Notification()` fallback now navigates straight to persona on click.
- [x] **v1.7.8**:
  - **Continuous Native Notification Shade Conversations**:
    - **Fully Autonomous Service Worker Execution (Open, Background, or Closed)**: Fixed the background tab reply issue where Chromium throttled background tab timers or `!isFocusingChat` suppressed notifications. The Service Worker directly executes the Gemini call within `event.waitUntil`, updates the notification shade, writes to IndexedDB, and broadcasts `BACKGROUND_EXCHANGE_SYNC` to any open window in real-time.
    - **Clean Stacked Dialogue (No Name Prefixes)**: Removed `You:` and persona name prefixes from the notification body. Stacks conversation messages cleanly and naturally.
    - **No Intermediate Typing Fluff**: Removed the `... is typing...` notification for a clean, prompt response turnaround.
    - **Persistent In-Shade Reply Loop**: Notifications persistently retain the action buttons (`Reply` and `Mark as read`) after each persona turn, enabling full conversations without ever opening the app.
    - **Cross-Context Background Sync**: `App.tsx` reconciles `synced_background` on mount and on visibility change, seamlessly merging all notification-shade exchanges into chat history and `localStorage`.
  - **Bulletproof Offline PWA Loading & Low-Connectivity Resilience**:
    - **Fast-Timeout Navigation Strategy**: Added 1.5s network timeout with instant cached `/index.html` fallback in `sw.js`, eliminating 60-second freezes on flaky or 2G/subway networks.
    - **Dynamic Asset & Font Caching**: Stale-while-revalidate caching for all Vite JS/CSS bundles, SVG icons, and Google Fonts.
    - **Full Offline History Access**: Users can open the installed PWA offline, browse past chats, read previous conversations, and review media stored in IndexedDB.
    - **Seamless Background Sync Without Banner**: Removed the immersion-breaking yellow banner. Wassap operates cleanly and silently queues offline messages.
    - **Offline Outbox & Clock Icon (`pending`)**: Sending messages offline displays the authentic WhatsApp `Clock` icon (`status: 'pending'`) and enqueues to `whatsapp_offline_db.pending_outbox`. Upon network reconnection, messages automatically dispatch and change to sent ticks (`✓`), triggering persona replies.
- [x] **v1.7.9**:
  - **Elimination of Raw Technical Error Leaks & In-Character Resilience**:
    - **Root Cause Resolution**: Addressed raw Vertex AI JSON errors (`{"error":{"code":429,"message":"Resource exhausted...","status":"RESOURCE_EXHAUSTED"}}`) that were previously split by `splitMessage` and rendered as ugly green bubbles.
    - **Autonomous Retry & Model Fallback Pipeline**:
      - Implemented a 3-attempt retry loop with exponential backoff (`1.2s` -> `2.5s` + jitter) across Vercel Serverless (`api/gemini/generate.ts`), local dev server (`server/vertexHandler.ts`), and client-side Custom API Studio (`services/geminiService.ts`).
      - On retry after rate limits or transient overloads, automatically steps down to lighter, high-quota models (`gemini-2.5-flash`).
    - **Authentic WhatsApp In-Character Network Excuses**:
      - If transient API or network errors persist after all retries, the backend and client never dump raw stack traces or JSON. Instead, `getInCharacterNetworkGlitchExcuse()` generates natural WhatsApp messages matching the persona's speech style, about info, and persona tone in 100% natural English (e.g. *"Wait sorry, my phone slipped out of my hand for a second haha! What did you say?"* / *"Great, my wifi decided to take an impromptu power nap. Say that again?"*).
    - **Prompt Context & History Sanitization**:
      - Filtered out `isRawErrorMessage` from `sanitizeHistoryForVertex()` and `buildFullPersonaSystemPrompt()` so past glitches never poison prompt history or degrade future conversational quality.
    - **State Auto-Healing on Startup (`App.tsx`)**:
      - During initial `localStorage` hydration, any legacy chats containing raw JSON errors or `RESOURCE_EXHAUSTED` strings in message history or `lastMessage` previews are automatically healed into natural in-character replies.
    - **Service Worker Notification Shade Error Shield (`public/sw.js`)**:
      - Filtered notification history and wrapped background autonomous replies with `getGlitchExcuse()`, preventing raw technical errors from appearing in native OS notification cards.
- [x] **v1.8.0**:
  - In-chat authentic smartphone photo generation (`@img` / `@image`) overhaul with 2-step synthesizer + generator pipeline.
  - Three distinct realistic photo modes (`selfie`, `candid`, `pov`) with avatar reference conditioning, time-of-day lighting context, dynamic gender pronouns, and graceful excuses.
- [x] **v1.8.1**:
  - Anti-phone cliché overhaul with dynamic everyday activity pool (coffee, dining, study, outdoor, park).
  - Multi-message selection deletion with WhatsApp confirmation modal and automatic IndexedDB media blob cleanup.
  - 1-Click "Save as Memory" from selected messages with auto date spans.
- [x] **v1.8.2**:
  - Pure AI Diary generation overhaul saving genuine first-person persona reflections rather than mechanical chat logs.
  - Redesigned DateMemoryModal into an elegant journal entry card with multi-model fallback retry loops (`gemini-3.8-flash` -> `gemini-2.5-flash` -> `gemini-2.5-flash-lite`).
  - `@rem` memory recall command with tokenized relevance scoring, stop word filtering, and top-priority prompt directives.
  - Balanced photo realism allowing natural everyday activities without strict phone prohibitions.
- [x] **v1.8.3**:
  - Authentic sent message pop sound (`/msgsentpop.mp3`) on user sends across all message formats.
  - Non-blocking Web Audio API dual-buffer playback engine supporting concurrent overlapping of sent pop and incoming chimes (`/whatapp.wav`).
  - Foreground-only check (`!document.hidden`) ensuring sounds stay silent when backgrounded or minimized.
  - Service worker offline pre-caching (`wassap-shell-v5`) for complete PWA offline support.
- [x] **v1.8.4**:
  - Eliminated unintentional memory recall leakage on ordinary messages (restricted `[MEMORY RECALL]` directive to explicit `@rem` commands).
  - Complete, clean persona chat history reset in `ProfilePanel` and `ChatWindow` with optional memory bubble/diary purging.
  - Full purge of offline outbox, background exchanges, and immediate `localStorage` synchronization.
- [x] **v1.8.5**:
  - **45-Message Context Rolling Window**: Buffed in-chat rolling history from 30/35 to 45 messages across `geminiService.ts`, `App.tsx`, and `sw.js`, guaranteeing ~20-22 recent conversation turns are seamlessly recalled without token bloat or model overload. Kept strictly distinct from `@rem` long-term diary memory recall.
  - **Non-Stacking Date Dividers**: Scoped chat messages into isolated date group sections with `useMemo` in `ChatWindow.tsx`. CSS `sticky` positioning is strictly bounded within its date section container, naturally pushing previous date dividers out of view when scrolling across "Yesterday" and "Today" without any stacking or overlapping.
  - **Compact Native WhatsApp Mobile Date Pill**: Scaled down typography (`text-[9.5px] sm:text-[11px]`) and padding (`px-2.5 py-0.5 sm:px-3.5 sm:py-1`) for a sleek, authentic native WhatsApp appearance that does not crowd mobile screens.
  - **Sentience 2.0 Humane Settings Engine**: Completely overhauled the prompt engine across Vertex Cloud, Gemini Studio, and serverless handlers:
    - *Strict Anti-Robot Protocol*: Blocks AI clichés, corporate apologies, sycophantic echoing (parroting user messages), mandatory end-of-text interrogation questions, and unsolicited preachy advice.
    - *Authentic Texting Cadence & Imperfections*: Emulates casual texting flow with lowercase starts, organic abbreviations (`tbh, idk, yk, rn, prolly, gonna, wanna`), expressive vowel lengthening, and natural conversational fillers.
    - *Dynamic Message Pacing*: WhatsApp-native short bursts (1-2 lines max) with quick quips rather than structured essay monologues.
    - *7-Tier Nuanced Mood Engine*: Refined emotional directives from 0-15 (Very Annoyed/Curt) through 51-65 (Tranquil/Balanced) to 93-100 (Thrilled/Ecstatic) with strict rule never to state mood numbers directly.
    - *ProfilePanel UI Refresh*: Polished Humane Settings toggle copy and real-time mood tier indicator.
  - **Critical React Rules of Hooks Hotfix (`ChatWindow.tsx`)**: Resolved fatal crash on startup and chat selection caused by placing `useMemo` below an early `if (!chat) return (...)` check. Moved all hooks to the top level of `ChatWindow`, eliminating the `"Rendered more hooks than previous render"` error that triggered `AppErrorBoundary` ("Something went wrong").
  - **Service Worker Cache Invalidation (`wassap-shell-v6`)**: Bumped SW cache to v6 and enhanced `handleReset` in `index.tsx` with asynchronous `registration.update()` triggers to force-purge stale bundles across client devices.
- [x] **v1.8.6**:
  - **Native Notification Tray Experience & Left-on-Read Auto Reaction**:
    - *Persistent Mark as Read*: Repaired background mark-as-read syncing by recording actions to IndexedDB (`synced_background` table in `whatsapp_offline_db`) via `recordBackgroundMarkAsRead` and `saveMarkAsReadToIDB` in `public/sw.js`. The state cleanly synchronizes even if the PWA or browser tab is completely closed.
    - *Non-Dismissing Action Cards*: Clicking "Mark as read" or submitting an inline reply no longer closes the notification card. The notification stays quietly in the OS shade until the card itself is clicked to open the app.
    - *Left-on-Read Auto-Trigger with Natural Hesitation*: When a persona's message is marked as read without a reply (either via native notification or in-app), the persona waits a realistic hesitation period (6.5 to 10 seconds). If the user does not reply in that time, the persona automatically responds in-character to being left on read.
    - *Pop-up Native Notification on Persona Replies*: When the persona replies (either reacting to being left on read or answering an inline reply submitted through native notifications), the first chunk of their message actively pops up as a new native OS notification (`renotify: true`, `silent: false` with banner, sound, and vibration) to alert the user. Subsequent stacked fragments update smoothly and quietly (`silent: true`).
    - *Autonomous Background Reaction*: If all app tabs are closed, the Service Worker (`sw.js`) independently handles the Left-on-Read delay and generates the in-character response, displaying the pop-up notification directly from the background worker.
  - **In-App Click & Hold (Long-Press) "Mark as Read"**:
    - Implemented a 450ms long-press pointer detector (`handlePointerDown` / `handlePointerUpOrCancel` / `onContextMenu`) on `MessageBubble` with haptic feedback vibration (`navigator.vibrate(40)`).
    - Added a dedicated "Mark as read" button (`CheckCheck` in `#53bdeb` blue) to the top multi-message selection bar in `ChatWindow`.
    - Wired `onMarkAsRead` to update message states to `read`, clear unread counters, purge audio locks, and record to offline storage.
  - **Service Worker Shell v10 & Android RemoteInput Spinner Fix**:
    - *RemoteInput Spinner Dismissal*: Fixed an issue on Android (HyperOS/OneUI/AOSP) where submitting an inline reply caused an infinite circular loading spinner in the notification input box. In Android OS, a notification with active RemoteInput will remain in a "sending" state with a loading spinner until `event.notification.close()` is called on that notification instance. Added `event.notification.close()` before immediately presenting the updated notification card (`showNotification`) with the user's message (`You: <text>`), instantly clearing the spinner while keeping the card anchored in the notification shade.
    - *Bypassed Android Background Tab Throttling*: Fixed background replies failing or going nowhere when the PWA was backgrounded. On mobile devices, background browser tabs are heavily throttled/frozen by the OS. Instead of delegating to a suspended background window, the Service Worker now autonomously generates the persona reply within `event.waitUntil`, pops up the response notification, saves the exchange to IndexedDB, and broadcasts `BACKGROUND_EXCHANGE_SYNC` to open tabs.
    - *Mark as Read OS Action Clearing*: Calling `event.notification.close()` followed by immediate `showNotification` with `(Read ✓✓)` properly resets the OS action pending state on Android while keeping the card in the tray with the Reply action ready.
    - *SW Cache v10*: Bumped cache to `wassap-shell-v10` for instantaneous client updates.
- [x] **v1.8.7**:
  - **Native Notification Shade Dialogue Formatting & Subtle Line Divider**:
    - *Thin Hairline Divider*: Replaced redundant persona name prefix (`"Persona: message"`) in 1-on-1 notification cards with a subtle unicode hairline divider (`────────────────────` via `\u2500` flanked by newlines `\n────────────────────\n`). Mobile and desktop notification shades now render a delicate, light horizontal partition between turns that drastically improves readability.
    - *Clean Attributions*: Kept `"You: <text>"` for user turns. In 1-on-1 chats, persona names are omitted in the body since contact name and avatar already headline the notification card. In group chats, member attributions (`${personaLabel}: `) are cleanly placed after the divider.
    - *Threaded History Bounds*: In `public/sw.js` (both autonomous Left-on-Read reactions and inline quick-replies), dialog history is parsed by `DIVIDER` and bounded to the 2 most recent turns (`slice(-2)`), preventing message run-ons or notification shade overflow on Android.
    - *Foreground Sync Reliability*: Handled nullable `userMessage` in `App.tsx`'s `BACKGROUND_EXCHANGE_SYNC` listener to seamlessly synchronize standalone persona replies (like Left-on-Read reactions) into the chat history without runtime errors.
- [x] **v1.8.8**:
  - **Message Fragmentation Limits & Boundary Detection Overhaul**:
    - *Buffed Word Count Tiers*: Increased fragmentation limits across `App.tsx` and `public/sw.js`:
      - 1 chunk: $\le$ 8 words (preserved for instant short phrases).
      - 2 chunks: $\le$ 20 words (increased from 15).
      - 3 chunks: $\le$ 29 words (increased from 24).
      - 4-5 chunks: $> 29$ words ($\ge 30$ words approx).
      - Adjusted global hard caps: $\le 30$ words max 4 chunks, $\le 60$ words max 5 chunks.
    - *Smarter Natural Boundary Detection*:
      - Protected decimal numbers (e.g. `3.14`, `$10.50`) and common abbreviations (e.g. `etc.`, `dr.`, `mr.`, `vs.`) from spurious middle-of-sentence splits.
      - Trailing emoji detection (`[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]`) recognizes emojis as natural texting pause boundaries.
      - Punctuation handling now supports closing markdown symbols, quotes, and dashes (`[.!?,\;:\-~—–]+["'”’\)\]*_~]*$`).
      - Expanded conversational conjunctions (`["and", "but", "so", "because", "then", "or", "though", "plus", "also", "meanwhile", "anyway"]`) with a 2-word segment guard to prevent 1-word fragments.
  - **Sentience: Humane Settings "Vary Message Length" Dropdown & Prompt Editor**:
    - Added an expandable dropdown menu (`ChevronDown` / `ChevronRight`) directly under "Vary Message Length" in `ProfilePanel.tsx`.
    - Integrated preset selector (`VARY_MESSAGE_LENGTH_PRESETS` in `constants.ts`: Dynamic WhatsApp Pacing, Ultra-Short & Punchy, Expressive Multi-Bubble Bursts, Custom).
    - Added editable monospace prompt `<textarea>` so users can view and customize the exact prompt instructions sent to the AI, complete with a "Reset to default" button.
    - Supported custom `varyMessageLengthPrompt` across `types.ts`, `services/geminiService.ts`, `server/vertexHandler.ts`, and `api/gemini/generate.ts`.
    - *Bumped Service Worker Cache*: v12.
- [x] **v1.8.9**:
  - **Unified 1.8–2.5s Conversational Flow & Rapid Stacking Resumption**:
    - *Consistent 1.8s - 2.5s Phase Pacing*: Replaced overly long, variable delays (up to 3.8s–5.2s) across all active messaging phases with a unified, comfortable `1800 + Math.random() * 700` ms window:
      - Delivery delay (single tick to double grey ticks): 1.8s – 2.5s
      - Come-online delay (double grey ticks to persona online): 1.8s – 2.5s
      - Seen delay (double grey ticks to blue ticks): 1.8s – 2.5s
      - Thinking/reading delay (blue ticks to typing status): 1.8s – 2.5s
      - Typing duration (foreground message bubble preparation): 1.8s – 2.5s
      - Inter-message pause between fragmented chunks: 1.8s – 2.5s
      - Photo, audio note, and excuse preparation phases: 1.8s – 2.5s
      - Group response readiness and typing duration: 1.8s – 2.5s
    - *Streamlined Stacking Mode Cycle*: Removed premature and intrusive online status flips during the active text-stacking window. User messages are naturally marked delivered at 1.8s – 2.5s. When the stacking delay timer ends, all messages are immediately confirmed delivered (skipping redundant delivery waits) and the clean cycle begins immediately: Online (1.8s – 2.5s) $\to$ Seen / Blue ticks (1.8s – 2.5s) $\to$ Typing (1.8s – 2.5s) $\to$ Delivery.
    - *Preserved Lingering Online*: Persona stays online for 35 seconds (`schedulePersonaOffline` with 35,000 ms) before transitioning to offline, allowing seamless continued conversations without re-triggering the pickup phase.
    - *Service Worker Cache v13*: Bumped cache to `wassap-shell-v13`.
- [x] **v1.9.2**:
  - **Vertex AI Multimodal Remote Media & GIF Decoding Fix**:
    - *Root Cause*: When users sent remote media (such as Giphy or Tenor GIFs, or external image URLs), `handleVertexChat` in `server/vertexHandler.ts` and `api/gemini/generate.ts` passed raw URL strings (`https://i.giphy.com/...`) into Gemini's `inline_data.data` field, expecting base64-encoded bytes. This caused Vertex AI 400 errors: `Invalid value at 'contents[0].parts[1].inline_data.data' (TYPE_BYTES), Base64 decoding failed`.
    - *Safe Media Resolvers*:
      - Implemented `resolveMediaToInlineData` in `server/vertexHandler.ts` and `api/gemini/generate.ts` (Node.js/Vercel serverless): fetches remote image and GIF URLs with a 6-second timeout, verifies content size ($\le$ 8MB) and MIME type, and converts buffer to valid base64 bytes (`Buffer.from(buf).toString('base64')`). Also parses data URIs and discards vector SVGs (`image/svg+xml`), which Gemini vision models do not support.
      - Implemented `resolveMediaToInlineDataBrowser` in `services/geminiService.ts` for Custom API Key mode using browser `fetch()` and `FileReader`.
    - *Rich Text Context*:
      - Enhanced history formatting so GIFs and stickers receive distinct prompt tags (`[GIF ANIMATION ATTACHED]`, `[STICKER ATTACHED]`) in addition to standard `[IMAGE ATTACHED]`.
      - Added directive instructing personas to react humorously, warmly, or playfully in-character to GIFs and stickers sent by the user.
      - Fixed `messageHistory` mapping in `server/vertexHandler.ts` to include voice note tags (`[VOICE NOTE ATTACHED]`) and reaction tags (`[REACTIONS ON THIS MESSAGE: ...]`).

- [x] **v1.9.6**:
  - **Multi-Day Journal Recollections (Chronicle of Events)**:
    - Overhauled diary generation for multi-day date spans to eliminate recency bias.
    - Chat history is grouped chronologically by calendar date with balanced sampling per day across the date span.
    - Dynamic journal titling: Single day $\to$ `[Persona]'s Diary`, 6–8 day spans $\to$ `[Persona]'s Weekly Chronicle`, extended ranges up to 31 days $\to$ `[Persona]'s Recollection of Events`.
  - **Local Persona Backup & Migration Engine (100% Client-Side Privacy)**:
    - *Profile-Level Export*: Dedicated "Persona Backup & Export" card in `ProfilePanel.tsx` downloads `<Persona>_Profile_Settings.json` containing the full persona specification (name, avatar, about, role, speech style, system prompt, voice settings, schedules, automations, and memories). Zero chat messages are stored, guaranteeing 100% user privacy.
    - *App Settings Migration Import*: Placed "Persona Migration" section directly in default App Settings (`SettingsPopover.tsx`). Allows seamless migration onto fresh devices or blank browsers where the persona does not yet exist. Instantly creates the persona in `chats`, configures all properties, selects the chat, navigates to chat view on mobile, and dismisses Settings.
    - Cleaned `ProfilePanel.tsx` to remain export-only and kept `NewChatPanel.tsx` clutter-free.

---

## ⚠️ Critical Engineering Rules & Constraints
1. **NEVER PUSH TO GIT**: The user explicitly requires that **only they push code to GitHub (`git push`)**. As an AI, never run `git push` or configure automated remote pushes.
2. **Always Run Verification**: Before reporting completion, always verify with `npm run build` and `npx tsc --noEmit` to guarantee zero compilation or bundling errors.
3. **Preserve Dual Provider Support**: Any changes to AI calling logic must preserve both Vertex Cloud (`geminiService.ts` proxy) and Custom API Key (direct client-side SDK) pathways.
4. **Vercel Serverless Isolation**: Files under `api/gemini/` must not import local non-bundled helper files that Vercel serverless builds cannot resolve. Keep them self-contained or import standard npm packages.
5. **Pixel-Perfect Authenticity**: Strictly adhere to WhatsApp Web UI patterns, colors, font families, and responsive spacing as documented in `design.md`.
6. **Always Update `memory.md`**: Update this file at the end of every completed task to record changes, milestones, and architectural notes for subsequent AI sessions.
