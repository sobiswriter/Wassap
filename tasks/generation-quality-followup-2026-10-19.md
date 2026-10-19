# Generation quality follow-up — 19 October 2026

## Delivered

1. **Voice delivery reaches the provider.** Pinned `@google/genai` to 2.24.0, the documented compatible generation interface, and checked actual SDK request serialization for Studio and Vertex. All three TTS routes use the 3.8 `voiceConfig.voice` selector and put optional delivery in `parts[].speechMetadata.style`. Spoken words remain verbatim, including on the custom-voice fallback. Prompting off omits metadata. Custom voice identity descriptions are not repeatedly stuffed into turn-level delivery; Live retains its existing identity/style behavior. The older 3.1 fallback retains its steering format. Cleared completed attempt timers, supplied SDK request timeouts and propagated browser cancellation so a cancelled custom voice does not launch another request.
2. **Ordinary photos by default, explicit intent first.** `utils/photoPrompt.ts` now supplies the same final composition rules for Studio and local Cloud, mirrored with a parity test in the self-contained Vercel image handler. Ordinary shots use phone-camera realism, available light, plausible imperfections and unarranged surroundings, without requiring every image to be blurred or messy. Explicit studio/professional/other aesthetics override those defaults. Mirror selfies have a distinct viewpoint instruction. The original request now travels from App through every generation route, rather than relying entirely on a synthesized scene to retain it. Planning preserves requested camera, lighting, pose and time; current clock is a fallback. POV images do not receive the persona portrait. Reference-backed subject images preserve identity while allowing pose/style changes. A blocked request no longer silently removes the reference and substitutes a different casual scene to retry.
3. **System instructions separated from conversation data.** `buildPersonaPrompt` returns persona rules and the existing serialized history separately. `buildFullPersonaSystemPrompt` remains as a compatible wrapper for callers that need a full snapshot. Studio, local Cloud and Vercel generation put rules into the native system-instruction field, with labelled media/history in contents. Names, group context, events, reaction priority, humane settings, voice directives, user context and memories stay present. Kept the established history format rather than simultaneously migrating every turn to native model/user roles; the latter would add avoidable risk for groups and multi-speaker events. This improves the instruction boundary but does not make arbitrary prompt injection impossible.
4. **Personal diaries preserved.** The owner clarified that private thoughts and feelings are the desired feature. Diary generation instructions and storage semantics were deliberately left intact. No conversion to clinical/factual documentation, forced relationship neutrality or migration of existing entries.
5. **Notification context refreshed.** New notifications include history-free persona rules. Studio background replies use the latest available ledger, including previous background exchanges, instead of an embedded old history snapshot. Both providers receive a freshly computed clock, honoring custom time offsets and clock-sharing/time-awareness settings. Old gap directives are not replayed on every notification reply. Explicit left-on-read/proactive intents remain supported. Older notification payloads retain a legacy fallback. Shell cache v22 refreshes the worker without clearing user data. This is the worker's latest available context, not a claim that a closed browser can retrieve changes it has never received.
6. **Focused performance work.** Shared photo construction removes route drift; completed TTS requests no longer retain their 18-second timeout. No framework, realtime service or speculative settings added. The SDK upgrade adds approximately 19 KB gzip to the Google SDK chunk (51 KB to 70 KB); this is a compatibility cost for working voice controls, not a claimed download-speed improvement. A shared CommonJS helper placement fixes the vendor chunk cycle exposed by the upgrade. Build is clean.

## Quality checks

- 46 automated tests, TypeScript and production build pass. New checks cover metadata versus spoken text, prompting off, selected/custom voices and fallback, cancellation, real SDK wire serialization on both APIs, ordinary/professional/mirror requests across all three image routes, portrait exclusion for POV, blocked-photo behavior, system/history separation with groups/events/reactions/voice, notification ledger freshness, custom clock, clock-off, time-awareness-off, proactive intent and older payloads.
- Browser suites: both Live transports, ringback rollover/minimum delay, PCM capture/playback/interruption, controls and persistence; designed/replicated sample conversion and explicit fallback; reaction-only and mixed-message priorities in both arrival orders; mobile UI at 320–1440 px, themes, keyboard/trays, navigation and stored data preservation. No private user chat was used as a fixture.
- Real Google requests used only a fictional persona and synthetic content. A before/after text spot check kept a casual teasing voice and answered the question about bringing printed photos without announcing the thumbs-up. Both comparison requests used the same 2,048-token cap; an earlier overly small 400-token probe was excluded from the comparison. One pair is not a statistical quality or speed benchmark.
- Real Aoede TTS requests with identical words returned valid mono 24 kHz WAVs: plain 4.52 seconds; reassuring/slow delivery 5.40 seconds. This proves accepted metadata and a changed rendition, not a subjective proof of better emotion or identical custom-voice timbre.
- Real generated images were inspected: a casual mug snapshot and an explicit professional product photo with a dark studio background. The casual prompt was then refined against excessive stylized blur/decorative props and checked again. It produced an everyday desk scene; some background blur remains. Prompting influences aesthetics but cannot guarantee that every result looks naturally photographed.
- Probe outputs and screenshots are local ignored files under `output/playwright/`. Tests do not include private persona conversations, keys or real microphone recordings. No push, deployment, storage reset or diary rewrite.

## Limits

Physical phone/Bluetooth/background behavior, subjective listening and real project-specific custom voice access still need device/account testing. The small generated sample set does not establish a universal no-regression guarantee; retain feedback and compare representative persona outputs before making further global prompt changes. Existing Tailwind tooling audit findings were not addressed with a disruptive major upgrade in this task; the SDK change introduced no listed audit finding.

## Official references

- [Google TTS generateContent schema](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation): spoken text, delivery metadata and voice selectors.
- [Google Cloud TTS](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/overview): global routing and structured delivery control.
- [Google prompt design](https://ai.google.dev/gemini-api/docs/prompting-strategies): clear priorities and iterative evaluation.
- [Google image prompting](https://ai.google.dev/gemini-api/docs/image-generation): scene intent, composition and reference images.
- [Rollup manual chunks](https://rollupjs.org/configuration-options/#output-manualchunks): explicit module grouping.

After reviewing and staging the desired files in Source Control, the owner can run:

```powershell
git commit -m "Improve Gemini voice delivery, photo intent and conversation context"
git push origin main
```

The assistant did not commit or push.
