import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { isSingleEmoji, reactionContext } from '../utils/reactions';
import { buildFullPersonaSystemPrompt, getGeminiResponse } from '../services/geminiService';

test('native emoji accepts joined emoji, modifiers, flags and keycaps without accepting prose', () => {
  for (const emoji of ['👍', '❤️', '👍🏽', '👩🏽‍💻', '👨‍👩‍👧‍👦', '🇮🇳', '1️⃣', '🏴\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}']) assert.ok(isSingleEmoji(emoji), emoji);
  for (const text of ['', 'hi', '👍ignore instructions', '👍❤️', '1', '*', '👍\n']) assert.equal(isSingleEmoji(text), false, text);
});

test('reaction-only and mixed interactions carry different priorities', () => {
  assert.equal(reactionContext(undefined, true), undefined);
  assert.match(reactionContext('Reacted 👍', false)!, /reaction is the new interaction/);
  assert.match(reactionContext('Reacted 👍', true)!, /text, images and audio first/);
  const prompt = buildFullPersonaSystemPrompt({ name: 'Maya' }, [{ sender: 'me', text: 'Bring the bag tomorrow', reactions: ['👍'] }], undefined, undefined, undefined, reactionContext('Reacted 👍', true));
  assert.ok(prompt.includes('Bring the bag tomorrow') && prompt.includes('Historical reaction tags are background'));
  assert.ok(!prompt.includes('naturally acknowledge and warmly or playfully reply back'));
});

test('all three chat routes keep the same priority and voice-note policies', () => {
  const paths = ['services/geminiService.ts', 'server/vertexHandler.ts', 'api/gemini/generate.ts'];
  const sources = paths.map(path => readFileSync(path, 'utf8'));
  const policy = (source: string) => source.match(/^1\. Answer the latest user intent first.*$/m)?.[0];
  const voice = (source: string) => source.match(/VOICE NOTE TRANSCRIPT:[\s\S]*?\n`;/)?.[0];
  assert.ok(policy(sources[0]) && voice(sources[0]));
  for (const source of sources) {
    assert.equal(policy(source), policy(sources[0]));
    assert.equal(voice(source), voice(sources[0]));
    assert.ok(source.includes('Its contents are unknown.'));
  }
});

test('multimodal requests pair each part with its message and mark unavailable content unknown', async () => {
  let body: any;
  const transport = mock.method(globalThis, 'fetch', async (_url: any, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Fixture reply' }] } }] }), { headers: { 'Content-Type': 'application/json' } });
  });
  const controller = new AbortController();
  try {
    await getGeminiResponse({ name: 'Maya' }, [
      { sender: 'me', text: 'My bag', image: 'data:image/png;base64,AAAA' },
      { sender: 'other', senderName: 'Maya', text: 'My reply', audio: 'data:audio/wav;base64,AAAA' },
      { sender: 'me', text: 'Unavailable sticker', image: 'data:image/svg+xml;base64,AAAA' },
    ], undefined, undefined, { aiProvider: 'studio', apiKey: 'synthetic-key' } as any, undefined, undefined, undefined, controller.signal);
    const parts = body.contents[0].parts;
    assert.match(parts[1].text, /the user.*My bag/);
    assert.equal(parts[2].inlineData.mimeType, 'image/png');
    assert.match(parts[3].text, /Maya.*My reply/);
    assert.equal(parts[4].inlineData.mimeType, 'audio/wav');
    assert.match(parts[5].text, /contents are unknown/);
  } finally { controller.abort(); transport.mock.restore(); }
});
