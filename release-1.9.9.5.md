# Wassap v1.9.9.5 — release notes and verification

22 October 2026. Local release candidate; the owner deploys it.

## What changed

- Failed text, group and photo requests now mark the original outgoing prompt with a red exclamation button. Tap to retry; saved image/video bubbles also show a Retry overlay. No new persona connection/photo excuse is inserted.
- Retry preserves message IDs, text, quotes and saved attachments. Each unstacked prompt is handled separately; an original stack retries together even if stacking settings change. Newer failed prompts remain separate, and rapid taps do not duplicate delivery.
- Failed inputs stay in the existing outbox across reloads until manually retried. Offline inputs that have never been attempted keep their clock and normal reconnection behavior. Retrying resets only the selected batch's delivery budget.
- Built-in Cloud, personal-key Studio, notification reply reconciliation and group/photo delivery follow the same failure policy. Cloud endpoints report generation failure instead of returning an excuse as a successful reply.
- Package/lockfile, browser title, social metadata, installed-app name and the latest System Updates card identify **1.9.9.5**. Worker shell **v27** refreshes the app assets; the previous shell remains available for existing tabs. Release tests and deployment smoke expectations match.
- The repository's photo-failure rule now documents manual retry so future maintenance does not restore excuses.

App identity `/`, storage names/versions, existing chats/personas/memories/media, member passkey and both provider paths are preserved. There is no database migration or data-clearing step. Existing saved replies are not rewritten.

## Verification

- Fresh install from the release manifest/lockfile: `npm ci --ignore-scripts` passed in an isolated temporary directory; no dependency versions were changed for this release.
- `npm test`: **78 passed**. Includes isolated-route authentication/origin parity, health information disclosure, bounded JSON/media handling, private-address and redirect blocking, model allowlists, outbox persistence/batching and unavailable-output behavior in local/deployed Cloud handlers.
- `npx tsc --noEmit` and `npm run build`: passed. The build checks injected service-worker syntax and emits the complete offline shell, including lazy panels.
- Local production smoke: `node scripts/release-smoke.mjs http://127.0.0.1:3013` passed all checks for release labels, manifest identity, worker version, ringback asset, security headers, public health and unauthorized/cross-origin requests. It makes no paid model requests.
- Working-tree source scan found no embedded Google API keys, Google OAuth client secrets or private-key PEM blocks. This is a pattern scan, not a Git-history audit or penetration test.

- Production-preview Chrome checks passed: worker-controlled online/offline reload with saved chats/settings preserved; fresh shell caching of unvisited Settings and vendor chunks; mobile/desktop light/dark wallpaper, keyboard-height resizing, draft/focus retention, diary controls and version restoration; both-provider single/stack retry, reload persistence, rapid taps, saved media hydration, group/photo failure recovery and 320px layout. Existing geometry checks now tolerate subpixel device scaling while still requiring the original CSS touch-target size.
- The new release card and retained previous history render at 320/390/1440px; the labeled close action works without page errors. The mobile release card screenshot was visually inspected.

## Security findings

`npm audit --omit=dev --json` reports **zero runtime dependency vulnerabilities**. The full `npm audit --json` still reports **five high-severity build-tool entries** in Tailwind 3 → chokidar/fast-glob/micromatch → braces. These are five affected dependency entries arising from the same underlying [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); the advisory lists no patched version as of this review.

The finding remains open. Build only trusted repository source/config; CI retains a read-only token, disabled persisted Git credentials and its 15-minute limit. Runtime findings remain a failing CI gate; the full build-tool audit is reported separately without hiding the findings. Reassess by **26 October 2026**. A forced Tailwind 4 migration is not part of this delivery fix.

## Owner deployment

Review and stage the intended modified and new files, including the new retry tests and this release note. Then run:

```powershell
git diff --check
git commit -m "Release Wassap v1.9.9.5"
git push origin main
```

After Vercel reports a successful deployment:

```powershell
npm run release:smoke -- https://wassapyo.vercel.app
```

Keep the existing server credentials and member passkey. Verify Built-in Cloud unlock, a normal reply, a failed-send/manual retry, a stacked retry, a saved attachment, a photo request, a voice note and personal-key mode on the affected phone. Repeat on cellular data, Wi-Fi and after screen lock/resume. Confirm the browser/installed app shows v1.9.9.5 after refreshing; do not clear browser data to update it.

Local checks do not establish that the new version is deployed, that production Google credentials/entitlements work, or that every handset/carrier issue is resolved. Push/background timing, real voice quality and provider availability still require device/account testing.

If a regression appears, roll back to the previous known-good Vercel deployment without clearing user storage or rotating the member passkey. Preserve pending inputs for investigation and retry.
