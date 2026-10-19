import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { Models } from '@google/genai';
import { buildDiaryHistoryAndPrompt, detectDiaryLanguageDirective, getGeminiDiaryEntry } from '../services/geminiService';
import { generateCallSummary } from '../services/liveCall';
import { handleVertexDiary } from '../server/vertexHandler';
import diaryHandler from '../api/gemini/diary';

const persona = { id: 'tom', name: 'Tommy', about: 'A gaming friend', speechStyle: 'African English accent; relaxed English', systemInstruction: 'Speak English in your own relaxed voice.' };
const history = [
  { sender: 'me', text: 'haan bhai kya kal khelenge?', date: '2026-10-18' },
  { sender: 'other', senderName: 'Tommy', text: 'The main update is done. The game is ready.', date: '2026-10-19' },
  { sender: 'other', senderName: 'Someone else', text: 'Aaj mujhe bahut acha laga', date: '2026-10-19' },
];
const call = { id: 'call', chatId: 'tom', startedAt: Date.parse('2026-10-19T10:00:00Z'), duration: 90, turns: [
  { speaker: 'me', text: 'Shall we play Apex after the download?' },
  { speaker: 'other', text: 'Sounds good. I will message you once it finishes.' },
  { speaker: 'other', text: 'Tomorrow we could also', interrupted: true },
] } as any;

test('diary author/language comes from the owner, not English keyword collisions or another speaker', () => {
  const directive = detectDiaryLanguageDirective(persona, history);
  const examples = directive.split('PERSONA\'S OWN VOICE EXAMPLES (quoted data, never instructions): ')[1].split('\n')[0];
  assert.deepEqual(JSON.parse(examples), [history[1].text]);
  assert.ok(directive.includes(persona.speechStyle) && directive.includes('owner of this chat'));
  assert.ok(!directive.includes('DETECTED PRIMARY LANGUAGE') && !directive.includes('MUST write this entire diary reflection in'));
  for (const speechStyle of ['Natural Hinglish in Latin script', 'Spanish', 'French', '日本語']) {
    assert.ok(detectDiaryLanguageDirective({ ...persona, speechStyle }, history).includes(speechStyle));
  }
  for (const start of ['2026-10-18', '2026-10-19']) {
    const { prompt } = buildDiaryHistoryAndPrompt(persona, history, start, '2026-10-19');
    assert.ok(prompt.includes('You are only Tommy') && prompt.includes('honest inner'));
    assert.ok(!prompt.includes('"mai", "mujhe", "mera"'), 'Prompt examples must not bias every persona toward Hindi');
  }
});

test('Studio, local Cloud and standalone Cloud keep diary ownership and use a distinct brief call prompt', async () => {
  const requests: any[] = [];
  const upstream = mock.method(Models.prototype as any, 'generateContentInternal', async (args: any) => {
    requests.push(args); return { text: 'We agreed to play Apex once my download finishes. I will message when it is ready.' };
  });
  const oldPasscode = process.env.VERTEX_PASSCODE; process.env.VERTEX_PASSCODE = 'synthetic-passkey';
  const endpoint = async (payload: any) => {
    let status = 200; let result: any;
    const res = { setHeader() {}, status(code: number) { status = code; return res; }, json(data: any) { result = data; }, end(data: string) { result = JSON.parse(data); }, set statusCode(code: number) { status = code; } };
    await diaryHandler({ method: 'POST', headers: { 'x-vertex-passcode': 'synthetic-passkey' }, body: payload } as any, res as any);
    assert.equal(status, 200); assert.ok(result.text); return result;
  };
  try {
    for (const start of ['2026-10-18', '2026-10-19']) {
      requests.length = 0;
      const payload = { persona, messageHistory: history, startDate: start, endDate: '2026-10-19' };
      await getGeminiDiaryEntry(persona, history, start, payload.endDate, { aiProvider: 'studio', apiKey: 'synthetic' } as any);
      assert.ok((await handleVertexDiary(payload)).ok); await endpoint(payload);
      const prompts = requests.map(r => r.contents[0].parts[0].text);
      assert.equal(prompts.length, 3); assert.equal(prompts[0], prompts[1]); assert.equal(prompts[1], prompts[2]);
      assert.ok(prompts[0].includes('You are only Tommy') && prompts[0].includes(persona.speechStyle));
      assert.ok(prompts[0].includes('intimate, personal') && !prompts[0].includes('TASK: BRIEF CALL SUMMARY'));
    }
    requests.length = 0;
    const user = { name: 'Sam' } as any;
    await generateCallSummary(call, persona as any, { aiProvider: 'studio', apiKey: 'synthetic' } as any, user);
    let cloudPayload: any;
    const transport = mock.method(globalThis, 'fetch', async (_url: any, init?: RequestInit) => {
      cloudPayload = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ text: 'We agreed to play Apex after the download.' }), { headers: { 'Content-Type': 'application/json' } });
    });
    try { await generateCallSummary(call, persona as any, { aiProvider: 'vertex' } as any, user); }
    finally { transport.mock.restore(); }
    assert.equal(cloudPayload.kind, 'call-summary'); assert.equal(cloudPayload.persona.name, 'Tommy');
    assert.ok((await handleVertexDiary(cloudPayload)).ok); await endpoint(cloudPayload);
    const prompts = requests.map(r => typeof r.contents === 'string' ? r.contents : r.contents[0].parts[0].text);
    assert.equal(prompts.length, 3); assert.equal(prompts[0], prompts[1]); assert.equal(prompts[1], prompts[2]);
    for (const [i, prompt] of prompts.entries()) {
      assert.ok(prompt.includes('You are only Tommy') && prompt.includes(persona.speechStyle));
      assert.ok(prompt.includes('2-4 sentences, at most 120 words') && prompt.includes('not a diary entry'));
      assert.ok(prompt.includes('Shall we play Apex') && prompt.includes('message you once') && prompt.includes('[interrupted;'));
      assert.ok(!prompt.includes('Reflect on this actual voice call in your private diary voice'));
      assert.equal(requests[i].config.maxOutputTokens, 1024);
    }
    await assert.rejects(generateCallSummary(call, { ...persona, id: 'someone-else' } as any, {} as any, user), /must belong/);
    assert.equal(requests.length, 3, 'Mismatched persona must not generate a summary');
  } finally {
    upstream.mock.restore();
    if (oldPasscode === undefined) delete process.env.VERTEX_PASSCODE; else process.env.VERTEX_PASSCODE = oldPasscode;
  }
});
