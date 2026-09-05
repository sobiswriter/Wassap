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

    const { model, action_and_setting } = payload;
    const mode = payload.mode || (payload.is_persona_subject ? 'selfie' : 'pov');
    const isSubject = mode === 'selfie' || mode === 'candid';

    let avatarBase64 = payload.avatarBase64;
    let avatarMimeType = payload.avatarMimeType || 'image/jpeg';

    if (!avatarBase64 && payload.avatarUrl && isSubject) {
      if (payload.avatarUrl.startsWith('data:')) {
        const parts = payload.avatarUrl.split(',');
        const mimeMatch = parts[0].match(/data:(.*?);base64/);
        if (mimeMatch) avatarMimeType = mimeMatch[1];
        avatarBase64 = parts[1];
      } else if (payload.avatarUrl.startsWith('http')) {
        try {
          const imgRes = await fetch(payload.avatarUrl);
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer();
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
            avatarMimeType = contentType;
            avatarBase64 = Buffer.from(buffer).toString('base64');
          }
        } catch (e) {
          console.warn("[Vertex Image Gen] Could not fetch avatarUrl:", e);
        }
      }
    }

    const ai = getVertexClient();
    const modelToUse = model || 'gemini-3.1-flash-lite-image';

    let parts: any[] = [];
    let promptText = '';

    if (mode === 'selfie') {
      promptText = `Use [Input Image 1] as the subject reference (identical face, exact facial structure, hair, and eye shape). A spontaneous, casual amateur selfie taken on a smartphone front-facing camera. She is ${action_and_setting}. Arm extended holding the phone at a slight, natural angle; the shot is slightly off-center and imperfectly framed. Natural, flat indoor lighting or screen glare illuminating her face—strictly no studio rim lighting or warm glam glow. Casual relaxed expression, half-smile or candid smirk (not an Instagram model pose). Authentic smartphone front-lens compression, subtle motion blur around edges, faint digital camera grain. Raw unedited Snapchat/WhatsApp front camera snap, zero beauty filter, zero cinematic styling.`;

      if (avatarBase64) {
        const cleanBase64 = avatarBase64.includes(',') ? avatarBase64.split(',')[1] : avatarBase64;
        parts.push({
          inlineData: {
            mimeType: avatarMimeType,
            data: cleanBase64,
          },
        });
      }
      parts.push({ text: promptText });
    } else if (mode === 'candid') {
      if (payload.user_wants_posed) {
        promptText = `Use [Input Image 1] as the subject reference (same woman, exact same facial features, hair, and skin tone). A casual, amateur smartphone snapshot of her ${action_and_setting}. She is posing casually for someone taking her photo on a phone, looking directly toward the camera with a natural, unforced expression. Shot on an everyday smartphone, slightly imperfect composition, authentic room/outdoor lighting. Realistic skin texture, natural soft focus, raw unedited mobile photo.`;
      } else {
        promptText = `Use [Input Image 1] as the subject reference (same woman, exact same facial features, hair, and skin tone). A natural, unposed amateur photo of her ${action_and_setting}. Captured quickly on an everyday smartphone, feels accidental rather than staged. Composition is slightly imperfect: off-center framing, awkward angle (either slightly too low or tilted, horizon not completely straight, or part of her body slightly cropped out of frame). She is mid-action or looking away casually (looking at her phone, lost in thought, or reaching for something—not aware of or posing for the camera). Uneven realistic lighting [e.g., flat fluorescent lighting, harsh daylight with one side slightly overblown, or fading low light with subtle grain]. Focus is naturally soft or slightly missed rather than razor-sharp, with subtle motion blur from quick movement. An uncurated, unedited raw capture sent over chat.`;
      }

      if (avatarBase64) {
        const cleanBase64 = avatarBase64.includes(',') ? avatarBase64.split(',')[1] : avatarBase64;
        parts.push({
          inlineData: {
            mimeType: avatarMimeType,
            data: cleanBase64,
          },
        });
      }
      parts.push({ text: promptText });
    } else {
      promptText = `A casual amateur first-person POV photo taken on a smartphone of ${action_and_setting}. Documentary everyday realism, flat natural light or harsh indoor fluorescent bulbs. Slightly off-center angle, real clutter in the background, believable phone lens depth. An accidental 2-second snapshot, no editorial color grading, zero artistic styling.`;
      parts.push({ text: promptText });
    }

    let generatedBase64: string | undefined;
    let generatedMime = 'image/jpeg';

    try {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ["IMAGE"],
          aspectRatio: "3:4",
          imageConfig: {
            aspectRatio: "3:4",
          },
        } as any,
      });

      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY' || (response.promptFeedback as any)?.blockReason) {
        sendJson(res, 500, {
          blocked: true,
          error: "Image generation triggered safety filter.",
        });
        return;
      }

      if (candidate?.content?.parts) {
        for (const p of candidate.content.parts) {
          if (p.inlineData?.data) {
            generatedBase64 = p.inlineData.data;
            generatedMime = p.inlineData.mimeType || 'image/jpeg';
            break;
          }
        }
      }
    } catch (genContentErr: any) {
      console.warn("[Vertex AI generateContent for image failed, checking generateImages fallback]:", genContentErr?.message);
      
      const errMsg = String(genContentErr?.message || '');
      if (errMsg.includes('SAFETY') || errMsg.includes('blocked') || errMsg.includes('IMAGE_SAFETY')) {
        sendJson(res, 500, { blocked: true, error: "Image generation blocked by safety filters." });
        return;
      }

      if (typeof (ai.models as any).generateImages === 'function') {
        try {
          const imgResult = await (ai.models as any).generateImages({
            model: modelToUse,
            prompt: promptText,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '3:4',
            },
          });
          const b64 = imgResult?.generatedImages?.[0]?.image?.imageBytes;
          if (b64) {
            generatedBase64 = b64;
            generatedMime = 'image/jpeg';
          }
        } catch (imgErr) {
          console.warn("[Vertex AI generateImages fallback error]:", imgErr);
        }
      }
    }

    if (!generatedBase64) {
      sendJson(res, 500, {
        error: "No image was returned by the image generation model.",
      });
      return;
    }

    const dataUrl = generatedBase64.startsWith('data:')
      ? generatedBase64
      : `data:${generatedMime};base64,${generatedBase64}`;

    sendJson(res, 200, {
      imageData: dataUrl,
    });
  } catch (error: any) {
    console.error("[Vertex AI Image Generation Error]:", error);
    const errStr = error?.message || String(error);
    const isBlocked = errStr.includes('SAFETY') || errStr.includes('blocked') || errStr.includes('IMAGE_SAFETY');
    sendJson(res, 500, {
      blocked: isBlocked,
      error: `Image generation failed: ${errStr}`,
    });
  }
}
