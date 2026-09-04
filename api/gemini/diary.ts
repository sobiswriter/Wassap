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
  messageHistory: { text: string; sender: string; senderName?: string }[];
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
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      googleAuthOptions = { credentials };
    } catch (e) {
      console.error("[Vertex AI] Failed to parse service account key JSON:", e);
    }
  } else if (clientEmail && privateKey) {
    googleAuthOptions = {
      credentials: {
        client_email: clientEmail.trim(),
        private_key: privateKey.trim().replace(/\\n/g, '\n'),
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

function resolveVertexModel(selectedModel?: string): string {
  if (!selectedModel) return 'gemini-3.8-flash';
  return selectedModel.trim();
}

async function handleVertexDiary(payload: DiaryPayload): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const { persona, messageHistory, startDate, endDate, settings } = payload;
    const ai = getVertexClient();

    const historyString = (messageHistory || [])
      .map(m => {
        const name = m.sender === 'me' ? 'User' : (m.senderName || persona.name);
        return `${name}: ${m.text || ''}`.trim();
      })
      .join('\n');

    const diaryPrompt = `
You are ${persona.name}. 
ABOUT YOU: ${persona.about || ''}
ROLE: ${persona.role || ''}
STYLE: ${persona.speechStyle || ''}
NOTES: ${persona.systemInstruction || ''}

TASK:
Write a personal diary entry for ${startDate === endDate ? startDate : `${startDate} to ${endDate}`}.
In this diary entry, summarize the interaction you had with the User today based on the conversation history provided below.
CRITICAL: Include your personal feelings, thoughts, and reflections on the interaction as this persona. 
Make it feel like a private, emotional entry in your own personal journal.

CONVERSATION HISTORY:
${historyString}

DIARY ENTRY BY ${persona.name}:`;

    const modelToUse = resolveVertexModel(settings?.selectedModel);

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [{ role: 'user', parts: [{ text: diaryPrompt }] }],
    });

    return {
      ok: true,
      text: response.text || "I couldn't find the words today...",
    };
  } catch (error: any) {
    console.error("[Vertex AI Diary Error]:", error);
    const errMessage = error?.message || String(error);
    return {
      ok: false,
      error: `Vertex AI Diary generation failed: ${errMessage}`,
    };
  }
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
