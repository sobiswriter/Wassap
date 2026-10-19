# Live voice continuity audit — 19 October 2026

## Confirmed findings and changes

The reported perceptual voice change was not reproduced against Google audio. The app does not choose a different preset or model halfway through a connected session. Investigating found these app-side risks:

- Profile voice previews use detached Audio elements, invisible to document.querySelectorAll('audio,video'). They were never paused on component unmount. A pending preview could also complete after closing the profile and begin speaking during a call. Stop existing previews on profile unmount/call-start, and block late preview playback after unmount or while the call UI is present. A real-browser regression reproduces/guards both cases with synthetic speech audio.
- The Live prompt repeated custom voice descriptions, automatically selected preset traits and pitch overrides alongside the preset/reference in speechConfig. Separate delivery from identity: omit those duplicate/competing cues, retain explicit non-duplicate delivery and pacing. This is a mitigation, not evidence that conflicting prompting caused this user's exact incident. Google warns about identity re-description and pitch/style steering for **3.8 TTS**; applying that separation to Live is an engineering inference, not a claimed Live guarantee. [Google TTS consistency guidance](https://ai.google.dev/gemini-api/docs/speech-generation)
- Freeze voice/model for the call and cache the setup prompt once, after context preparation. Resume with the same voice/reference, model, prompt and Google handle. Reject late frames from old connection generations. No automatic voice/model change occurs on a rejected custom sample or failed selected model.

## Model integration

Global Settings now selects `gemini-3.8-live` or `gemini-3.8-live-extended-thinking`, independently of voice-note generation. The relay allowlists both IDs and defaults only missing legacy selection to normal Live; invalid requests are rejected. Availability still depends on project/provider access.

Normal Live omits thinkingConfig. Extended Thinking uses LOW reasoning and tracks interactionStatus separately from utterance completion; an intermediate turnComplete must not stop later audio. Accept SDK nested and documented top-level status forms. No functions/tools are configured, so no blocking tool declarations need migration. Proactive audio is not explicitly disabled. [Google Thinking integration guide](https://ai.google.dev/gemini-api/docs/live-api/thinking/), [Extended Thinking model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live-extended-thinking)

## Documentation cross-check

| Area | Result |
| --- | --- |
| Preset voice setup | SDK speechConfig.voiceConfig.prebuiltVoiceConfig correctly serializes inside generationConfig; browser wire test confirms the selected voice. |
| Custom Live reference | Cloud sends replicatedVoiceConfig with 10–20 seconds of 24 kHz mono PCM. Studio/short/missing references retain the existing visible pre-call fallback notice. No post-connection substitution. |
| Voice access | Custom Live references remain limited to eligible Cloud projects; access failure stays explicit. |
| Audio transport | Existing 40 ms/16 kHz mono signed PCM capture and 24 kHz output match the docs; all audio parts are consumed. |
| Interruption | Existing interruption clears queued output; low-sensitivity automatic VAD remains unchanged. |
| Long sessions | Compression, resumption and GoAway handling remain; no warning-triggered immediate hang-up. |
| Persona language | Explicit language stays in the system prompt; do not assume a Live languageCode forces a native audio model. |
| Context | Keep the compact name/description/last-20 summary contract; do not add raw diaries or full persona notes to solve voice drift. |

References: [Live capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities), [Cloud voice/reference configuration](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice), [Live best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices).

## Verification and remaining limit

Follow-up direct provider check: both gemini-3.8-live and gemini-3.8-live-extended-thinking timed out after 15 seconds without setupComplete or audio. The actual SDK/Cloud client used a synthetic one-sentence request and Fenrir, without user conversations. A local application-default credential file exists, but no project environment/provider credential variables are configured; the local member-session probe returned 401. The timeouts do not prove whether the cause is credentials, networking, model access or another connection issue. No successful acoustic verification can be claimed from these attempts.

69 tests pass; TypeScript and production build pass. Browser checks cover both provider transports, SDK Extended Thinking setup serialization, custom reference conversion, model preference persistence, narrow settings layout, same-setup resumption and preview overlap cleanup.

No actual Google session audio or physical handset recording was sampled. If a single uninterrupted upstream stream still changes timbre with one pinned voice and a clean prompt, that remains a provider-level issue to reproduce rather than silently switch voices or claim fixed. No deployment, credentials logging or rewriting stored user data.
