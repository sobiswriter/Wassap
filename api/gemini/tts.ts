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
  voiceModel?: string;
  stylePrompt?: string;
  paceSpeed?: string;
  pitchTone?: string;
  personaName?: string;
  speechStyle?: string;
}

function convertToVocalTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\[\*(](?:laughs?|laughing|cackles?)[\]\*)]/gi, '<laugh>')
    .replace(/[\[\*(](?:chuckles?|chuckling)[\]\*)]/gi, '<chuckle>')
    .replace(/[\[\*(](?:giggles?|giggling|snickers?|snickering)[\]\*)]/gi, '<chuckle>')
    .replace(/[\[\*(](?:sighs?|sighing|scoffs?|scoffing)[\]\*)]/gi, '<sigh>')
    .replace(/[\[\*(](?:gasps?|gasping)[\]\*)]/gi, '<gasp>')
    .replace(/[\[\*(](?:coughs?|coughing)[\]\*)]/gi, '<cough>')
    .replace(/[\[\*(](?:groans?|groaning|grunts?|grunting)[\]\*)]/gi, '<groan>')
    .replace(/[\[\*(](?:clears?\s+throat|throat-clearing)[\]\*)]/gi, '<throat-clearing>')
    .replace(/[\[\*(](?:yawns?|yawning)[\]\*)]/gi, '<yawn>')
    .replace(/[\[\*(](?:snorts?|snorting)[\]\*)]/gi, '<snort>')
    .replace(/[\[\*(](?:pants?|panting)[\]\*)]/gi, '<pant>')
    .replace(/[\[\*(](?:whispers?|whispering|softly)[\]\*)]/gi, '<whispers>')
    .replace(/[\[\*(](?:short\s+pause|brief\s+pause)[\]\*)]/gi, '<short pause>')
    .replace(/[\[\*(](?:long\s+pause|awkward\s+pause)[\]\*)]/gi, '<long pause>')
    .replace(/[\[\*(](?:pauses?|pause)[\]\*)]/gi, '<short pause>')
    .replace(/[\[\*(](?:sobs?|sobbing|crying)[\]\*)]/gi, '<sob>')
    .replace(/[\[\*(](?:cheers?|cheering)[\]\*)]/gi, '<cheer>')
    .replace(/[\[\*(](?:phew|relieved)[\]\*)]/gi, '<phew>')
    .replace(/<whisper>/gi, '<whispers>')
    .replace(/\[[a-zA-Z\s_-]{2,30}\]/g, '')
    .replace(/\*[a-zA-Z\s_-]{2,30}\*/g, '')
    // Strip emojis so TTS engine never vocalizes emoji labels
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
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

function getVertexClient(targetLocation?: string) {
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
  const location = targetLocation || process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || DEFAULT_GCP_REGION;

  let googleAuthOptions: any = undefined;

  if (serviceAccountJson) {
    try {
      const credentials = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
      if (credentials.private_key) {
        credentials.private_key = normalizePrivateKey(credentials.private_key);
      }
      googleAuthOptions = { credentials, projectId: project };
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

function pcmToWavDataUrl(pcmBase64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
  if (pcmBase64.startsWith('data:audio/')) return pcmBase64;
  if (pcmBase64.startsWith('UklGR')) return `data:audio/wav;base64,${pcmBase64}`;
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

    const { text, voiceName, voiceModel, stylePrompt, paceSpeed, pitchTone, personaName, speechStyle } = payload;
    if (!text || !text.trim()) {
      sendJson(res, 400, { error: 'Text is required for TTS generation' });
      return;
    }

    const selectedVoice = voiceName || 'Aoede';
    const isCustomVoice = selectedVoice.startsWith('voice_') || selectedVoice.startsWith('voicekey_');
    const voiceDescriptor = getVoiceDescriptor(selectedVoice);
    const selectedModel = voiceModel || 'gemini-3.8-flash-tts';
    const is38 = selectedModel.includes('3.8');

    // Build consolidated style directives
    const styleParts: string[] = [];
    if (stylePrompt) {
      styleParts.push(stylePrompt);
    } else if (!isCustomVoice && (voiceDescriptor?.stylePrompt || voiceDescriptor?.trait)) {
      styleParts.push(voiceDescriptor.stylePrompt || voiceDescriptor.trait);
    }
    if (paceSpeed && paceSpeed !== 'default') {
      styleParts.push(paceSpeed);
    }
    if (pitchTone) {
      styleParts.push(pitchTone);
    }
    if (speechStyle) {
      styleParts.push(speechStyle.replace(/^manner:\s*/i, ''));
    }
    const combinedStyle = styleParts.filter(Boolean).join(', ');

    const verbatimWithVocalTags = convertToVocalTags(text.trim());

    let audioBase64: string | undefined;
    let mimeType = 'audio/wav';

    // Build model candidate sequence with graceful fallbacks:
    // Try selectedModel -> gemini-3.8-flash-tts -> gemini-3.8-flash-lite-tts -> gemini-3.1-flash-tts-preview
    const modelsToTry: string[] = [
      selectedModel,
      ...(selectedModel !== 'gemini-3.8-flash-tts' ? ['gemini-3.8-flash-tts'] : []),
      ...(selectedModel !== 'gemini-3.8-flash-lite-tts' ? ['gemini-3.8-flash-lite-tts'] : []),
      ...(selectedModel !== 'gemini-3.1-flash-tts-preview' ? ['gemini-3.1-flash-tts-preview'] : [])
    ];

    const aiClient = getVertexClient('global');

    let lastError: any = null;
    for (const modelCandidate of modelsToTry) {
      const isCandidate38 = modelCandidate.includes('3.8');
      const styleDirective = combinedStyle || 'natural and expressive';
      const personaDirective = personaName ? `as ${personaName} ` : '';

      try {
        const userPart: any = {
          text: isCandidate38
            ? verbatimWithVocalTags
            : `Say the following in a natural WhatsApp voice note ${personaDirective}with a ${styleDirective} voice delivery, honoring vocal tags like <laugh>, <sigh>, <gasp>, <whisper>, <cough>: ${verbatimWithVocalTags}`
        };
        if (isCandidate38 && styleDirective) {
          userPart.speechMetadata = { style: styleDirective };
        }

        const generateConfig: any = {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: isCandidate38
              ? { voice: selectedVoice }
              : { prebuiltVoiceConfig: { voiceName: isCustomVoice ? 'Aoede' : selectedVoice } }
          }
        };

        const response = await aiClient.models.generateContent({
          model: modelCandidate,
          contents: [{ role: 'user', parts: [userPart] }],
          config: generateConfig as any
        });

        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.find((p: any) => p.inlineData);
        if (part && part.inlineData?.data) {
          audioBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'audio/wav';
          if (modelCandidate !== selectedModel) {
            console.info(`[Vertex TTS] Audio successfully synthesized with fallback model: ${modelCandidate}`);
          } else {
            console.info(`[Vertex TTS] Audio successfully synthesized with ${modelCandidate} in global`);
          }
          break;
        }
      } catch (genErr: any) {
        lastError = genErr;
        console.warn(`[Vertex TTS] Candidate ${modelCandidate} failed:`, genErr?.message || genErr);
      }
    }

    if (!audioBase64) {
      console.error('[Vertex TTS] All voice models failed. Last error:', lastError?.message || lastError);
      sendJson(res, 500, { error: `Gemini TTS model failed: ${lastError?.message || 'No audio returned'}` });
      return;
    }

    let sampleRate = 24000;
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    if (rateMatch && rateMatch[1]) {
      sampleRate = parseInt(rateMatch[1], 10);
    }

    const audioDataUrl = pcmToWavDataUrl(audioBase64, sampleRate);
    sendJson(res, 200, { audioData: audioDataUrl, mimeType: 'audio/wav' });
  } catch (error: any) {
    console.error('[API Error /tts]:', error);
    sendJson(res, 500, { error: error?.message || 'TTS generation failed' });
  }
}
