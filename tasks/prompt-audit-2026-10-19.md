# Gemini prompt audit — 19 October 2026

Follow-up: the owner approved improvements while preserving emotional diaries. Implemented changes and verification are recorded in [generation-quality-followup-2026-10-19.md](generation-quality-followup-2026-10-19.md). Findings below describe the earlier audit state.

## Assessment

The existing work has a solid foundation: explicit persona identity, configurable speaking style, memories, multimodal input, a photo-intent planning step and reference images. Keep those. The main weakness is instruction competition: repeated CRITICAL/MUST language makes small social cues compete with the actual question. More instructions do not automatically produce more natural conversation.

This is a source/code audit with mocked transport and browser verification, not a claim that subjective model quality improved in a measured live A/B test.

## Changes made

| Area | Finding | Change |
| --- | --- | --- |
| Ordinary messages | Mandatory reaction acknowledgement could dominate a substantive message. Old reaction tags could be treated as fresh events. | Latest intent takes priority. Historical reactions remain background. Fresh reaction-only events get a brief response; mixed events affect tone or a short aside, without narrating the emoji. |
| Stacked interactions | Both the message-triggered and reaction-triggered timers must apply that priority. | Applied the same policy whichever arrives first, including attachment-only messages. Reaction handling no longer relies on side effects inside a React state updater to decide whether to trigger generation. |
| Incoming photos/audio | Up to five recent media-bearing messages were attached without labelling their sender/caption. Multiple images could be confused. | Added adjacent sender/message labels to actual parts in all three chat transports. Failed resolution is explicitly unknown. Prompts require grounded observations and a focused clarification when unclear. |
| Combined media | A command to acknowledge ALL items encourages a checklist instead of a conversation. | Ask for a cohesive response to important connected points. Retain image-plus-audio understanding. |
| Outgoing voice-note transcript | Cloud demanded vocal effects; personal-key instructions differed. Random coughs/fillers/pauses risk theatrical delivery. | Same concise spoken-transcript instructions on all three routes. Optional fitting vocal events, no forced effects, emojis or stage directions. Preserve persona and voice settings. |
| Ringback | A 1.73-second asset restarted only every six seconds, then stopped before setup completed. | Native audio looping, random 6–12-second minimum preparation delay retained, playback continues during handshake and ends on pickup/cancellation/failure. |
| Reaction picker | Only 24 choices and no custom input. | 60 choices in a scrolling palette, native keyboard/paste emoji input, one-grapheme validation including joined emoji, flags and skin tones. Portal placement avoids clipping; resize/keyboard viewport changes reposition it. |

The three foreground chat prompt copies remain separate because the Vercel handlers are deliberately self-contained. A parity test now guards the updated priority and voice-note blocks.

## Remaining findings, in recommended order

1. **Voice-note delivery metadata needs a compatibility update.** In `services/geminiService.ts`, `server/vertexHandler.ts` and `api/gemini/tts.ts`, the 3.8 branch sends the verbatim transcript and selected voice but omits per-part delivery metadata. Computed style mostly steers the older fallback; more text-generation prompting cannot repair that omission. Installed `@google/genai` is 1.39.0 and its converters have no `speechMetadata` support. Google currently documents JS SDK 2.24+ or REST for its latest TTS interface. Verify both Studio and Vertex transports, custom voice IDs and fallback behavior before migrating; compare the same transcript with plain versus short style metadata. No SDK upgrade or untested metadata field was slipped into this change.
2. **Photo requests have good intent planning but overly strong defaults.** Planning prioritizes the explicit request, then recent context, then everyday variety. Reference images are a good consistency mechanism. However, final constructors hard-code front-camera selfies, casual smartphone aesthetics and default lighting; a mirror selfie or explicitly styled/time-shifted request can conflict. The standalone `api/gemini/image.ts` also differs from local/Studio image handling. Next focused change should carry an explicit camera/composition/lighting choice through planning and test all three image routes. This audit leaves generation behavior intact.
3. **System rules and history share a text prompt.** Foreground generation currently puts the assembled persona/history prompt in a user content part rather than separating stable system instructions from role-structured history. That makes priorities and boundaries less reliable. Labels and grounding rules help, but are not a complete prompt-injection defense. A dedicated migration should preserve groups, events, memory recall, inline notification replies and media ordering, with adversarial tests.
4. **Diary warmth can become invented relationship history.** Diary prompts are strong on persona voice and private reflection, but requests for vulnerability, shared experiences and a closing sentiment can overstate intimacy or imply an unrecorded event. Separate recorded facts from interpreted feelings and evaluate neutral/conflicted relationships as well as affectionate ones. Call records already retain raw dialogue and timestamps independently of diary prose.
5. **Background replies need their own regression set.** `public/sw.js` reuses the generated full prompt for personal-key notification replies, while cloud notification replies go through the server generator. A stored notification can contain older context; newer foreground prompt rules do not retroactively rewrite it. Scheduled interaction, left-on-read, time-gap and memory-recall instructions also remain strong and deserve mixed-intent evaluation.
6. **Avoid tuning solely by adding examples or adjectives.** The current humane settings already contain useful pacing and personality options. Test short/long requests, worry versus banter, multilingual voice notes and missing media before changing defaults globally. Keep user-authored persona settings authoritative within the roleplay.

## Suggested model evaluation

Use paired prompts with identical model/settings/history: reaction alone; reaction plus question (both arrival orders); image caption plus voice note; several unrelated attachments; unreadable media; a concerned message after playful history; neutral versus affectionate persona; explicit mirror/studio photo requests. Judge whether the reply answers the main intent, uses reactions implicitly, avoids invented media details, preserves voice and avoids forced acting. Listen to the same short voice-note script through each supported TTS route. Keep examples as evaluation cases rather than forcing one canned personality onto every persona.

## Sources

- [Google prompt design](https://ai.google.dev/gemini-api/docs/prompting-strategies): clear, specific instructions and varied examples; iteration is necessary. This supports simplifying competing directives, not a guarantee of a particular response.
- [Google TTS guide](https://ai.google.dev/gemini-api/docs/speech-generation) and [generateContent TTS metadata](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation): verbatim transcript versus sustained delivery metadata and momentary inline vocal events. Prefer short style adjustments and let the selected voice carry identity.
- [Google image prompting](https://ai.google.dev/gemini-api/docs/image-generation): explicit scene intent, composition and reference images support control and character consistency.
- [React portals](https://react.dev/reference/react-dom/createPortal): escape clipping ancestors; portal events still follow the React tree.
- [HTML media looping](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loop): repeats playback at the end of the clip.

## Verification and limits

38 unit/security/transport checks pass; TypeScript and production build pass. Browser checks use isolated data, synthetic microphone input and mocked Google requests: both call transports, minimum ring period, real clip rollover during a delayed handshake, pickup/End cleanup, picker light/dark appearance, viewport bounds, custom emoji persistence and reaction context precedence. No paid generation, physical phone keyboard test or subjective listening/model-quality benchmark was performed. Changes are local; no deployment or push.


## Owner commit/push

Review and stage the intended changes in Source Control first (the checkout includes earlier calling work). Then run:

```powershell
git commit -m "Refine call ringback, message reactions and Gemini prompts"
git push origin main
```

The assistant did not commit or push.
