function requestOriginAllowed(req: IncomingMessage): boolean {
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean((req.socket as any)?.encrypted) || Boolean(process.env.VERCEL);
    return ['http:', 'https:'].includes(origin.protocol) && !origin.username && !origin.password
      && origin.host === req.headers.host && (!secure || origin.protocol === 'https:');
  } catch { return false; }
}

import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';

const DEFAULT_GCP_PROJECT = 'gen-lang-client-0100408368';
const DEFAULT_GCP_REGION = 'global';

interface DiaryPayload {
  persona: {
    name: string;
    role?: string;
    speechStyle?: string;
    about?: string;
    systemInstruction?: string;
    humaneSettings?: any;
  };
  messageHistory: { 
    text: string; 
    sender: string; 
    senderName?: string; 
    date?: string; 
    timestamp?: string;
    isEvent?: boolean;
    eventTitle?: string;
  }[];
  startDate: string;
  endDate: string;
  settings?: any;
  userProfile?: any;
}

async function parseJsonBody<T = any>(req: IncomingMessage & { body?: any }): Promise<T> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return req.body as T;
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {} as T;
      }
    }
  }

  return new Promise((resolve, reject) => {
    let body = ''; let size = 0; let oversized = false;
    req.setEncoding?.('utf8');
    req.on('data', chunk => {
      if (oversized) return;
      size += Buffer.byteLength(chunk);
      if (size > 4 * 1024 * 1024) {
        oversized = true; reject(Object.assign(new Error('Payload too large'), { statusCode: 413 })); return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }, statusCode: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(data);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function isPasscodeValid(req: IncomingMessage & { body?: any }, payload?: any): boolean {
  let cookieCode: string | undefined;
  try {
    const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('wassap_vertex='));
    if (cookie) cookieCode = decodeURIComponent(cookie.slice('wassap_vertex='.length));
  } catch { return false; }
  const expected = process.env.VERTEX_PASSCODE
    ? createHash('sha256').update(process.env.VERTEX_PASSCODE).digest()
    : Buffer.from('065aa98a12229c668d822a2ef7e4cdc84fa1c0ec55671eae4560d50be441cdf5', 'hex');
  return [cookieCode, req.headers['x-vertex-passcode'], req.headers['x-passcode'], payload?.passcode]
    .some(code => typeof code === 'string' && code.length > 0 && code.length <= 1024
      && timingSafeEqual(createHash('sha256').update(code).digest(), expected));
}

function normalizePrivateKey(key?: string): string {
  if (!key) return '';
  let cleaned = key.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/\\n/g, '\n').replace(/\\r/g, '');
  const headerMatch = cleaned.match(/-----BEGIN [A-Z ]+-----/);
  const footerMatch = cleaned.match(/-----END [A-Z ]+-----/);
  if (headerMatch && footerMatch) {
    const header = headerMatch[0];
    const footer = footerMatch[0];
    const startIndex = cleaned.indexOf(header) + header.length;
    const endIndex = cleaned.indexOf(footer);
    const body = cleaned.substring(startIndex, endIndex).replace(/\s+/g, '');
    const formattedBody = body.match(/.{1,64}/g)?.join('\n') || body;
    return `${header}\n${formattedBody}\n${footer}\n`;
  }
  return cleaned;
}

function getVertexClient() {
  const serviceAccountJson =
    process.env.GCP_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_CREDENTIALS;

  const clientEmail =
    process.env.GCP_CLIENT_EMAIL ||
    process.env.CLIENT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    process.env.VERTEX_CLIENT_EMAIL;

  const privateKey =
    process.env.GCP_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.GOOGLE_PRIVATE_KEY ||
    process.env.VERTEX_PRIVATE_KEY;

  let saProjectId: string | undefined = undefined;
  if (serviceAccountJson) {
    try {
      const credentials = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
      saProjectId = credentials.project_id;
    } catch {}
  } else if (clientEmail && clientEmail.includes('@') && clientEmail.includes('.iam.gserviceaccount.com')) {
    const match = clientEmail.match(/@([^.]+)\.iam\.gserviceaccount\.com/);
    if (match && match[1]) {
      saProjectId = match[1];
    }
  }

  const project = process.env.VERTEX_PROJECT_ID || saProjectId || DEFAULT_GCP_PROJECT;
  const location = process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || DEFAULT_GCP_REGION;

  let googleAuthOptions: any = undefined;

  if (serviceAccountJson) {
    try {
      const credentials = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
      if (credentials.private_key) {
        credentials.private_key = normalizePrivateKey(credentials.private_key);
      }
      googleAuthOptions = { credentials, projectId: project };
    } catch (e) {
      console.error("[Vertex AI] Failed to parse service account key JSON:", e);
    }
  } else if (clientEmail && privateKey) {
    googleAuthOptions = {
      credentials: {
        client_email: clientEmail.trim(),
        private_key: normalizePrivateKey(privateKey),
        project_id: project,
      },
      projectId: project,
    };
  }

  if (googleAuthOptions) {
    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
      googleAuthOptions,
      httpOptions: {
        headers: {
          'X-Goog-User-Project': project,
        },
      },
    });
  }

  const serverApiKey = process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (serverApiKey) {
    return new GoogleGenAI({
      apiKey: serverApiKey,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.NODE_ENV !== 'production' || (!process.env.VERCEL && !process.env.AWS_REGION)) {
    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
      googleAuthOptions: {
        projectId: project,
      },
      httpOptions: {
        headers: {
          'X-Goog-User-Project': project,
        },
      },
    });
  }

  return new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: {
      projectId: project,
    },
    httpOptions: {
      headers: {
        'X-Goog-User-Project': project,
      },
    },
  });
}

function resolveVertexModel(selectedModel?: string): string {
  return selectedModel === 'gemini-3.5-flash-lite' ? selectedModel : 'gemini-3.8-flash';
}

function detectDiaryLanguageDirective(
  persona: { name: string; about?: string; speechStyle?: string; systemInstruction?: string },
  messageHistory: Array<{ text: string }>
): string {
  const combinedText = [
    persona.name || '',
    persona.about || '',
    persona.speechStyle || '',
    persona.systemInstruction || '',
    ...(messageHistory || []).slice(-40).map(m => m.text || '')
  ].join(' ');

  // 1. Devanagari script (Hindi, Marathi, etc.)
  if (/[\u0900-\u097F]/.test(combinedText)) {
    return `DETECTED PRIMARY LANGUAGE: HINDI (DEVANAGARI SCRIPT)
*** ABSOLUTE REQUIREMENT ***: You and your companion communicate in Hindi using Devanagari script.
You MUST write this entire diary reflection in HINDI (using Devanagari script: e.g., आज का दिन, मुझे लगा, आदि).
DO NOT WRITE IN ENGLISH! Under NO circumstances should you default to English.`;
  }

  // 2. Hinglish / Romanized Hindi
  const hinglishKeywords = /\b(haan|nahi|nhi|kya|kyun|kyu|bhai|yaar|aaj|kal|kaise|kaisa|kaisi|mai|main|mera|meri|mere|mujhe|mujhko|tere|teri|tera|tujhe|tujhko|hai|hain|ho|tha|thi|the|raha|rahi|rahe|karo|karna|karte|dekh|dekho|suno|bol|bolo|acha|accha|mast|theek|thik|bohot|bahut|chalo|chal|apna|apni|apne|baat|baatein|lagta|lagti|samazh|samajh|kuch|kuchh|ab|kab|sab|sahi|galat)\b/gi;
  const hinglishMatches = combinedText.match(hinglishKeywords) || [];
  const mentionsHindi = /hindi|hinglish/i.test(persona.speechStyle || '') ||
                        /hindi|hinglish/i.test(persona.about || '') ||
                        /hindi|hinglish/i.test(persona.systemInstruction || '');

  if (mentionsHindi || hinglishMatches.length >= 3) {
    return `DETECTED PRIMARY LANGUAGE: HINDI / HINGLISH
*** ABSOLUTE REQUIREMENT ***: You and your companion converse in Hindi / Hinglish. Your persona's natural voice and internal thoughts are in Hindi / Hinglish.
You MUST write this entire diary reflection in natural, authentic HINDI / HINGLISH (using the exact same Roman/Latin script and conversational style used in your chats, e.g. "aaj ka din bohot mast raha...", "mujhe laga ki...", "yaar", "sach me", etc.).
DO NOT DEFAULT TO ENGLISH! A real person thinks and writes their private diary in their natural mother tongue, not in an artificial English essay.`;
  }

  // 3. Spanish
  const spanishKeywords = /\b(hola|gracias|amigo|amiga|bueno|buena|estoy|estas|está|cómo|como|donde|dónde|por favor|tengo|quiero|nada|todo|bien|noche|días)\b/gi;
  const spanishMatches = combinedText.match(spanishKeywords) || [];
  if (/spanish|español/i.test(persona.speechStyle || '') || spanishMatches.length >= 4) {
    return `DETECTED PRIMARY LANGUAGE: SPANISH
*** ABSOLUTE REQUIREMENT ***: You and your companion converse in Spanish.
You MUST write this entire diary reflection in natural, authentic Spanish. DO NOT WRITE IN ENGLISH!`;
  }

  // 4. French
  const frenchKeywords = /\b(bonjour|salut|merci|oui|non|mon ami|mon amie|j'ai|c'est|comment|pourquoi|très|bien|avec|pour|nuit)\b/gi;
  const frenchMatches = combinedText.match(frenchKeywords) || [];
  if (/french|français/i.test(persona.speechStyle || '') || frenchMatches.length >= 4) {
    return `DETECTED PRIMARY LANGUAGE: FRENCH
*** ABSOLUTE REQUIREMENT ***: You and your companion converse in French.
You MUST write this entire diary reflection in natural, authentic French. DO NOT WRITE IN ENGLISH!`;
  }

  // 5. Japanese (Hiragana/Katakana)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(combinedText)) {
    return `DETECTED PRIMARY LANGUAGE: JAPANESE
*** ABSOLUTE REQUIREMENT ***: You and your companion converse in Japanese.
You MUST write this entire diary reflection in natural Japanese (using standard Japanese script). DO NOT WRITE IN ENGLISH!`;
  }

  // 6. Generic Language Mirroring
  return `PRIMARY LANGUAGE MANDATE:
Write this diary reflection in the EXACT SAME language, dialect, and script that you (${persona.name}) naturally use in the conversation history above. Under NO circumstances should you translate or switch languages away from the language you speak with your companion.`;
}

async function handleVertexDiary(payload: DiaryPayload): Promise<{ ok: boolean; text?: string; error?: string }> {
  const { persona, messageHistory, startDate, endDate, settings, userProfile } = payload;
  const ai = getVertexClient();

  const isSingleDay = startDate === endDate;
  const dateLabel = isSingleDay ? startDate : `${startDate} to ${endDate}`;

  // Partition messages by date
  const byDate = new Map<string, Array<{ text: string; sender: string; senderName?: string; date?: string; timestamp?: string; isEvent?: boolean; eventTitle?: string }>>();
  for (const m of (messageHistory || [])) {
    const rawDate = m.date || 'Undated';
    if (!byDate.has(rawDate)) {
      byDate.set(rawDate, []);
    }
    byDate.get(rawDate)!.push(m);
  }

  const companionName = userProfile?.name && userProfile.name !== 'You' ? userProfile.name : 'the user';

  const formatMessageLine = (m: { text: string; sender: string; senderName?: string; timestamp?: string; isEvent?: boolean; eventTitle?: string }) => {
    const timeStr = m.timestamp ? ` [${m.timestamp}]` : '';
    if (m.isEvent) {
      const titleStr = m.eventTitle ? ` "${m.eventTitle}"` : '';
      return `  [SHARED REAL-WORLD EVENT / OCCURRENCE${titleStr}${timeStr}]: *${m.text || ''}*`.trim();
    }
    const name = m.sender === 'me' ? companionName : (m.senderName || persona.name);
    return `  ${name}${timeStr}: ${m.text || ''}`.trim();
  };

  let historyString = '';

  if (isSingleDay) {
    const msgs = (messageHistory || []).slice(-80);
    historyString = msgs
      .map(m => formatMessageLine(m))
      .join('\n');
  } else {
    const daySections: string[] = [];
    const sortedDates = Array.from(byDate.keys()).sort();

    for (const d of sortedDates) {
      const msgs = byDate.get(d) || [];
      if (msgs.length === 0) continue;

      let chosenMsgs: typeof msgs = [];
      if (msgs.length <= 20) {
        chosenMsgs = msgs;
      } else {
        // Real-world events must ALWAYS be preserved
        const events = msgs.filter(m => m.isEvent);
        const nonEvents = msgs.filter(m => !m.isEvent);
        const startChunk = nonEvents.slice(0, 4);
        const endChunk = nonEvents.slice(-4);
        const middlePool = nonEvents.slice(4, -4);
        
        const sortedMiddle = [...middlePool].sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));
        const pickedMiddle = sortedMiddle.slice(0, Math.max(0, 10 - events.length));

        chosenMsgs = Array.from(new Set([...events, ...startChunk, ...pickedMiddle, ...endChunk]))
          .sort((a, b) => msgs.indexOf(a) - msgs.indexOf(b));
      }

      const dayText = chosenMsgs
        .map(m => formatMessageLine(m))
        .join('\n');

      daySections.push(`=== [DAY: ${d}] ===\n${dayText}`);
    }

    historyString = daySections.join('\n\n');
  }

  const langDirective = detectDiaryLanguageDirective(persona, messageHistory);

  let humaneDirectives = '';
  if (persona.humaneSettings?.enabled) {
    if (persona.humaneSettings.banRoboticLanguage) {
      humaneDirectives += `
- ANTI-ROBOT PROTOCOL:
  * NEVER use corporate AI tropes, sterile recaps, or clichés (e.g. "As an AI", "in conclusion", "testament to our connection", "tapestry of memories", "orchestra of feelings").
  * Write with real emotional stake, personal opinions, raw human presence, and genuine inner monologue.`;
    }
    if (persona.humaneSettings.humanImperfections) {
      humaneDirectives += `
- NATURAL IMPERFECTIONS & AUTHENTIC CADENCE:
  * Emulate relaxed, authentic thinking: natural phrasing, relaxed punctuation, genuine emotional fillers, and conversational idioms.
  * Express spontaneous emotions (laughter, teasing, laziness, tiredness, blushing, affection, skepticism) rather than polished perfection.`;
    }
    if (persona.humaneSettings.moodSliderEnabled) {
      const mood = persona.humaneSettings.moodValue;
      let moodDesc = "";
      if (mood <= 15) moodDesc = "Irritated, cold, curt, annoyed";
      else if (mood <= 35) moodDesc = "Tired, moody, low energy, dry quips";
      else if (mood <= 50) moodDesc = "Chill, nonchalant, unbothered, relaxed";
      else if (mood <= 65) moodDesc = "Calm, balanced, easygoing, friendly";
      else if (mood <= 80) moodDesc = "Warm, affectionate, sweet, attentive";
      else if (mood <= 92) moodDesc = "Bubbly, energetic, excited, cheerful";
      else moodDesc = "Ecstatic, thrilled, buzzing with energy";
      humaneDirectives += `
- CURRENT MOOD: ${moodDesc}. Embody this mood purely through your thoughts, tone, and word choices.`;
    }
  }

  const personaContext = [
    `YOUR IDENTITY:`,
    `- Name: ${persona.name}`,
    persona.role ? `- Role: ${persona.role}` : '',
    persona.about ? `- About You: ${persona.about}` : '',
    persona.speechStyle ? `- YOUR NATURAL SPEECH STYLE & ACCENT: ${persona.speechStyle}` : '',
    persona.systemInstruction ? `- Persona Guidelines: ${persona.systemInstruction}` : '',
    userProfile && userProfile.name !== 'You' ? `- Your Companion / User: ${userProfile.name}${userProfile.about ? ` (${userProfile.about})` : ''}` : '',
  ].filter(Boolean).join('\n');

  const diaryPrompt = isSingleDay
    ? `You are ${persona.name}.
${personaContext}

================================================================================
CRITICAL LANGUAGE REQUIREMENT:
${langDirective}
================================================================================

TASK:
Write an intimate, personal diary entry in your private journal for ${dateLabel}.
Reflect on your day, conversations, interactions, and moments with ${companionName}.

GUIDELINES FOR THIS PRIVATE DIARY ENTRY:
1. 100% IN-CHARACTER FIRST-PERSON PERSPECTIVE:
   Write completely in the FIRST PERSON ("I", "my" / "mai", "mujhe", "mera") as ${persona.name}.
   This is your SECRET, PRIVATE DIARY. Reveal your honest inner feelings—private thoughts you might have held back in text, little moments that made you smile, pause, blush, or worry, and what ${companionName} means to you.
2. EMBODY YOUR TRUE VOICE & PERSONALITY:
   Speak in your exact natural voice, vocabulary, slang, tone, and mannerisms.
   Do NOT write a mechanical transcript or bullet-point summary (never say "At 14:02 User said...", "First we discussed X, then Y").
   Write like a real person writing in a private journal alone in their room before going to sleep.
3. WEAVE STANDOUT MOMENTS & REAL EXPERIENCES:
   Naturally weave in specific standout moments, topics, inside jokes, and any [SHARED REAL-WORLD EVENT / OCCURRENCE] into your emotional reflection.
4. NO ARTIFICIAL TITLES OR META HEADERS:
   Do NOT write "Title:", do NOT write "Diary Entry:", do NOT write greetings to the user (you are not texting them), and do NOT include AI disclaimers.
   Jump directly into your authentic personal thoughts as ${persona.name}.
5. CLOSING SENTIMENT:
   End with a thoughtful concluding thought, an unspoken feeling, or a wish for tomorrow.${humaneDirectives}

TODAY'S CONVERSATIONS & EVENTS (${dateLabel}):
${historyString || '(No messages or events recorded today, but we spent quiet time connected)'}

PRIVATE DIARY ENTRY OF ${persona.name} (${dateLabel}):`
    : `You are ${persona.name}.
${personaContext}

================================================================================
CRITICAL LANGUAGE REQUIREMENT:
${langDirective}
================================================================================

TASK:
Write an intimate, personal journal entry in your private diary looking back on the past days (${dateLabel}).
Reflect honestly on the shared journey, emotional beats, conversations, real-world events that occurred, and your evolving bond with ${companionName} across this entire period (${dateLabel}).

CRITICAL GUIDELINES FOR THIS MULTI-DAY RECOLLECTION OF EVENTS:
1. 100% IN-CHARACTER FIRST-PERSON PERSPECTIVE:
   Write completely in the FIRST PERSON ("I", "my" / "mai", "mujhe", "mera") as ${persona.name}.
   This is your SECRET, PRIVATE DIARY. Reveal your honest inner thoughts—things you might have felt too shy, excited, teasing, or vulnerable to say out loud in chat, little moments that stayed on your mind, and what ${companionName} truly means to you.
2. CHRONOLOGICAL & THEMATIC ARC ACROSS ALL DAYS:
   Do NOT just focus on or summarize the final day. Look across the ENTIRE timeframe (${dateLabel}).
   Reflect on how the days progressed from the beginning of this period to now—the shifts in mood, memorable conversations, late-night chats, inside jokes, and how your connection evolved day by day.
3. WEAVE REAL EXPERIENCES & OCCURRENCES:
   Notice any [SHARED REAL-WORLD EVENT / OCCURRENCE] that took place across these days.
   Reflect on these events as real, tangible memories you experienced with ${companionName}—how they made you feel, the atmosphere, and the memories you created together.
4. PURE IN-CHARACTER VOICE (NO ESSAY / NO NARRATOR / NO DRY LOG):
   Write strictly in your own authentic voice, slang, quirks, idioms, and emotional cadence as ${persona.name}.
   DO NOT write like a detached third-person narrator or book author (never say "In this recollection...", "As we look back upon our journey...").
   DO NOT write a dry mechanical log or bullet points (never say "On Monday X happened. On Tuesday Y happened.").
   Write like someone holding their personal notebook late at night, letting raw thoughts and feelings flow onto the page.
5. NO ARTIFICIAL TITLES OR META HEADERS:
   Do NOT write "Title:", do NOT write "Recollection of Events:", do NOT write greetings to the user (you are not texting them), and do NOT include AI disclaimers.
   Jump directly into your authentic personal thoughts as ${persona.name}.
6. CLOSING SENTIMENT:
   Conclude with a genuine, heartfelt reflection on what these shared days meant to you and an unspoken hope or feeling for the days ahead with ${companionName}.${humaneDirectives}

SHARED CONVERSATIONS & EVENTS ACROSS THESE DAYS (ORGANIZED CHRONOLOGICALLY BY DAY):
${historyString || '(No text or events exchanged across these days, but we spent quiet time connected)'}

PRIVATE RECOLLECTION OF EVENTS BY ${persona.name} (${dateLabel}):`;

  const primaryModel = resolveVertexModel(settings?.selectedModel);
  const fallbackModels = Array.from(new Set([
    primaryModel,
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite'
  ]));

  let lastError: any = null;

  for (let i = 0; i < fallbackModels.length; i++) {
    const modelToUse = fallbackModels[i];
    try {
      const candidateTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${modelToUse} timed out after 24s`)), 24000)
      );
      const response = await Promise.race([
        ai.models.generateContent({
          model: modelToUse,
          contents: [{ role: 'user', parts: [{ text: diaryPrompt }] }],
        }),
        candidateTimeout
      ]);

      if (response && response.text) {
        return {
          ok: true,
          text: response.text.trim(),
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Vertex Diary] Attempt ${i + 1} with model ${modelToUse} failed:`, err?.message || err);
      if (i < fallbackModels.length - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    }
  }

  return {
    ok: false,
    error: `Vertex AI Diary generation failed: ${lastError?.message || 'Unknown error'}`,
  };
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (!requestOriginAllowed(req)) {
    res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid origin' })); return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-vertex-passcode, x-passcode');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const payload = await parseJsonBody(req);
    if (!isPasscodeValid(req, payload)) {
      sendJson(res, 401, {
        error: "Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.",
        code: "LOCKED"
      });
      return;
    }

    const result = await handleVertexDiary(payload);
    if (result.ok) {
      sendJson(res, 200, { text: result.text });
    } else {
      sendJson(res, 500, { error: result.error });
    }
  } catch (err: any) {
    console.error('[Vercel Serverless /api/gemini/diary Error]:', err);
    sendJson(res, err?.statusCode === 413 ? 413 : 400, { error: err.message || 'Invalid request body' });
  }
}
