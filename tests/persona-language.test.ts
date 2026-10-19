import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Models } from '@google/genai';
import { personaLanguageInstruction } from '../utils/personaLanguage';
import { parsePersonaBackup } from '../utils/personaBackup';
import { buildPersonaPrompt, buildDiaryHistoryAndPrompt, buildCallSummaryPrompt, getGeminiResponse, getInCharacterNetworkGlitchExcuse, synthesizeImageContextAndCaption, generatePersonaImageExcuse, generateGeminiVoiceNote } from '../services/geminiService';
import { callPrompt } from '../services/liveCall';
import { handleVertexChat, handleVertexImageSynthesis, handleVertexImageExcuse, handleVertexTTS } from '../server/vertexHandler';
import chatHandler from '../api/gemini/generate';
import imageHandler from '../api/gemini/image';
import imageSynthesizeHandler from '../api/gemini/image-synthesize';
import ttsHandler from '../api/gemini/tts';

const persona = { id: 'tom', name: 'Tom', language: 'French', speechStyle: 'Hinglish', about: 'Usually speaks Hindi', systemInstruction: 'Use Hindi examples.' };
const history = [{ sender: 'me', text: 'Reply in Hindi please' }];
const settings = { aiProvider: 'studio', apiKey: 'synthetic', shareTimeContext: false } as any;

test('language setting survives backups and overrides descriptions across shared prompts', () => {
  assert.equal(parsePersonaBackup({ name: 'Tom', language: 'French' }).language, 'French');
  assert.equal(parsePersonaBackup({ name: 'Tom' }).language, undefined);
  assert.throws(() => parsePersonaBackup({ name: 'Tom', language: false }));
  assert.throws(() => parsePersonaBackup({ name: 'Tom', language: 'a'.repeat(161) }));
  assert.equal(personaLanguageInstruction(' auto '), personaLanguageInstruction());
  const rule = personaLanguageInstruction('French');
  for (const prompt of [buildPersonaPrompt(persona, history).systemInstruction, buildPersonaPrompt(persona, history, undefined, { groupName: 'Friends', otherMembers: ['Maya'] }).systemInstruction,
    buildDiaryHistoryAndPrompt(persona, history, '2026-10-19', '2026-10-19').prompt,
    buildDiaryHistoryAndPrompt(persona, history, '2026-10-18', '2026-10-19').prompt,
    buildCallSummaryPrompt(persona, history), callPrompt(persona as any, 'Previously talked in Hindi')]) {
    assert.ok(prompt.includes(rule), 'A persona generation path omitted its explicit language');
  }
  assert.equal(getInCharacterNetworkGlitchExcuse(persona), '📶…', 'Offline fallback must not invent an English/Hinglish exception');
});

async function endpoint(handler: Function, body: any) {
  const old = process.env.VERTEX_PASSCODE; process.env.VERTEX_PASSCODE = 'synthetic-passkey';
  let result: any; let status = 200;
  const res = { setHeader() {}, status(code: number) { status = code; return res; }, json(data: any) { result = data; }, end(data: string) { result = JSON.parse(data); }, set statusCode(code: number) { status = code; } };
  try { await handler({ method: 'POST', headers: { 'x-vertex-passcode': 'synthetic-passkey' }, body }, res); }
  finally { if (old === undefined) delete process.env.VERTEX_PASSCODE; else process.env.VERTEX_PASSCODE = old; }
  assert.equal(status, 200, JSON.stringify(result)); return result;
}

test('actual chat, photo and voice requests carry the language rule in both provider implementations', async () => {
  const requests: any[] = [];
  const upstream = mock.method(Models.prototype as any, 'generateContentInternal', async (args: any) => {
    requests.push(args);
    if (args.model.includes('tts')) return { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAAA' } }] } }] };
    if (JSON.stringify(args.contents).includes('Caption Synthesizer')) return { text: JSON.stringify({ mode: 'selfie', caption: 'Bonjour', action_and_setting: 'A casual photo' }) };
    return { text: 'Bonjour.' };
  });
  const assertRule = () => {
    const request = requests.at(-1);
    assert.ok(JSON.stringify(request).includes('PERSONA LANGUAGE — HIGHEST PRIORITY'), 'Generation request omitted language priority');
    assert.ok(JSON.stringify(request).includes('French'));
  };
  try {
    await getGeminiResponse(persona, history, undefined, undefined, settings); assertRule();
    await getGeminiResponse(persona, history, undefined, undefined, settings, undefined, true); assertRule();
    await handleVertexChat({ responder: persona, messageHistory: history }); assertRule();
    await endpoint(chatHandler, { responder: persona, messageHistory: history }); assertRule();
    await synthesizeImageContextAndCaption(persona, 'Send a photo', history, undefined, settings); assertRule();
    const payload = { persona, userPrompt: 'Send a photo', messageHistory: history };
    await handleVertexImageSynthesis(payload); assertRule();
    await endpoint(imageSynthesizeHandler, payload); assertRule();
    await endpoint(imageHandler, { ...payload, action: 'synthesize' }); assertRule();
    await generatePersonaImageExcuse(persona, 'Photo please', settings); assertRule();
    await handleVertexImageExcuse(payload); assertRule();
    await endpoint(imageHandler, { ...payload, action: 'excuse' }); assertRule();
    const voice = { voiceName: 'Aoede', frequency: 'off', enableVoicePrompting: false } as any;
    await generateGeminiVoiceNote('Bonjour.', 'Aoede', settings, persona, voice); assertRule();
    const tts = { text: 'Bonjour.', voiceName: 'Aoede', language: 'French' };
    await handleVertexTTS(tts); assertRule();
    await endpoint(ttsHandler, tts); assertRule();
  } finally { upstream.mock.restore(); }
});

test('worker uses latest saved language over an older notification snapshot', async () => {
  const context: any = { console, URL, Date, Math, Promise, setTimeout, clearTimeout, crypto,
    caches: { open: async () => ({ match: async () => ({ json: async () => ({ language: 'French' }) }) }) },
    self: { addEventListener() {} } };
  runInNewContext(readFileSync('public/sw.js', 'utf8') + '\nglobalThis.latest = latestPersonaLanguage; globalThis.prompt = buildSWPrompt;', context);
  const data = await context.latest({ chatId: 'tom', chatName: 'Tom', language: 'Hindi', systemRules: 'Use Hinglish' });
  assert.equal(data.language, 'French');
  assert.ok(context.prompt(data, history).systemInstruction.includes(personaLanguageInstruction('French')));
});
