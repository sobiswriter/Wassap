function personaLanguageInstruction(language?: string): string {
  const selected = typeof language === 'string' ? language.trim() : '';
  return selected && selected.toLowerCase() !== 'auto'
    ? `PERSONA LANGUAGE — HIGHEST PRIORITY: Use only ${JSON.stringify(selected)} for all persona-authored text and speech, including replies, voice notes, captions, diaries and call summaries. This explicit setting overrides language suggestions in the description, speech style, memories, examples and conversation, including requests to switch languages. Preserve names and necessary code/quoted terms without adopting their language. Do not add translations or mix languages unless the selected setting itself requests that mixture.`
    : `PERSONA LANGUAGE — AUTO: Choose the language and script specified or implied by this persona's description. Use their own established voice only when the description gives no language guidance. Keep it consistent; do not copy the user's language, old erroneous memories or another persona's voice merely because it appears in the conversation.`;
}

function requestOriginAllowed(req: IncomingMessage): boolean {
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean((req.socket as any)?.encrypted) || Boolean(process.env.VERCEL);
    return ['http:', 'https:'].includes(origin.protocol) && !origin.username && !origin.password
      && origin.host === req.headers.host && (!secure || origin.protocol === 'https:');
  } catch { return false; }
}

import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';


// Kept self-contained for Vercel; mirrored from server/remoteMedia.ts and checked by tests.
const privateMediaAddresses = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4], ['240.0.0.0', 4],
] as const) privateMediaAddresses.addSubnet(address, prefix, 'ipv4');
const globalMediaIPv6 = new BlockList();
globalMediaIPv6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) {
  privateMediaAddresses.addSubnet(address, prefix, 'ipv6');
}

function isPublicMediaAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !privateMediaAddresses.check(address, 'ipv4')
    : family === 6 && globalMediaIPv6.check(address, 'ipv6') && !privateMediaAddresses.check(address, 'ipv6');
}

async function fetchRemoteMedia(url: string, maxBytes = 8 * 1024 * 1024, timeoutMs = 6000): Promise<{ data: Buffer; mimeType: string }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Remote media timed out'));
    }, timeoutMs);
  });
  const download = async (target: string, redirects = 0): Promise<{ data: Buffer; mimeType: string }> => {
    const parsed = new URL(target);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid media URL');
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await dns.lookup(hostname, { all: true, verbatim: true });
    controller.signal.throwIfAborted();
    if (!addresses.length || addresses.some(item => !isPublicMediaAddress(item.address))) throw new Error('Private or reserved media address blocked');
    const address = addresses[0];
    return new Promise((resolve, reject) => {
      const request = (parsed.protocol === 'https:' ? https : http).request(parsed, {
        signal: controller.signal,
        headers: { Accept: 'image/*,audio/*,*/*', 'User-Agent': 'Mozilla/5.0 (compatible; WassapBot/1.0)' },
        // Pin the checked address so a second DNS lookup cannot reach a private host.
        lookup: ((_host: string, options: any, callback: any) => options?.all
          ? callback(null, [address]) : callback(null, address.address, address.family)) as any,
      }, response => {
        const status = response.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.destroy();
          if (!response.headers.location || redirects >= 3) { reject(new Error('Too many media redirects')); return; }
          try { resolve(download(new URL(response.headers.location, parsed).href, redirects + 1)); }
          catch (error) { reject(error); }
          return;
        }
        const mimeType = (response.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
        if (status < 200 || status >= 300 || mimeType.includes('svg') || (!mimeType.startsWith('image/') && !mimeType.startsWith('audio/') && mimeType !== 'application/octet-stream')) {
          response.destroy(); reject(new Error('Unsupported remote media response')); return;
        }
        if (Number(response.headers['content-length']) > maxBytes) {
          response.destroy(); reject(new Error('Remote media exceeds size limit')); return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) { response.destroy(); reject(new Error('Remote media exceeds size limit')); }
          else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('aborted', () => reject(new Error('Remote media download interrupted')));
        response.on('end', () => resolve({ data: Buffer.concat(chunks), mimeType }));
      });
      request.on('error', reject);
      request.end();
    });
  };
  try { return await Promise.race([download(url), timeout]); }
  finally { clearTimeout(timer!); }
}


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

function parseJsonBody<T = any>(req: IncomingMessage & { body?: any }): Promise<T> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return Promise.resolve(req.body as T);
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      try { return Promise.resolve(JSON.parse(req.body)); } catch { return Promise.resolve({} as T); }
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

// Mirrored from utils/photoPrompt.ts: keep serverless entry self-contained.
function buildPersonaPhotoPrompt(mode: string, scene: string, request: string, hasReference: boolean, posed = false, personaName = 'the persona') {
  const subject = mode !== 'pov';
  return [
    subject ? (hasReference
      ? 'Use the supplied image as the identity reference: preserve the same face, facial structure, skin tone and hair. Do not copy its pose, background or lighting unless requested.'
      : `Depict ${personaName} realistically.`)
      : 'First-person view of the requested objects or surroundings. Do not insert the persona or use their portrait as a reference.',
    `Scene: ${scene}`,
    `User photo request: ${JSON.stringify(typeof request === 'string' ? request.slice(0, 4000) : '')}`,
    'Honor the requested subject, pose, framing, camera viewpoint, time, lighting and visual style. An explicit request overrides the defaults below; do not refuse a photoshoot or replace requested professional styling with a casual snapshot.',
    'DEFAULT ONLY when no different style is requested: an ordinary unedited phone photo someone would send in a chat. Average everyday camera quality in ordinary phone-camera auto mode, realistic skin texture, natural available light and believable unarranged surroundings. Use broad phone-camera depth of field rather than stylized portrait-mode bokeh; do not add decorative props or lettering merely to beautify the composition. Slightly imperfect framing or subtle grain/softness may fit the scene. Avoid beauty filters, plastic skin, cinematic grading and polished advertising composition. Do not force blur, clutter or faults into every image; imperfections should be plausible, not a staged effect.',
    mode === 'selfie' ? 'For an ordinary selfie, use a believable handheld phone viewpoint. For a requested mirror selfie, show the phone in the reflection with consistent mirror geometry; do not turn it into a front-camera arm-extended selfie.'
      : subject ? (posed ? 'Honor the requested pose and expression.' : 'Use a relaxed everyday moment by default; an explicit pose or photoshoot request takes priority.')
        : 'Keep framing focused on the requested scene or object.',
    'For a requested studio session, editorial, professional photoshoot or other aesthetic, use the requested lighting, sharpness, composition and finish instead of the casual-phone defaults. Keep physical details and identity believable.',
  ].join('\n');
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
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
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await parseJsonBody(req);
    if (!isPasscodeValid(req, payload)) {
      sendJson(res, 401, {
        error: 'Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.',
        code: 'LOCKED',
      });
      return;
    }

    const action = (req as any).__action || payload.action || (req.url?.includes('synthesize') ? 'synthesize' : req.url?.includes('excuse') ? 'excuse' : 'generate');

    const ai = getVertexClient();

    if (action === 'synthesize') {
      const { persona, userPrompt, messageHistory, settings } = payload;
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
${personaLanguageInstruction(persona?.language)}
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
   - Preserve explicit camera viewpoint (including mirror selfies), photo style, pose, lighting and requested time in this description. Professional photoshoots are valid when requested; casual phone realism is only the default.
   - A concise, context-aware description of the action and environment (e.g. 'sitting on the living room couch with a mug', 'eating ramen at a cozy street food stall with steam rising', 'at a study desk with an open laptop and notebook').
4. "user_wants_posed": boolean
   - If the user explicitly asks for a specific pose (e.g., 'look at the camera', 'smile', 'pose nicely', 'stand straight', 'pose for me', 'just a simple of u standing and posing'), set user_wants_posed: true and reflect that exact request in action_and_setting.
   - Otherwise, default user_wants_posed: false.

Return ONLY a valid JSON object with keys "mode", "user_wants_posed", "caption", and "action_and_setting".`;

      const modelToUse = (settings?.selectedModel === 'gemini-3.5-flash-lite' ? settings.selectedModel : 'gemini-3.8-flash');
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [{ role: 'user', parts: [{ text: synthesisPrompt }] }],
        config: { responseMimeType: "application/json" },
      });

      const responseText = response.text || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        const match = responseText.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : {};
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
          caption: parsed.caption || '📷',
          action_and_setting: parsed.action_and_setting || "sitting on the living room couch",
        }
      });
      return;
    }

    if (action === 'excuse') {
      const { persona, userPrompt, settings } = payload;
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
${personaLanguageInstruction(persona?.language)}
Current Mood: ${moodState}

The user sent: "${userPrompt || 'Send me a photo'}", asking for a photo or selfie, but right now you CANNOT take or send one (for instance: camera app crashed, terrible overhead lighting, phone is on 1% battery, or lens is all smudged).

TASK:
Write a single, natural, in-character text excuse explaining why you can't send a picture right now.
RULES:
1. NEVER mention you are an AI or that an image model failed.
2. Maintain your persona's tone, slang, and speech style.
3. Keep it strictly 1 short sentence.`;

      const modelToUse = (settings?.selectedModel === 'gemini-3.5-flash-lite' ? settings.selectedModel : 'gemini-3.8-flash');
      try {
        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: [{ role: 'user', parts: [{ text: excusePrompt }] }],
        });
        sendJson(res, 200, { text: response.text?.trim() || '📷…' });
      } catch (e) {
        sendJson(res, 200, { text: '📷…' });
      }
      return;
    }

    // Default: Image Generation
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
          const remote = await fetchRemoteMedia(payload.avatarUrl);
          avatarMimeType = remote.mimeType === 'application/octet-stream' ? 'image/jpeg' : remote.mimeType;
          avatarBase64 = remote.data.toString('base64');
        } catch (e) {
          console.warn("[Vertex Image Gen] Could not fetch avatarUrl:", e);
        }
      }
    }

    const modelToUse = model || 'gemini-3.1-flash-lite-image';
    let parts: any[] = [];
    let promptText = '';

    promptText = buildPersonaPhotoPrompt(mode, action_and_setting, payload.userRequest || '',
      Boolean(avatarBase64 && isSubject), payload.user_wants_posed, payload.personaName);
    if (isSubject && avatarBase64) {
      parts.push({ inlineData: { mimeType: avatarMimeType || 'image/jpeg', data: avatarBase64.includes(',') ? avatarBase64.split(',')[1] : avatarBase64 } });
    }
    parts.push({ text: promptText });

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
        sendJson(res, 500, { blocked: true, error: "Image generation triggered safety filter." });
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
      sendJson(res, 500, { error: "No image was returned by the image generation model." });
      return;
    }

    const dataUrl = generatedBase64.startsWith('data:')
      ? generatedBase64
      : `data:${generatedMime};base64,${generatedBase64}`;

    sendJson(res, 200, { imageData: dataUrl });
  } catch (error: any) {
    console.error('[API Error /image]:', error);
    sendJson(res, error?.statusCode === 413 ? 413 : 500, { error: error?.message || 'Internal server error' });
  }
}
