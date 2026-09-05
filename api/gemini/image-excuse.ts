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

    const { persona, userPrompt, settings } = payload;
    const ai = getVertexClient();

    let moodState = "casual";
    if (persona?.humaneSettings?.enabled && persona?.humaneSettings?.moodSliderEnabled) {
      const mood = persona.humaneSettings.moodValue;
      if (mood <= 30) moodState = "grumpy and annoyed";
      else if (mood <= 60) moodState = "chill and relaxed";
      else moodState = "bubbly and cheerful";
    }

    const excusePrompt = `You are ${persona?.name || 'Friend'}.
About: ${persona?.about || ''}
Role: ${persona?.role || ''}
Speech Style: ${persona?.speechStyle || 'Casual text messaging'}
Current Mood: ${moodState}

The user sent: "${userPrompt || 'Send me a photo'}", asking for a photo or selfie, but right now you CANNOT take or send one (for instance: camera app crashed, terrible overhead lighting, phone is on 1% battery, or lens is all smudged).

TASK:
Write a single, natural, in-character text excuse explaining why you can't send a picture right now (e.g., "My camera app literally just crashed on me, hold on!", "Ugh terrible lighting right now haha, I'll send one later!", "Camera lens is completely fogged up right now lol").
RULES:
1. NEVER mention you are an AI or that an image model failed.
2. Maintain your persona's tone, slang, and speech style.
3. Keep it strictly 1 short sentence.`;

    const modelToUse = settings?.selectedModel || 'gemini-3.8-flash';
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [{ role: 'user', parts: [{ text: excusePrompt }] }],
    });

    sendJson(res, 200, {
      text: response.text?.trim() || "My camera app just crashed on me, I'll send one in a bit!"
    });
  } catch (error: any) {
    console.error("[Vertex AI Image Excuse Error]:", error);
    sendJson(res, 200, {
      text: "Camera app is acting up right now haha, I'll send one later!"
    });
  }
}
