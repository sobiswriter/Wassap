# Wassap v1.9.9 — release verification

19 October 2026. Local release candidate; the owner pushes and deploys.

## Reliability follow-up

A subsequent report of Android blank screens and slow/background replies prompted the [19 October stability follow-up](tasks/stability-followup-2026-10-19.md). It adds durable retry/receipts, atomic notification reply persistence, complete worker v24 precaching with module-cache lookup correction, bounded conversation DOM, shorter presence pauses, latest-only notification content and matching dark surfaces. Current verification is **54 tests** plus TypeScript/build/browser checks; the earlier release-pass results below remain historical. No deployment or exact physical-handset crash reproduction is claimed. CSS has intentionally changed for the requested dark-palette correction, so the earlier dependency-only CSS comparison below is not the current stylesheet hash.

## Included

- Persona internet voice calls, repeating bundled CC0 ringback during preparation/pickup, compact call UI, mute/audio controls, dated chat transcripts and call diaries after 60 connected seconds.
- Shared voice selection and delivery controls, custom Live voice sample support where Google enables it, explicit fallback when unavailable. Browser background support remains device-dependent.
- Persona-specific time awareness (default on), 60 reaction choices and native emoji input, subtler reaction influence alongside substantive messages.
- Native system instructions separated from chat history, refreshed notification context/clock, speech delivery metadata and authentic casual photo defaults that yield to explicit professional/style requests. Personal diary tone retained.
- Fixed dedicated Vercel photo entry points that had drifted from the local/Studio prompts, including safety-block handling.
- Same-origin API guards, private member diagnostics, non-cacheable APIs, bounded UTF-8 request streams and reserved-address media protection. Production CSP, anti-framing, MIME-sniffing, referrer and permission headers.
- v1.9.9 labels and Updates card, shell cache v23, stable installed-app identity, existing storage and member passkey. No data reset or migration.

## Verification

- Clean `npm ci --ignore-scripts` succeeds on Node 22 with the committed lockfile.
- 51 unit/integration tests pass; `npx tsc --noEmit` and `npm run build` pass.
- Production-preview browser checks cover both calling providers, synthetic microphone/PCM/interruption, ringback, mute/cleanup, transcripts/diaries; designed/replicated sample conversion and fallback; worker-controlled online/offline reload; light/dark responsive UI and saved data; expanded reactions and native emoji validation; persona time-awareness persistence. The custom-voice check caught CSP blocking local sample fetches; permitting data/blob conversion fixed the regression, and a policy test now protects it.
- Local `npm run release:smoke -- http://127.0.0.1:3013` passes version, manifest identity, worker, ringback asset, security headers, public health and unauthenticated API checks. These deliberately make no paid generation requests.
- `npm audit --omit=dev --audit-level=moderate`: zero runtime vulnerabilities. Scoped selector-parser 7.1.6 overrides remove its patchable advisory. Generated CSS SHA-256 remains `55388a06ee5fa3fa72bc6db7439a7d71831bc0672849d840a7037ea73f425ef3`, identical before/after the override.
- Source scan found no embedded Google API key/private-key material. This is a working-tree scan, not an exhaustive Git-history audit or penetration test.

Full audit still reports **five high build-only entries** in Tailwind 3 → chokidar/fast-glob/micromatch → braces. [The braces advisory has no patched version](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Avoid a forced Tailwind 4 migration during this release: build only trusted source/config and use CI's read-only token, disabled persisted Git credentials and 15-minute timeout. Review by **26 October 2026**. CI gates runtime findings and reports the full audit separately; these findings are not represented as fixed.

## Production handoff

Target: https://wassapyo.vercel.app. The last read-only check served **v1.9.7**, accepted unauthenticated health checks with extra deployment details, and lacked the new browser security headers. Authentication for paid HTTP routes was locked as expected. Local verification does not establish that v1.9.9 is deployed or that Google credentials/Live entitlements work in production.

Preserve existing Vercel server credentials/passkey. Node 22 is specified in package.json. Keep Live's supported region (`VERTEX_LIVE_LOCATION`, default `us-central1`) separate from the existing text/TTS location. [Vercel supports exported HTTP servers with WebSockets](https://vercel.com/docs/functions/websockets), currently in public beta; verify project availability/Fluid Compute and actual connection resumption across the configured function duration. [Platform payload/duration limits](https://vercel.com/docs/functions/limitations) still apply; raw streams have a 4 MiB application cap, while pre-parsed Vercel bodies are platform-limited.

Review/stage all intended files in Source Control, then the owner runs:

```powershell
git diff --check
git commit -m "Release Wassap v1.9.9"
git push origin main
```

After Vercel reports successful deployment:

```powershell
npm run release:smoke -- https://wassapyo.vercel.app
```

Then unlock Built-in Cloud using the existing passkey, check text/photo/voice-note generation, make a real call, test interruption/ringback and notification End on the target phone, and confirm the dated chat record and long-call diary. Also verify personal-key mode. Do not put credentials into this smoke command. Physical audio quality, Bluetooth/echo/noisy-room behavior, screen-lock/background survival, custom Live entitlement and production relay resumption require this device/account check. Camera/screen sharing remains research-only.

If a regression appears, use Vercel's previous known-good deployment/rollback without clearing browser data or rotating member access. Investigate before retrying; keep captured call records and pending diary jobs intact.

Prompt-quality observations and real synthetic model probes: [generation quality report](tasks/generation-quality-followup-2026-10-19.md). No subjective listening or broad model-quality guarantee is implied by transport tests.
