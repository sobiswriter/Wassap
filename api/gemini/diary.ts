import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';

const VERTEX_PASSCODE = 'Ness2020';
const DEFAULT_GCP_PROJECT = 'gen-lang-client-0100408368';
const DEFAULT_GCP_REGION = 'global';

interface DiaryPayload {
  persona: {
    name: string;
    role?: string;
    speechStyle?: string;
    about?: string;
    systemInstruction?: string;
  };
  messageHistory: { text: string; sender: string; senderName?: string; date?: string; timestamp?: string }[];
  startDate: string;
  endDate: string;
  settings?: any;
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
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
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
  const headerCode = req.headers['x-vertex-passcode'] || req.headers['x-passcode'];
  const bodyCode = payload?.passcode;
  return headerCode === VERTEX_PASSCODE || bodyCode === VERTEX_PASSCODE;
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
  if (!selectedModel) return 'gemini-3.8-flash';
  return selectedModel.trim();
}

async function handleVertexDiary(payload: DiaryPayload): Promise<{ ok: boolean; text?: string; error?: string }> {
  const { persona, messageHistory, startDate, endDate, settings } = payload;
  const ai = getVertexClient();

  const isSingleDay = startDate === endDate;
  const dateLabel = isSingleDay ? startDate : `${startDate} to ${endDate}`;

  // Partition messages by date
  const byDate = new Map<string, Array<{ text: string; sender: string; senderName?: string; date?: string; timestamp?: string }>>();
  for (const m of (messageHistory || [])) {
    const rawDate = m.date || 'Undated';
    if (!byDate.has(rawDate)) {
      byDate.set(rawDate, []);
    }
    byDate.get(rawDate)!.push(m);
  }

  let historyString = '';

  if (isSingleDay) {
    const msgs = (messageHistory || []).slice(-60);
    historyString = msgs
      .map(m => {
        const name = m.sender === 'me' ? 'User' : (m.senderName || persona.name);
        const timeStr = m.timestamp ? ` [${m.timestamp}]` : '';
        return `${name}${timeStr}: ${m.text || ''}`.trim();
      })
      .join('\n');
  } else {
    const daySections: string[] = [];
    const sortedDates = Array.from(byDate.keys()).sort();

    for (const d of sortedDates) {
      const msgs = byDate.get(d) || [];
      if (msgs.length === 0) continue;

      let chosenMsgs: typeof msgs = [];
      if (msgs.length <= 16) {
        chosenMsgs = msgs;
      } else {
        const startChunk = msgs.slice(0, 4);
        const endChunk = msgs.slice(-4);
        const middlePool = msgs.slice(4, -4);
        
        const sortedMiddle = [...middlePool].sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));
        const pickedMiddle = sortedMiddle.slice(0, 8).sort((a, b) => msgs.indexOf(a) - msgs.indexOf(b));

        chosenMsgs = [...startChunk, ...pickedMiddle, ...endChunk];
      }

      const dayText = chosenMsgs
        .map(m => {
          const name = m.sender === 'me' ? 'User' : (m.senderName || persona.name);
          const timeStr = m.timestamp ? ` [${m.timestamp}]` : '';
          return `  ${name}${timeStr}: ${m.text || ''}`.trim();
        })
        .join('\n');

      daySections.push(`=== [DAY: ${d}] ===\n${dayText}`);
    }

    historyString = daySections.join('\n\n');
  }

  const numDays = Math.max(1, byDate.size);
  const isWeekly = numDays >= 5 && numDays <= 8;
  const genreName = isWeekly ? 'Weekly Chronicle of Events' : 'Recollection of Shared Events';

  const diaryPrompt = isSingleDay
    ? `You are ${persona.name}.
ABOUT YOU: ${persona.about || 'N/A'}
ROLE: ${persona.role || 'N/A'}
STYLE: ${persona.speechStyle || 'Authentic personal voice'}
NOTES: ${persona.systemInstruction || 'N/A'}

TASK:
Write an intimate, personal diary entry in your private journal for ${dateLabel}.
Reflect on your time, conversations, and interactions with the User today.

GUIDELINES FOR THIS DIARY ENTRY:
1. Write in the FIRST PERSON ("I", "my") completely in character as ${persona.name}.
2. This is your SECRET, PRIVATE DIARY. Reveal your honest inner feelings, private thoughts you might have held back in text, little moments that made you smile, pause, or worry, and what this person means to you.
3. NEVER write a mechanical transcript or bullet-point summary (do NOT say "At 14:02 User said...", "First we discussed X, then Y"). Instead, write like a real person writing in a notebook before going to sleep.
4. Naturally weave in specific standout moments, topics, or inside jokes from today's conversation into your emotional reflection.
5. End with a thoughtful concluding sentence, a wish for tomorrow, or an unspoken sentiment.

TODAY'S CONVERSATIONS & MOMENTS:
${historyString || '(No text exchanged today, but we spent quiet time connected)'}

PRIVATE DIARY ENTRY BY ${persona.name}:`
    : `You are ${persona.name}.
ABOUT YOU: ${persona.about || 'N/A'}
ROLE: ${persona.role || 'N/A'}
STYLE: ${persona.speechStyle || 'Authentic personal voice'}
NOTES: ${persona.systemInstruction || 'N/A'}

TASK:
Write an intimate, personal journal entry titled "${genreName}: ${dateLabel}".
Reflect on the journey, standout shared moments, emotional beats, conversations, and evolving bond with the User across this entire period (${dateLabel}).

CRITICAL GUIDELINES FOR THIS MULTI-DAY RECOLLECTION:
1. CHRONOLOGICAL & THEMATIC ARC: Do NOT just focus on or summarize the final day. Look across the ENTIRE timeframe (${dateLabel}). Reflect on how the days progressed—the standout moments, meaningful discussions, inside jokes, and quiet moments that occurred across the week/period.
2. FIRST-PERSON INTIMATE VOICE: Write in the FIRST PERSON ("I", "my") completely in character as ${persona.name}. Write like someone holding their private leather-bound journal before bed, candid and emotionally observant about the User.
3. WEAVE SPECIFIC MEMORIES ACROSS DAYS: Actively draw upon memorable highlights from earlier days as well as more recent ones, noting little details, questions asked, and how your conversations shifted day by day.
4. FLOWING NARRATIVE, NOT A DRY LOG: Avoid dry mechanical bullet points or rigid logs (do NOT write "On Monday X happened. On Tuesday Y happened."). Instead, write in rich, heartfelt literary paragraphs that capture the passage of time and the warmth of the connection naturally.
5. CLOSING SENTIMENT: Conclude with a deep, personal reflection on what these shared days meant to you and an unspoken hope for the days ahead.

SHARED CONVERSATIONS ACROSS THESE DAYS (ORGANIZED CHRONOLOGICALLY BY DAY):
${historyString || '(No text exchanged across these days, but we spent quiet time connected)'}

${genreName.toUpperCase()} BY ${persona.name}:`;

  const primaryModel = resolveVertexModel(settings?.selectedModel);
  const fallbackModels = Array.from(new Set([
    primaryModel,
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
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
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    sendJson(res, 400, { error: err.message || 'Invalid request body' });
  }
}
