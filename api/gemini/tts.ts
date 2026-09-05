import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';

const VERTEX_PASSCODE = 'Ness2020';
const DEFAULT_GCP_PROJECT = 'gen-lang-client-0100408368';
const DEFAULT_GCP_REGION = 'global';

interface VoiceDetail {
  name: string;
  gender: 'female' | 'male';
  trait: string;
  stylePrompt: string;
}

const GEMINI_TTS_VOICE_DETAILS: Record<string, VoiceDetail> = {
  // Female Voices (14)
  Achernar: { name: 'Achernar', gender: 'female', trait: 'Crisp & Articulate', stylePrompt: 'crisp, clear, and articulate' },
  Aoede: { name: 'Aoede', gender: 'female', trait: 'Breezy & Natural', stylePrompt: 'breezy, relaxed, and natural' },
  Autonoe: { name: 'Autonoe', gender: 'female', trait: 'Assertive & Expressive', stylePrompt: 'assertive, lively, and expressive' },
  Callirrhoe: { name: 'Callirrhoe', gender: 'female', trait: 'Playful & Melodic', stylePrompt: 'playful, melodic, and cheerful' },
  Despina: { name: 'Despina', gender: 'female', trait: 'Gentle & Smooth', stylePrompt: 'gentle, sweet, and smooth' },
  Erinome: { name: 'Erinome', gender: 'female', trait: 'Soft & Relaxed', stylePrompt: 'soft, warm, and relaxed' },
  Gacrux: { name: 'Gacrux', gender: 'female', trait: 'Mature & Measured', stylePrompt: 'mature, composed, and measured' },
  Kore: { name: 'Kore', gender: 'female', trait: 'Firm & Confident', stylePrompt: 'firm, strong, and confident' },
  Laomedeia: { name: 'Laomedeia', gender: 'female', trait: 'Friendly & Engaging', stylePrompt: 'friendly, upbeat, and engaging' },
  Leda: { name: 'Leda', gender: 'female', trait: 'Youthful & Warm', stylePrompt: 'youthful, caring, and warm' },
  Pulcherrima: { name: 'Pulcherrima', gender: 'female', trait: 'Lively & Dynamic', stylePrompt: 'lively, animated, and dynamic' },
  Sulafat: { name: 'Sulafat', gender: 'female', trait: 'Calm & Poised', stylePrompt: 'calm, elegant, and poised' },
  Vindemiatrix: { name: 'Vindemiatrix', gender: 'female', trait: 'Polished & Professional', stylePrompt: 'polished, clear, and professional' },
  Zephyr: { name: 'Zephyr', gender: 'female', trait: 'Bright & Cheerful', stylePrompt: 'bright, cheerful, and fast-paced' },

  // Male Voices (16)
  Achird: { name: 'Achird', gender: 'male', trait: 'Warm & Friendly', stylePrompt: 'warm, approachable, and friendly' },
  Algenib: { name: 'Algenib', gender: 'male', trait: 'Confident & Bold', stylePrompt: 'confident, bold, and energetic' },
  Algieba: { name: 'Algieba', gender: 'male', trait: 'Refined & Smooth', stylePrompt: 'refined, smooth, and pleasant' },
  Alnilam: { name: 'Alnilam', gender: 'male', trait: 'Resonant & Authoritative', stylePrompt: 'resonant, authoritative, and steady' },
  Charon: { name: 'Charon', gender: 'male', trait: 'Deep & Informative', stylePrompt: 'deep, calm, and informative' },
  Enceladus: { name: 'Enceladus', gender: 'male', trait: 'Husky & Intense', stylePrompt: 'husky, intense, and dramatic' },
  Fenrir: { name: 'Fenrir', gender: 'male', trait: 'Energetic & Passionate', stylePrompt: 'energetic, passionate, and excitable' },
  Iapetus: { name: 'Iapetus', gender: 'male', trait: 'Casual & Easygoing', stylePrompt: 'casual, easygoing, and relaxed' },
  Orus: { name: 'Orus', gender: 'male', trait: 'Firm & Grounded', stylePrompt: 'firm, calm, and grounded' },
  Puck: { name: 'Puck', gender: 'male', trait: 'Upbeat & Lively', stylePrompt: 'upbeat, lively, and playful' },
  Rasalgethi: { name: 'Rasalgethi', gender: 'male', trait: 'Rich & Baritone', stylePrompt: 'rich, deep baritone, and steady' },
  Sadachbia: { name: 'Sadachbia', gender: 'male', trait: 'Gentle & Reassuring', stylePrompt: 'gentle, reassuring, and kind' },
  Sadaltager: { name: 'Sadaltager', gender: 'male', trait: 'Distinct & Steady', stylePrompt: 'distinct, steady, and clear' },
  Schedar: { name: 'Schedar', gender: 'male', trait: 'Deep & Expressive', stylePrompt: 'deep, expressive, and thoughtful' },
  Umbriel: { name: 'Umbriel', gender: 'male', trait: 'Subtle & Quiet', stylePrompt: 'subtle, quiet, and reflective' },
  Zubenelgenubi: { name: 'Zubenelgenubi', gender: 'male', trait: 'Vibrant & Animated', stylePrompt: 'vibrant, animated, and spirited' },
};

function getVoiceDescriptor(voiceName?: string): VoiceDetail {
  if (voiceName && GEMINI_TTS_VOICE_DETAILS[voiceName]) {
    return GEMINI_TTS_VOICE_DETAILS[voiceName];
  }
  return GEMINI_TTS_VOICE_DETAILS['Aoede'];
}

interface TTSPayload {
  text: string;
  voiceName: string;
  stylePrompt?: string;
  personaName?: string;
  speechStyle?: string;
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
      googleAuthOptions = { credentials };
    } catch (e) {
      console.error("[Vertex AI TTS] Failed to parse service account key JSON:", e);
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

function pcmToWavDataUrl(pcmBase64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
  if (pcmBase64.startsWith('data:audio/')) return pcmBase64;
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const wavBuffer = Buffer.concat([header, pcmBuffer]);
  return `data:audio/wav;base64,${wavBuffer.toString('base64')}`;
}

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
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
    const payload = await parseJsonBody<TTSPayload>(req);

    if (!isPasscodeValid(req, payload)) {
      sendJson(res, 401, {
        error: "Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.",
        code: "LOCKED"
      });
      return;
    }

    const { text, voiceName, stylePrompt, personaName, speechStyle } = payload;
    if (!text || !text.trim()) {
      sendJson(res, 400, { error: 'Text is required for TTS generation' });
      return;
    }

    const selectedVoice = voiceName || 'Aoede';
    const voiceDescriptor = getVoiceDescriptor(selectedVoice);

    // Formulate Google Cloud recommended prompt steering directive if not already styled
    let steeredInput = text.trim();
    const hasExistingDirective = steeredInput.startsWith('Say the following') || steeredInput.startsWith('TTS the following');

    if (!hasExistingDirective) {
      const traitDesc = stylePrompt || voiceDescriptor?.stylePrompt || voiceDescriptor?.trait || 'natural and expressive';
      const promptParts = [
        personaName ? `as ${personaName}` : '',
        `with a ${traitDesc} voice delivery`,
        speechStyle ? `(personality & tone: ${speechStyle})` : ''
      ].filter(Boolean).join(' ');

      steeredInput = `Say the following in a natural WhatsApp voice note ${promptParts}: ${text.trim()}`;
    }

    const ai = getVertexClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ role: 'user', parts: [{ text: steeredInput }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: selectedVoice,
            }
          }
        }
      } as any
    });

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.find((p: any) => p.inlineData);

    if (!part || !part.inlineData?.data) {
      sendJson(res, 500, { error: 'Gemini TTS model did not return audio data' });
      return;
    }

    const mimeType = part.inlineData.mimeType || 'audio/pcm;rate=24000';
    const rawBase64 = part.inlineData.data;

    let sampleRate = 24000;
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    if (rateMatch && rateMatch[1]) {
      sampleRate = parseInt(rateMatch[1], 10);
    }

    const audioDataUrl = pcmToWavDataUrl(rawBase64, sampleRate);
    sendJson(res, 200, { audioData: audioDataUrl, mimeType: 'audio/wav' });
  } catch (error: any) {
    console.error('[API Error /tts]:', error);
    sendJson(res, 500, { error: error?.message || 'TTS generation failed' });
  }
}
