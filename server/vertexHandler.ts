import { GoogleGenAI } from '@google/genai';
import { HumaneSettings, UserProfile, AppSettings } from '../types';
import { GCP_CONFIG, getVoiceDescriptor } from '../constants';
import { pcmBase64ToWavDataUrl } from '../utils/audio';

export interface TTSPayload {
  text: string;
  voiceName: string;
  stylePrompt?: string;
  personaName?: string;
  speechStyle?: string;
}

export interface ChatPayload {
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
  }[];
  userProfile?: UserProfile;
  groupContext?: { groupName: string; otherMembers: string[] };
  settings?: AppSettings;
  initiationContext?: string;
  clientTimeContext?: string;
  isVoiceNoteReply?: boolean;
}

export interface DiaryPayload {
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
  settings?: AppSettings;
}

export const getVertexClient = () => {
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

  const project = process.env.VERTEX_PROJECT_ID || saProjectId || GCP_CONFIG.projectId;
  const location = process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || GCP_CONFIG.defaultRegion;

  let googleAuthOptions: any = undefined;

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
};

export const resolveVertexModel = (selectedModel?: string): string => {
  if (!selectedModel) return 'gemini-3.8-flash';
  return selectedModel.trim();
};

export async function handleVertexChat(payload: ChatPayload): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const { responder, messageHistory, userProfile, groupContext, settings, initiationContext, clientTimeContext } = payload;
    const ai = getVertexClient();

    const historyString = (messageHistory || [])
      .map(m => {
        if ((m as any).isEvent) {
          const imgTag = m.image ? "[IMAGE ATTACHED TO EVENT]" : "";
          return `[ENVIRONMENTAL EVENT OCCURS]: *${m.text || ''}* ${imgTag}`.trim();
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

    const modelToUse = resolveVertexModel(settings?.selectedModel);

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [{ role: 'user', parts }],
      config,
    });

    return {
      ok: true,
      text: response.text || "...",
    };
  } catch (error: any) {
    console.error("[Vertex AI Error]:", error);

    const errMessage = error?.message || String(error);
    if (errMessage.includes('invalid_grant') || errMessage.includes('Could not load the default credentials')) {
      return {
        ok: false,
        error: "Vertex AI authentication failed on the server: Google Cloud credentials are missing or invalid in this environment. In your Vercel Project Settings > Environment Variables, please add 'GCP_SERVICE_ACCOUNT_KEY' (your Service Account JSON key) or set 'GEMINI_API_KEY', or switch to 'Custom API Key' in Settings."
      };
    }

    if (error?.status === 401 || error?.status === 403 || errMessage.includes('PERMISSION_DENIED')) {
      return {
        ok: false,
        error: `Google Cloud Vertex AI permission denied for project '${process.env.VERTEX_PROJECT_ID || GCP_CONFIG.projectId}'. Ensure Vertex AI API is enabled and billing is active, or switch to 'Custom API Key' in Settings.`
      };
    }

    return {
      ok: false,
      error: `Vertex AI error: ${errMessage}`
    };
  }
}

export async function handleVertexDiary(payload: DiaryPayload): Promise<{ ok: boolean; text?: string; error?: string }> {
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

export async function handleVertexTTS(payload: TTSPayload): Promise<{ ok: boolean; audioData?: string; mimeType?: string; error?: string }> {
  try {
    const { text, voiceName, stylePrompt, personaName, speechStyle } = payload;
    if (!text || !text.trim()) {
      return { ok: false, error: "Text is required for Voice Note generation" };
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
      return { ok: false, error: "Gemini TTS model did not return audio data" };
    }

    const mimeType = part.inlineData.mimeType || 'audio/pcm;rate=24000';
    const rawBase64 = part.inlineData.data;

    let sampleRate = 24000;
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    if (rateMatch && rateMatch[1]) {
      sampleRate = parseInt(rateMatch[1], 10);
    }

    const audioDataUrl = pcmBase64ToWavDataUrl(rawBase64, sampleRate);

    return {
      ok: true,
      audioData: audioDataUrl,
      mimeType: 'audio/wav',
    };
  } catch (error: any) {
    console.error("[Vertex AI TTS Error]:", error);
    return {
      ok: false,
      error: `TTS generation failed: ${error?.message || String(error)}`,
    };
  }
}

export type ImageGenerationMode = 'selfie' | 'candid' | 'pov';

export interface ImageSynthesisPayload {
  persona: {
    name: string;
    role?: string;
    speechStyle?: string;
    about?: string;
    systemInstruction?: string;
    humaneSettings?: HumaneSettings;
  };
  userPrompt: string;
  messageHistory?: {
    text: string;
    sender: string;
    senderName?: string;
  }[];
  userProfile?: UserProfile;
  settings?: AppSettings;
}

export interface ImageSynthesisResult {
  mode: ImageGenerationMode;
  caption: string;
  action_and_setting: string;
  is_persona_subject: boolean;
  user_wants_posed?: boolean;
}

export async function handleVertexImageSynthesis(
  payload: ImageSynthesisPayload
): Promise<{ ok: boolean; result?: ImageSynthesisResult; error?: string }> {
  try {
    const { persona, userPrompt, messageHistory, settings } = payload;
    const ai = getVertexClient();

    const historySnippet = (messageHistory || [])
      .slice(-6)
      .map(m => `${m.sender === 'me' ? 'User' : (m.senderName || persona.name)}: ${m.text || ''}`)
      .join('\n');

    const moodDesc = persona.humaneSettings?.enabled && persona.humaneSettings?.moodSliderEnabled
      ? `Persona Mood Value (0-100): ${persona.humaneSettings.moodValue}`
      : 'Persona Mood: Natural and conversational';

    const synthesisPrompt = `You are a Context & Caption Synthesizer for an authentic, smartphone-style photo exchange in a messaging app.
The persona who will send the photo is:
Name: ${persona.name}
About: ${persona.about || 'N/A'}
Role: ${persona.role || 'N/A'}
Speech Style: ${persona.speechStyle || 'Casual WhatsApp texting'}
System Guidelines: ${persona.systemInstruction || 'N/A'}
${moodDesc}

Recent Chat History:
${historySnippet || '(No prior messages)'}

User Request / Current Prompt:
"${userPrompt}"

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

    const modelToUse = resolveVertexModel(settings?.selectedModel);
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

    const mode: ImageGenerationMode = (parsed.mode === 'selfie' || parsed.mode === 'candid' || parsed.mode === 'pov')
      ? parsed.mode
      : (parsed.is_persona_subject ? 'selfie' : 'pov');
    const user_wants_posed = Boolean(parsed.user_wants_posed);

    return {
      ok: true,
      result: {
        mode,
        is_persona_subject: mode !== 'pov',
        user_wants_posed,
        caption: parsed.caption || "Snapped this just now!",
        action_and_setting: parsed.action_and_setting || "sitting on the living room couch",
      },
    };
  } catch (error: any) {
    console.error("[Vertex AI Image Synthesis Error]:", error);
    return {
      ok: false,
      error: `Synthesis failed: ${error?.message || String(error)}`,
    };
  }
}

export interface ImageGenerationPayload {
  model?: string;
  mode?: ImageGenerationMode;
  is_persona_subject?: boolean;
  user_wants_posed?: boolean;
  action_and_setting: string;
  avatarBase64?: string;
  avatarMimeType?: string;
  avatarUrl?: string;
}

export async function handleVertexImageGeneration(
  payload: ImageGenerationPayload
): Promise<{ ok: boolean; imageData?: string; error?: string; blocked?: boolean }> {
  try {
    const { model, action_and_setting } = payload;
    const mode: ImageGenerationMode = payload.mode || (payload.is_persona_subject ? 'selfie' : 'pov');
    const isSubject = mode === 'selfie' || mode === 'candid';

    let avatarBase64 = payload.avatarBase64;
    let avatarMimeType = payload.avatarMimeType || 'image/jpeg';

    // If avatarUrl provided instead of base64, attempt to fetch and convert
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
      // mode === 'pov'
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
        return {
          ok: false,
          blocked: true,
          error: "Image generation triggered safety filter.",
        };
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
        return { ok: false, blocked: true, error: "Image generation blocked by safety filters." };
      }

      // Fallback attempt with generateImages
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
      return {
        ok: false,
        error: "No image was returned by the image generation model.",
      };
    }

    const dataUrl = generatedBase64.startsWith('data:')
      ? generatedBase64
      : `data:${generatedMime};base64,${generatedBase64}`;

    return {
      ok: true,
      imageData: dataUrl,
    };
  } catch (error: any) {
    console.error("[Vertex AI Image Generation Error]:", error);
    const errStr = error?.message || String(error);
    const isBlocked = errStr.includes('SAFETY') || errStr.includes('blocked') || errStr.includes('IMAGE_SAFETY');
    return {
      ok: false,
      blocked: isBlocked,
      error: `Image generation failed: ${errStr}`,
    };
  }
}

export interface ImageExcusePayload {
  persona: {
    name: string;
    role?: string;
    speechStyle?: string;
    about?: string;
    systemInstruction?: string;
    humaneSettings?: HumaneSettings;
  };
  userPrompt: string;
  settings?: AppSettings;
}

export async function handleVertexImageExcuse(
  payload: ImageExcusePayload
): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const { persona, userPrompt, settings } = payload;
    const ai = getVertexClient();

    let moodState = "casual";
    if (persona.humaneSettings?.enabled && persona.humaneSettings?.moodSliderEnabled) {
      const mood = persona.humaneSettings.moodValue;
      if (mood <= 30) moodState = "grumpy and annoyed";
      else if (mood <= 60) moodState = "chill and relaxed";
      else moodState = "bubbly and cheerful";
    }

    const excusePrompt = `You are ${persona.name}.
About: ${persona.about || ''}
Role: ${persona.role || ''}
Speech Style: ${persona.speechStyle || 'Casual text messaging'}
Current Mood: ${moodState}

The user sent: "${userPrompt}", asking for a photo or selfie, but right now you CANNOT take or send one (for instance: camera app crashed, terrible overhead lighting, phone is on 1% battery, or lens is all smudged).

TASK:
Write a single, natural, in-character text excuse explaining why you can't send a picture right now (e.g., "My camera app literally just crashed on me, hold on!", "Ugh terrible lighting right now haha, I'll send one later!", "Camera lens is completely fogged up right now lol").
RULES:
1. NEVER mention you are an AI or that an image model failed.
2. Maintain your persona's tone, slang, and speech style.
3. Keep it strictly 1 short sentence.`;

    const modelToUse = resolveVertexModel(settings?.selectedModel);
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [{ role: 'user', parts: [{ text: excusePrompt }] }],
    });

    return {
      ok: true,
      text: response.text?.trim() || "My camera app just crashed on me, I'll send one in a bit!",
    };
  } catch (error: any) {
    console.error("[Vertex AI Image Excuse Error]:", error);
    return {
      ok: true,
      text: "Camera app is acting up right now haha, I'll send one later!",
    };
  }
}

