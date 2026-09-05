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
          caption: parsed.caption || "Snapped this just now!",
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
Current Mood: ${moodState}

The user sent: "${userPrompt || 'Send me a photo'}", asking for a photo or selfie, but right now you CANNOT take or send one (for instance: camera app crashed, terrible overhead lighting, phone is on 1% battery, or lens is all smudged).

TASK:
Write a single, natural, in-character text excuse explaining why you can't send a picture right now.
RULES:
1. NEVER mention you are an AI or that an image model failed.
2. Maintain your persona's tone, slang, and speech style.
3. Keep it strictly 1 short sentence.`;

      const modelToUse = settings?.selectedModel || 'gemini-3.8-flash';
      try {
        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: [{ role: 'user', parts: [{ text: excusePrompt }] }],
        });
        sendJson(res, 200, { text: response.text?.trim() || "My camera app just crashed on me, hold on!" });
      } catch (e) {
        sendJson(res, 200, { text: "Camera app is glitching out right now haha, I'll send one later!" });
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
    sendJson(res, 500, { error: error?.message || 'Internal server error' });
  }
}
