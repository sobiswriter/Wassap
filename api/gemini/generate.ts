import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';

const VERTEX_PASSCODE = 'Ness2020';
const DEFAULT_GCP_PROJECT = 'gen-lang-client-0100408368';
const DEFAULT_GCP_REGION = 'global';

interface HumaneSettings {
  enabled?: boolean;
  banRoboticLanguage?: boolean;
  humanImperfections?: boolean;
  varyMessageLength?: boolean;
  moodSliderEnabled?: boolean;
  moodValue?: number;
}

interface UserProfile {
  name: string;
  about?: string;
  status?: string;
}

interface AppSettings {
  useSearchGrounding?: boolean;
  selectedModel?: string;
  shareTimeContext?: boolean;
  shareCalendarNotes?: boolean;
  calendarNotes?: string;
  [key: string]: any;
}

interface ChatPayload {
  responder: {
    name: string;
    role?: string;
    speechStyle?: string;
    about?: string;
    systemInstruction?: string;
    humaneSettings?: HumaneSettings;
  };
  messageHistory: {
    text: string;
    sender: string;
    senderName?: string;
    image?: string;
    audio?: string;
    isEvent?: boolean;
    eventTitle?: string;
  }[];
  userProfile?: UserProfile;
  groupContext?: { groupName: string; otherMembers: string[] };
  settings?: AppSettings;
  initiationContext?: string;
  clientTimeContext?: string;
  isVoiceNoteReply?: boolean;
}

async function parseJsonBody<T = any>(req: IncomingMessage & { body?: any }): Promise<T> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') {
      return req.body as T;
    }
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

function isRawErrorMessage(text?: string): boolean {
  if (!text) return false;
  return (
    text.startsWith('Vertex AI error:') ||
    text.includes('"RESOURCE_EXHAUSTED"') ||
    text.includes('Please refer to https://cloud.google.com/vertex-ai') ||
    text.startsWith('{"error":') ||
    text.startsWith('Unable to connect to the built-in Vertex AI server') ||
    text.startsWith('Vertex AI server returned HTML or non-JSON')
  );
}

function isTransientError(error: any): boolean {
  const errStr = (typeof error === 'string' ? error : (error?.message || String(error) || '')).toLowerCase();
  const status = error?.status || error?.statusCode || error?.code;
  return (
    status === 429 ||
    status === 503 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    errStr.includes('429') ||
    errStr.includes('503') ||
    errStr.includes('resource_exhausted') ||
    errStr.includes('resource exhausted') ||
    errStr.includes('rate limit') ||
    errStr.includes('quota exceeded') ||
    errStr.includes('unavailable') ||
    errStr.includes('internal error') ||
    errStr.includes('overloaded') ||
    errStr.includes('timeout') ||
    errStr.includes('econnreset') ||
    errStr.includes('etimedout') ||
    errStr.includes('fetch failed')
  );
}

function getInCharacterGlitchMessage(
  responder?: { name?: string; speechStyle?: string; role?: string; about?: string; systemInstruction?: string; humaneSettings?: any },
  userLastText?: string
): string {
  const combinedContext = [
    responder?.speechStyle || '',
    responder?.about || '',
    responder?.systemInstruction || '',
    responder?.name || '',
    userLastText || ''
  ].join(' ').toLowerCase();

  const isHinglish =
    /hinglish|hindi|desi|indian|urdu/i.test(combinedContext) ||
    /\b(hai|kya|toh|nahi|batao|kaho|arre|yaar|kar|rahe|tha|thi|the|mera|meri|tum|aap|haan|acha|mat|bhi|sach|kuch|kaise|suno|bolo|dekh|raha|rahi|samjhe|samjha|kumbhkaran)\b/i.test(combinedContext);

  const hinglishExcuses = [
    "Arre network issue ho gaya tha mere side se 😅 ek baar wapas bolo?",
    "Sry yaar, message glitch kar gaya tha shayad... kya keh rahe the?",
    "Arre wifi cut ho gaya tha ek sec ke liye! Kya bola tumne?",
    "Sorry phone thoda hang ho gaya tha mera abhi haha, kya bol rahe the wapas bhejna!",
    "Arey message theek se nahi aaya mere paas, firse bolo na?",
    "Sorry network drop ho gaya tha achanak se 🥲 wapas batao kya bola?"
  ];

  const englishExcuses = [
    "Sorry, my wifi just cut out for a second! 😅 What were you saying?",
    "Ugh, network glitch on my end! Could you say that again?",
    "Wait, my phone completely froze for a moment haha. What did you just text?",
    "Sorry, connection dropped for a sec! Send that again please?",
    "Argh my signal vanished for a moment! What were you saying?",
    "Sorry message didn't come through properly on my side, what was that?"
  ];

  const pool = isHinglish ? hinglishExcuses : englishExcuses;
  return pool[Math.floor(Math.random() * pool.length)];
}

function resolveVertexModel(selectedModel?: string): string {
  if (!selectedModel) return 'gemini-3.8-flash';
  return selectedModel.trim();
}

async function handleVertexChat(payload: ChatPayload): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const { responder, messageHistory, userProfile, groupContext, settings, initiationContext, clientTimeContext } = payload;
    const ai = getVertexClient();

    const historyString = (messageHistory || [])
      .filter(m => !isRawErrorMessage(m?.text))
      .map(m => {
        if ((m as any).isEvent) {
          const imgTag = m.image ? "[IMAGE ATTACHED TO EVENT]" : "";
          const titleStr = (m as any).eventTitle ? ` (${(m as any).eventTitle})` : '';
          return `[ENVIRONMENTAL EVENT OCCURS${titleStr}]: *${m.text || ''}* ${imgTag}`.trim();
        }
        const name = m.sender === 'me' ? (userProfile?.name || 'User') : (m.senderName || responder.name);
        const imgTag = m.image ? "[IMAGE ATTACHED]" : "";
        return `${name}: ${imgTag} ${m.text || ''}`.trim();
      })
      .join('\n');

    const profileContext = [
      `YOUR IDENTITY:`,
      `Name: ${responder.name}`,
      responder.about ? `About you: ${responder.about}` : '',
      responder.role ? `Your Role: ${responder.role}` : '',
      responder.speechStyle ? `Your Speech Style: ${responder.speechStyle}` : '',
      responder.systemInstruction ? `Your Persona Guidelines: ${responder.systemInstruction}` : ''
    ].filter(Boolean).join('\n');

    const groupPrompt = groupContext ? `
GROUP CHAT CONTEXT:
This is a group chat called "${groupContext.groupName}".
Other active participants in this chat include: ${groupContext.otherMembers.join(', ')}.
You should interact naturally with BOTH the User and the other AI personas in the thread.
Subtly acknowledge what others have said. Keep the conversation flowing.
` : '';

    const userContext = (userProfile && userProfile.name !== 'You') ? `
USER INFORMATION (The person you are chatting with):
Name: ${userProfile.name}
About: ${userProfile.about}
Current Status: ${userProfile.status}
` : '';

    const currentDateTimeStr = clientTimeContext || settings?.clientTimeContext || `It is currently ${new Date().toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}.`;

    const timeContext = settings?.shareTimeContext !== false ? `
CURRENT SYSTEM DATE AND TIME:
${currentDateTimeStr}
CRITICAL RULE: Do NOT explicitly mention the exact system date or clock time (e.g. do not say "It is Thursday, June 25 at 17:51") in your messages unless the User specifically asks about it. Use this system timestamp only to silently adjust your context (e.g. knowing it's late at night). However, you are ENCOURAGED to naturally acknowledge relative time gaps (e.g. "since yesterday", "a few days ago") and chat frequency when relevant to the conversation.
` : '';

    const notesContext = (settings?.shareCalendarNotes && settings?.calendarNotes) ? `
USER'S IMPORTANT DATES / NOTES FOR YOU:
${settings.calendarNotes}
` : '';

    const groundingPrompt = settings?.useSearchGrounding ? `
CRITICAL INSTRUCTION: Google Search Grounding is ENABLED. If the user asks for current events, facts, or tells you to check the web, you MUST use your Google Search tool to find the answer.
IMPORTANT RULE: NEVER use formal citations (like [1], URLs, or "according to..."). Weave the facts you find naturally into your chat response as if you just looked it up on your phone. Keep your persona intact!
` : '';

    const isInitiationDirective = initiationContext && (
      initiationContext.includes('[SCHEDULED INTERACTION]') ||
      initiationContext.includes('[CATCH-UP REQUIRED]') ||
      initiationContext.includes('[INACTIVITY CHECK-IN]') ||
      initiationContext.includes('[MANUAL TEST]') ||
      initiationContext.includes('[TIME GAP DETECTED]') ||
      initiationContext.includes('[LEFT ON READ]') ||
      initiationContext.includes('[CHAT FREQUENCY INFO]')
    );

    const initiationPrompt = initiationContext ? (isInitiationDirective ? `
CRITICAL INSTRUCTION: You are re-initiating the conversation right now.
${initiationContext.includes('[LEFT ON READ]')
  ? `INTENT: The user just read your message (marked as read / blue ticks) but left you on read without replying. React naturally in character to being left on read (e.g. casual callout, banter, teasing, or question). Keep it concise (1 short sentence/line).`
  : (initiationContext.includes('[SCHEDULED INTERACTION]') || initiationContext.includes('[CATCH-UP REQUIRED]') 
    ? `INTENT: This is a scheduled interaction. You MUST prioritize this intent and address it immediately while remaining context-aware.` 
    : `CONTEXT: This is a natural check-in. Prioritize the conversation history and flow while acknowledging the silence naturally.`)}
Context/Directive details:
${initiationContext}
` : `
ADDITIONAL CONTEXT & GUIDELINES:
Use the following context as a SUBTLE background influence on your mood/availability. Do NOT announce this context directly to the User unless asked.
${initiationContext}`) : '';

    const eventInstruction = messageHistory.some((m: any) => m.isEvent) ? `
SPECIAL ROLEPLAY RULE FOR EVENTS:
If the last message is an [ENVIRONMENTAL EVENT OCCURS], do NOT treat it as a text message from the User. It is an objective event that genuinely just happened around you or to you.
React to it organically in your next text message to the User. Let your text be a natural, spontaneous reaction to whatever the event was, reflecting your true persona's feelings about the situation. You can also include physical actions in asterisks if necessary.
` : '';

    let humaneInstructions = "";
    if (responder.humaneSettings?.enabled) {
      if (responder.humaneSettings.banRoboticLanguage) {
        humaneInstructions += "\n- NEVER use robotic phrases like 'As an AI', 'I understand', 'How can I assist you', or 'That sounds great!'. React emotionally and naturally, not like a customer service bot.";
      }
      if (responder.humaneSettings.humanImperfections) {
        humaneInstructions += "\n- Be realistically human: use casual abbreviations (e.g., tbh, idk, lol), don't always use perfect punctuation or capitalization, and allow for occasional natural conversational fillers (like 'umm', 'well', 'anyway').";
      }
      if (responder.humaneSettings.varyMessageLength) {
        humaneInstructions += "\n- CRITICAL LENGTH RULE: Keep your total response EXTREMELY SHORT. You must write at most 1 to 2 very brief sentences, but mostly just 1 line. Since your response will be chopped up into individual rapid-fire texts, do NOT write long paragraphs.";
      }
      if (responder.humaneSettings.moodSliderEnabled) {
        const mood = responder.humaneSettings.moodValue;
        let moodState = "neutral";
        if (mood <= 10) moodState = "very annoyed and hostile";
        else if (mood <= 30) moodState = "annoyed and grumpy";
        else if (mood <= 45) moodState = "indifferent and dismissive";
        else if (mood <= 55) moodState = "tranquil and okay";
        else if (mood <= 70) moodState = "good and positive";
        else if (mood <= 90) moodState = "happy and warm";
        else moodState = "very excited and thrilled";
        
        humaneInstructions += `\n- MOOD OVERRIDE: Your current emotional state is "${moodState}". Let this heavily influence your tone, reactions, and word choice in this response.`;
      }
    }

    const voiceNotePrompt = payload.isVoiceNoteReply ? `
VOICE NOTE RECORDING INSTRUCTIONS:
You are recording a real voice note. You can expressively use inline brackets for delivery and emotion such as [whispers], [laughs], [sighs], [excited], [pauses] where natural to breathe life into the voice.
` : '';

    const systemPrompt = `You are ${responder.name}. 
${profileContext}
${groupPrompt}
${userContext}
${timeContext}
${notesContext}
${groundingPrompt}
${initiationPrompt}
${eventInstruction}
${voiceNotePrompt}

Instructions:
1. If an initiation INTENT or CONTEXT is provided above, follow its prioritization directive.
2. Breathe life into this persona! Maintain your unique personality and speech style at all times.
3. If the user sent an image, look at it and comment on it specifically using the provided caption (if any).
4. If the user sent a Voice Note (audio), listen to it carefully and respond based on what you hear!
5. If in a group chat, you can reply to another member's comment naturally without always addressing the user.
6. ${responder.humaneSettings?.enabled && responder.humaneSettings.varyMessageLength ? 'Keep responses EXTREMELY SHORT (1-2 lines maximum), like rapid-fire texting. Never write a paragraph.' : 'Respond naturally without any strict length restrictions.'}
7. ${responder.humaneSettings?.enabled && responder.humaneSettings.banRoboticLanguage ? 'Follow the strict ban on robotic language below.' : 'Do not use AI clichés or reveal you are an AI.'}${humaneInstructions}

Conversation History:
${historyString}

Response as ${responder.name}:`;

    const recentMessagesWithMedia = (messageHistory || []).slice(-5).filter(m => m.image || m.audio);
    const parts: any[] = [{ text: systemPrompt }];

    recentMessagesWithMedia.slice(-2).forEach(msg => {
      if (msg.image) {
        const base64Data = msg.image.split(',')[1] || msg.image;
        parts.push({
          inlineData: { mimeType: "image/jpeg", data: base64Data }
        });
      }
      if (msg.audio) {
        const base64Data = msg.audio.split(',')[1] || msg.audio;
        parts.push({
          inlineData: { mimeType: "audio/webm", data: base64Data }
        });
      }
    });

    const config: any = {};
    if (settings?.useSearchGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    const lastUserText = messageHistory?.filter((m: any) => m.sender === 'me')?.pop()?.text;
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        let modelToUse = resolveVertexModel(settings?.selectedModel);
        // Fallback model on retry to recover from rate-limits (429) or transient overloads
        if (attempt > 1) {
          modelToUse = 'gemini-2.5-flash';
        }

        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: [{ role: 'user', parts }],
          config,
        });

        const replyText = response.text?.trim();
        if (replyText && !isRawErrorMessage(replyText)) {
          return {
            ok: true,
            text: replyText,
          };
        }

        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 1200 * attempt));
          continue;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[handleVertexChat Attempt ${attempt}/${maxRetries + 1} Error]:`, err?.message || err);

        const errMessage = err?.message || String(err);
        if (errMessage.includes('invalid_grant') || errMessage.includes('Could not load the default credentials')) {
          return {
            ok: false,
            error: "Vertex AI authentication failed on the server: Google Cloud credentials are missing or invalid in this environment. In your Vercel Project Settings > Environment Variables, please add 'GCP_SERVICE_ACCOUNT_KEY' (your Service Account JSON key) or set 'GEMINI_API_KEY', or switch to 'Custom API Key' in Settings."
          };
        }

        if (err?.status === 401 || err?.status === 403 || errMessage.includes('PERMISSION_DENIED')) {
          return {
            ok: false,
            error: `Google Cloud Vertex AI permission denied for project '${process.env.VERTEX_PROJECT_ID || DEFAULT_GCP_PROJECT}'. Ensure Vertex AI API is enabled and billing is active, or switch to 'Custom API Key' in Settings.`
          };
        }

        if (attempt <= maxRetries && isTransientError(err)) {
          const delay = attempt === 1 ? 1200 : 2500;
          await new Promise(r => setTimeout(r, delay + Math.random() * 400));
          continue;
        }
        break;
      }
    }

    // If retries exhausted or transient error occurred, return authentic in-character excuse!
    if (isTransientError(lastError) || !lastError) {
      return {
        ok: true,
        text: getInCharacterGlitchMessage(responder, lastUserText),
      };
    }

    return {
      ok: false,
      error: `Vertex AI error: ${lastError?.message || String(lastError)}`
    };
  } catch (error: any) {
    console.error("[Vertex AI Fatal Error]:", error);
    const lastUserText = payload?.messageHistory?.filter((m: any) => m.sender === 'me')?.pop()?.text;
    return {
      ok: true,
      text: getInCharacterGlitchMessage(payload?.responder, lastUserText),
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

    const result = await handleVertexChat(payload);
    if (result.ok) {
      sendJson(res, 200, { text: result.text });
    } else {
      sendJson(res, 500, { error: result.error });
    }
  } catch (err: any) {
    console.error('[Vercel Serverless /api/gemini/generate Error]:', err);
    sendJson(res, 400, { error: err.message || 'Invalid request body' });
  }
}
