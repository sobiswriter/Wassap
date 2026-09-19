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

    const gender = (payload.personaGender || payload.gender || '').toLowerCase();
    const isMale = gender === 'male' || gender === 'man' || gender === 'boy' || gender === 'brother' || gender === 'bro' || gender === 'father' || gender === 'dad' || gender === 'guy';
    const subjPronoun = isMale ? 'He' : 'She';
    const possPronoun = isMale ? 'his' : 'her';
    const personLabel = isMale ? 'same man' : 'same woman';

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
    const hasAvatar = Boolean(avatarBase64 && avatarBase64.trim().length > 100);
    const referenceDirective = hasAvatar
      ? `Use [Input Image 1] as the subject reference (identical face, exact facial structure, hair, and eye shape). `
      : `Depict the persona realistically (${payload.personaName ? `${payload.personaName}, ` : ''}${payload.personaRole || 'authentic persona'}). `;

    let parts: any[] = [];
    let promptText = '';

    if (mode === 'selfie') {
      promptText = `${referenceDirective}A spontaneous, casual amateur selfie taken on a smartphone front-facing camera. ${subjPronoun} is ${action_and_setting}. Arm extended holding the phone at a slight, natural angle; the shot is slightly off-center and imperfectly framed. Natural everyday indoor lighting, cozy ambient room light, or natural daylight illuminating ${possPronoun} face—strictly no studio rim lighting or artificial glam glow. Casual relaxed expression, half-smile or candid smirk (not an Instagram model pose). Authentic smartphone front-lens compression, subtle motion blur around edges, faint digital camera grain. Raw unedited mobile front camera photo, zero beauty filter, zero cinematic styling.`;

      if (hasAvatar) {
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
        promptText = `${referenceDirective}A casual, amateur smartphone snapshot of ${isMale ? 'him' : 'her'} ${action_and_setting}. ${subjPronoun} is posing casually for someone taking ${possPronoun} photo on a phone, looking directly toward the camera with a natural, unforced expression (${personLabel}, identical facial features and skin tone). Shot on an everyday smartphone, slightly imperfect composition, authentic room/outdoor lighting. Realistic skin texture, natural soft focus, raw unedited mobile photo.`;
      } else {
        promptText = `${referenceDirective}A natural, unposed amateur photo of ${isMale ? 'him' : 'her'} ${action_and_setting} (${personLabel}, identical facial features and skin tone). Captured quickly on an everyday smartphone, feels accidental rather than staged. Composition is slightly imperfect: off-center framing, awkward angle (either slightly too low or tilted, horizon not completely straight, or part of the body slightly cropped out of frame). ${subjPronoun} is actively engaged in the setting, looking away, observing something across the room, lost in thought, reaching for an item, or laughing mid-moment (natural authentic body posture, hands occupied naturally with the activity, not aware of or posing for the camera). Uneven realistic lighting [e.g., flat room lighting, soft ambient lamp light, or natural window light with subtle grain]. Focus is naturally soft or slightly missed rather than razor-sharp, with subtle motion blur from quick movement. An uncurated, unedited raw capture sent over chat.`;
      }

      if (hasAvatar) {
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
      // mode === 'pov'
      promptText = `A casual amateur first-person POV photo taken on a smartphone of ${action_and_setting}. Documentary everyday realism, flat natural light or indoor lighting. Slightly off-center angle, real clutter in the background, believable phone lens depth. An accidental 2-second snapshot, no editorial color grading, zero artistic styling.`;
      parts.push({ text: promptText });
    }

    let generatedBase64: string | undefined;
    let generatedMime = 'image/jpeg';
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        let currentModel = model || 'gemini-3.1-flash-lite-image';
        if (attempt === 2) {
          currentModel = 'gemini-3.1-flash-image';
        }

        const response = await ai.models.generateContent({
          model: currentModel,
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
          console.warn(`[Vertex AI Image Gen Attempt ${attempt}] Safety filter flagged.`);
          if (attempt <= maxRetries) {
            // Simplify prompt on safety retry to avoid human reference trigger
            parts = [{ text: `A casual amateur smartphone photo of ${action_and_setting}. Natural everyday lighting, authentic mobile snapshot.` }];
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
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

        if (generatedBase64) {
          break;
        }
      } catch (genContentErr: any) {
        lastError = genContentErr;
        console.warn(`[Vertex AI Image Gen Attempt ${attempt}/${maxRetries + 1} Error]:`, genContentErr?.message || genContentErr);

        const errMsg = String(genContentErr?.message || '');
        if (errMsg.includes('SAFETY') || errMsg.includes('IMAGE_SAFETY')) {
          if (attempt <= maxRetries) {
            parts = [{ text: `A casual amateur smartphone photo of ${action_and_setting}. Natural everyday lighting, authentic mobile snapshot.` }];
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          sendJson(res, 500, { blocked: true, error: "Image generation blocked by safety filters." });
          return;
        }

        // Secondary fallback attempt with Imagen (imagen-3.0-generate-002)
        if (typeof (ai.models as any).generateImages === 'function') {
          try {
            const imgResult = await (ai.models as any).generateImages({
              model: 'imagen-3.0-generate-002',
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
              break;
            }
          } catch (imgErr) {
            console.warn("[Imagen generateImages fallback error]:", imgErr);
          }
        }

        if (attempt <= maxRetries) {
          const delay = attempt === 1 ? 1500 : 3000;
          await new Promise(r => setTimeout(r, delay + Math.random() * 500));
          continue;
        }
      }
    }

    if (!generatedBase64) {
      sendJson(res, 500, {
        error: lastError?.message || "No image was returned by the image generation model.",
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
