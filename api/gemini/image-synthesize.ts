import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';

const VERTEX_PASSCODE = 'Ness2020';
const DEFAULT_GCP_PROJECT = 'gen-lang-client-0100408368';
const DEFAULT_GCP_REGION = 'global';

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

  const project =
    process.env.VERTEX_PROJECT_ID ||
    process.env.GCP_PROJECT_ID ||
    process.env.GCP_PROJECT ||
    saProjectId ||
    DEFAULT_GCP_PROJECT;

  const location =
    process.env.VERTEX_LOCATION ||
    process.env.GCP_LOCATION ||
    process.env.GCP_REGION ||
    process.env.GOOGLE_CLOUD_LOCATION ||
    DEFAULT_GCP_REGION;

  let googleAuthOptions: any = undefined;

  if (serviceAccountJson) {
    try {
      const credentials = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
      if (credentials.private_key) {
        credentials.private_key = normalizePrivateKey(credentials.private_key);
      }
      googleAuthOptions = { credentials };
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
    };
  }

  if (googleAuthOptions) {
    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
      googleAuthOptions,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.NODE_ENV !== 'production' || (!process.env.VERCEL && !process.env.AWS_REGION)) {
    return new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });
  }

  const serverApiKey = process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (serverApiKey) {
    return new GoogleGenAI({
      apiKey: serverApiKey,
    });
  }

  return new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });
}

function parseJsonBody<T = any>(req: IncomingMessage & { body?: any }): Promise<T> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return Promise.resolve(req.body as T);
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      try { return Promise.resolve(JSON.parse(req.body)); } catch { return Promise.resolve({} as T); }
    }
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : ({} as T)); } catch (e) { reject(e); }
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

const EVERYDAY_PHOTO_ACTIVITIES = [
  "Brewing pour-over coffee or tea at the kitchen counter with a ceramic mug",
  "Curled up on a couch reading a paperback book under warm ambient lamp light",
  "Sitting at a table with over-ear headphones on, listening to music",
  "Sketching or writing in a journal with a pen in a cozy room",
  "Watering an indoor potted plant near a window",
  "Petting a cat or dog sitting beside them on the rug",
  "Holding a warm ceramic mug with both hands, looking out the window",
  "Sipping an iced matcha or bubble tea through a straw",
  "Enjoying a warm croissant or pastry at a small cafe table",
  "Eating noodles or a snack bowl at a casual kitchen counter",
  "Peeling an orange or fruit at the dining table with a half-smile",
  "Resting chin in palm across a table with a cafe beverage in front",
  "Working at a study desk with open notebook, pens, and laptop",
  "Reviewing handwritten notes with highlighters spread out",
  "Walking down a convenience store or market aisle holding a shopping basket",
  "Sitting cross-legged on the lawn in a park with sunglasses",
  "Leaning casually against a balcony or terrace railing taking in the breeze",
  "Taking a casual mirror selfie in an elevator or hallway mirror with their phone",
  "Propping phone against a mug on the table for a relaxed front-camera shot",
  "Checking a phone notification with an amused smile while leaning back on the couch",
  "Snapping a quick spontaneous front-camera selfie with messy casual hair",
];

function getSuggestedActivitiesSample(count: number = 7): string[] {
  const shuffled = [...EVERYDAY_PHOTO_ACTIVITIES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
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
    sendJson(res, 405, { error: 'Method not allowed' });
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

    const { persona, userPrompt, messageHistory, settings } = payload;
    const clientTimeContext = payload.clientTimeContext || settings?.clientTimeContext;
    const ai = getVertexClient();
    const sampledActivities = getSuggestedActivitiesSample(7);

    const historySnippet = (messageHistory || [])
      .slice(-6)
      .map((m: any) => `${m.sender === 'me' ? 'User' : (m.senderName || persona?.name || 'Persona')}: ${m.text || ''}`)
      .join('\n');

    const moodDesc = persona?.humaneSettings?.enabled && persona?.humaneSettings?.moodSliderEnabled
      ? `Persona Mood Value (0-100): ${persona.humaneSettings.moodValue}`
      : 'Persona Mood: Natural and conversational';

    const timeContextPrompt = clientTimeContext
      ? `\nCURRENT SYSTEM DATE & TIME CONTEXT:\n${clientTimeContext}\nCRITICAL LIGHTING & TIME RULE: The photo setting and lighting MUST realistically match this current time of day. If it is late at night or evening, use realistic indoor room lighting, bedside/desk lamp illumination, or cozy dim ambiance (never bright sunlight). If daytime, use natural room daylight or outdoor daylight.\n`
      : '';

    const synthesisPrompt = `You are a Context & Caption Synthesizer for an authentic, smartphone-style photo exchange in a messaging app.
The persona who will send the photo is:
Name: ${persona?.name || 'Friend'}
About: ${persona?.about || 'N/A'}
Role: ${persona?.role || 'N/A'}
Speech Style: ${persona?.speechStyle || 'Casual WhatsApp texting'}
System Guidelines: ${persona?.systemInstruction || 'N/A'}
${moodDesc}
${timeContextPrompt}
Recent Chat History:
${historySnippet || '(No prior messages)'}

User Request / Current Prompt:
"${userPrompt || 'Send me a photo'}"

TASK:
Determine what kind of photo the persona should send, following this strict PRIORITY HIERARCHY:

NATURAL ACTIVITY & POSE DIVERSITY:
Ensure natural variety in the persona's actions, posture, and setting. A persona checking a phone or taking a mirror selfie is a natural everyday option, but they should also engage in diverse real-life activities (drinking coffee, snacking, reading, writing, relaxing outdoors). Choose an authentic action that fits their mood, persona, and time of day.
Here is a fresh sample of everyday activity ideas for inspiration (pick one, blend them, or adapt naturally):
${sampledActivities.map(a => `- ${a}`).join('\n')}

1. USER QUERY FIRST (HIGHEST PRIORITY):
   If the user asks for something specific (e.g., "show me what you're eating", "send a pic of your dog", "show me your outfit", "send a selfie", "mirror selfie"), follow their exact instruction above everything else!

2. RECENT HISTORY (SECONDARY):
   If the user's request is generic (e.g., "send a photo", "send me a photo", "send an @image", "@img", "photo please", "send one", or "show me you"), inspect the recent conversation history. If the chat naturally mentions a current activity, food, drink, or place, align the photo to that ongoing conversation!

3. DIVERSE EVERYDAY VARIETY (FALLBACK):
   If no specific activity was recently discussed or requested, choose a believable everyday human activity suited to their persona, role, and current time of day from the inspiration list above or similar realistic everyday moments.

OUTPUT REQUIREMENTS:
1. "mode": "selfie" | "candid" | "pov"
   - "selfie": User specifically asks to see her/him, front-facing camera selfie, face, mirror selfie, or outfit where they hold the camera.
   - "candid": Third-person snapshot of the persona (e.g., taken quickly on a phone camera by someone else across the room, friend, or propped phone).
   - "pov": Food, objects, views, surroundings, pets, scenery, laptop, desk (first-person POV snapshot, NO person subject).
2. "caption": string
   - A realistic, in-character text comment matching the persona's tone, current mood, speech style, and photo context (e.g. 'Excuse the messy hair haha, literally just woke up', 'Look what just arrived!', 'Having this right now, send me yours too!').
   - NEVER sound robotic or assistant-like. Keep it casual like a real WhatsApp message.
3. "action_and_setting": string
   - A concise, context-aware description of the active action and environment (e.g. 'holding a warm mug sitting cross-legged on the couch under soft lamp light', 'taking a bite of ramen at a cozy street stall with steam rising', 'at a study desk writing in an open notebook with pens scattered around').
4. "user_wants_posed": boolean
   - If the user explicitly asks for a specific pose (e.g., 'look at the camera', 'smile', 'pose nicely', 'stand straight', 'pose for me', 'just a simple of u standing and posing'), set user_wants_posed: true and reflect that exact request in action_and_setting.
   - Otherwise, default user_wants_posed: false.

Return ONLY a valid JSON object with keys "mode", "user_wants_posed", "caption", and "action_and_setting".`;

    const maxRetries = 2;
    let responseText = "{}";

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        let modelToUse = settings?.selectedModel || 'gemini-3.8-flash';
        if (attempt > 1) {
          modelToUse = 'gemini-2.5-flash';
        }

        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: [{ role: 'user', parts: [{ text: synthesisPrompt }] }],
          config: {
            responseMimeType: "application/json",
          },
        });

        responseText = response.text || "{}";
        if (responseText && responseText.trim() !== "{}") {
          break;
        }

        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
      } catch (err: any) {
        console.warn(`[Image Synthesize Attempt ${attempt}/${maxRetries + 1} Error]:`, err?.message || err);
        if (attempt <= maxRetries) {
          const delay = attempt === 1 ? 1200 : 2500;
          await new Promise(r => setTimeout(r, delay + Math.random() * 400));
          continue;
        }
        throw err;
      }
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse JSON response from synthesizer");
      }
    }

    const mode = (parsed.mode === 'selfie' || parsed.mode === 'candid' || parsed.mode === 'pov')
      ? parsed.mode
      : (parsed.is_persona_subject ? 'selfie' : 'pov');
    const user_wants_posed = Boolean(parsed.user_wants_posed);

    sendJson(res, 200, {
      result: {
        mode,
        is_persona_subject: mode !== 'pov',
        user_wants_posed,
        caption: parsed.caption || "Snapped this just now!",
        action_and_setting: parsed.action_and_setting || "sitting on the living room couch",
      }
    });
  } catch (error: any) {
    console.error("[Vertex AI Image Synthesis Error]:", error);
    sendJson(res, 500, {
      error: `Synthesis failed: ${error?.message || String(error)}`
    });
  }
}
