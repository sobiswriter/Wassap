import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';

const VERTEX_PASSCODE = 'Ness2020';
const DEFAULT_GCP_PROJECT = 'gen-lang-client-0100408368';
const DEFAULT_GCP_REGION = 'global';

function getVertexClient() {
  const project = process.env.GCP_PROJECT_ID || process.env.GCP_PROJECT || DEFAULT_GCP_PROJECT;
  const location = process.env.GCP_LOCATION || process.env.GCP_REGION || DEFAULT_GCP_REGION;
  return new GoogleGenAI({ vertexAI: { project, location } });
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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
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
    const ai = getVertexClient();

    const historySnippet = (messageHistory || [])
      .slice(-6)
      .map((m: any) => `${m.sender === 'me' ? 'User' : (m.senderName || persona?.name || 'Persona')}: ${m.text || ''}`)
      .join('\n');

    const moodDesc = persona?.humaneSettings?.enabled && persona?.humaneSettings?.moodSliderEnabled
      ? `Persona Mood Value (0-100): ${persona.humaneSettings.moodValue}`
      : 'Persona Mood: Natural and conversational';

    const synthesisPrompt = `You are a Context & Caption Synthesizer for an authentic, smartphone-style photo exchange in a messaging app.
The persona who will send the photo is:
Name: ${persona?.name || 'Friend'}
About: ${persona?.about || 'N/A'}
Role: ${persona?.role || 'N/A'}
Speech Style: ${persona?.speechStyle || 'Casual WhatsApp texting'}
System Guidelines: ${persona?.systemInstruction || 'N/A'}
${moodDesc}

Recent Chat History:
${historySnippet || '(No prior messages)'}

User Request / Current Prompt:
"${userPrompt || 'Send me a photo'}"

TASK:
Determine what kind of photo the persona should send, following this strict PRIORITY HIERARCHY:

1. USER QUERY FIRST (HIGHEST PRIORITY):
   If the user asks for something specific (e.g., "show me what you're eating", "send a pic of your dog", "show me your outfit", "send a selfie"), follow their exact instruction above everything else!

2. RECENT HISTORY (SECONDARY):
   Only use conversation history if the user's request is generic (e.g., "send an @image", "@img", or "show me you"), and the chat naturally mentions a current activity, food, or place.

3. RANDOM EVERYDAY VARIETY (FALLBACK):
   If no specific activity was recently discussed or requested, randomly pick from one of these realistic everyday situations:
   - Living room couch browsing phone/laptop
   - Sitting in a car passenger seat
   - Kitchen counter making tea/coffee
   - Desk/study space with notebooks or laptop
   - Waiting outdoors at a bus stop or cafe table
   (DO NOT default to bed unless specifically mentioned in chat).

OUTPUT REQUIREMENTS:
1. "mode": "selfie" | "candid" | "pov"
   - "selfie": User specifically asks to see her/him, front-facing camera selfie, face, or outfit where they hold the camera.
   - "candid": Third-person snapshot of the persona (e.g., taken quickly on a phone camera or propped up).
   - "pov": Food, objects, views, surroundings, pets, scenery, laptop, desk (first-person POV snapshot, NO person subject).
2. "caption": string
   - A realistic, in-character text comment matching the persona's tone, current mood, speech style, and photo context (e.g. 'Excuse the bed hair haha, literally just woke up', 'Look what just arrived!', 'Having this right now, send me yours too!').
   - NEVER sound robotic or assistant-like. Keep it casual like a real WhatsApp message.
3. "action_and_setting": string
   - A concise, context-aware description of the action and environment (e.g. 'sitting on the living room couch with a mug', 'eating ramen at a cozy street food stall with steam rising', 'at a study desk with an open laptop and notebook').
4. "user_wants_posed": boolean
   - If the user explicitly asks for a specific pose (e.g., 'look at the camera', 'smile', 'pose nicely', 'stand straight', 'pose for me', 'just a simple of u standing and posing'), set user_wants_posed: true and reflect that exact request in action_and_setting.
   - Otherwise, default user_wants_posed: false.

Return ONLY a valid JSON object with keys "mode", "user_wants_posed", "caption", and "action_and_setting".`;

    const modelToUse = settings?.selectedModel || 'gemini-3.8-flash';
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [{ role: 'user', parts: [{ text: synthesisPrompt }] }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
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
