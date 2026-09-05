import { GoogleGenAI } from "@google/genai";
import { UserProfile, AppSettings, HumaneSettings } from "../types";
import { DEFAULT_MODEL, DEFAULT_IMAGE_MODEL, VERTEX_PASSCODE, getVoiceDescriptor } from "../constants";
import { getAppTimeContext } from "../utils/dates";
import { pcmBase64ToWavDataUrl } from "../utils/audio";

export async function checkVertexConnectionStatus(): Promise<{
  ok: boolean;
  status?: string;
  provider?: string;
  project?: string;
  region?: string;
  hasCredentials?: boolean;
  credentialsType?: string;
  platform?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/gemini/status');
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        error: `Server returned non-JSON (${res.status}). Verify API routes are deployed on Vercel.`,
      };
    }
    const data = await res.json();
    return { ok: true, ...data };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Unable to connect to server.' };
  }
}

/**
 * Sanitizes messageHistory to prevent Vercel Serverless Function 413 (FUNCTION_PAYLOAD_TOO_LARGE).
 * - Caps history to the most recent 30 messages.
 * - Retains raw base64 data only for the last 2 media messages (which the multimodal API processes).
 * - Replaces older base64 image/audio strings with lightweight '[ATTACHED]' placeholders so
 *   text prompt cues like '[IMAGE ATTACHED]' still fire accurately without sending megabytes of dead payload.
 */
export function sanitizeHistoryForVertex(
  messageHistory: { text: string; sender: string; senderName?: string; image?: string; audio?: string; isEvent?: boolean }[]
) {
  if (!Array.isArray(messageHistory)) return [];

  const recent = messageHistory.slice(-30);

  const mediaIndices = new Set<number>();
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].image || recent[i].audio) {
      mediaIndices.add(i);
      if (mediaIndices.size >= 2) break;
    }
  }

  return recent.map((m, idx) => {
    const keepMediaData = mediaIndices.has(idx);
    return {
      text: m.text,
      sender: m.sender,
      senderName: m.senderName,
      isEvent: m.isEvent,
      image: keepMediaData ? m.image : (m.image ? '[ATTACHED]' : undefined),
      audio: keepMediaData ? m.audio : (m.audio ? '[ATTACHED]' : undefined),
    };
  });
}

async function fetchVertexChat(payload: any): Promise<string> {
  try {
    const res = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vertex-passcode': VERTEX_PASSCODE,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 413) {
      console.error("Vercel 413 Payload Too Large encountered");
      return "The message payload was too large for the server. The chat history was automatically trimmed. Please try sending again!";
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error("Non-JSON response from Vertex backend:", res.status, text.slice(0, 300));
      return `Vertex AI server returned HTML or non-JSON (${res.status}). Please verify the Vercel serverless deployment or switch to 'Custom API Key' in Settings.`;
    }

    const data = await res.json();
    if (!res.ok || !data.text) {
      return data.error || "Vertex AI server encountered an error. Please try again or switch to 'Custom API Key' in Settings.";
    }
    return data.text;
  } catch (e: any) {
    console.error("Failed to contact Vertex AI backend:", e);
    return "Unable to connect to the built-in Vertex AI server. Please verify your connection or switch to 'Custom API Key' in Settings.";
  }
}

async function fetchVertexDiary(payload: any): Promise<string> {
  try {
    const res = await fetch('/api/gemini/diary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vertex-passcode': VERTEX_PASSCODE,
      },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error("Non-JSON response from Vertex backend for diary:", res.status, text.slice(0, 300));
      return `Vertex AI diary server returned non-JSON (${res.status}). Please try again later or switch to 'Custom API Key' in Settings.`;
    }

    const data = await res.json();
    if (!res.ok || !data.text) {
      return data.error || "Vertex AI server encountered an error while writing diary.";
    }
    return data.text;
  } catch (e: any) {
    console.error("Failed to contact Vertex AI backend for diary:", e);
    return "Unable to connect to the built-in Vertex AI server. Try again later or switch to 'Custom API Key' in Settings.";
  }
}

async function fetchVertexTTS(payload: {
  text: string;
  voiceName: string;
  stylePrompt?: string;
  personaName?: string;
  speechStyle?: string;
}): Promise<{ ok: boolean; audioData?: string; error?: string }> {
  try {
    const res = await fetch('/api/gemini/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vertex-passcode': VERTEX_PASSCODE,
      },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error("Non-JSON response from Vertex backend for TTS:", res.status, text.slice(0, 300));
      return { ok: false, error: `TTS server returned non-JSON (${res.status})` };
    }

    const data = await res.json();
    if (!res.ok || !data.audioData) {
      return { ok: false, error: data.error || "Vertex TTS generation failed." };
    }

    return { ok: true, audioData: data.audioData };
  } catch (e: any) {
    console.error("Failed to contact Vertex AI backend for TTS:", e);
    return { ok: false, error: e.message || "Unable to connect to TTS server." };
  }
}

export const getGeminiResponse = async (
  responder: { name: string; role?: string; speechStyle?: string; about?: string; systemInstruction?: string; humaneSettings?: HumaneSettings },
  messageHistory: { text: string; sender: string; senderName?: string; image?: string; audio?: string }[],
  userProfile?: UserProfile,
  groupContext?: { groupName: string; otherMembers: string[] },
  settings?: AppSettings,
  initiationContext?: string,
  isVoiceNoteReply?: boolean
) => {
  const provider = settings?.aiProvider || 'vertex';

  // Option A: Built-in / Server Credits (Vertex AI)
  if (provider === 'vertex') {
    if (!settings?.isVertexUnlocked) {
      return "Built-in Cloud (Vertex AI) is locked. Please enter the passcode in Settings to unlock server credits, or switch to Custom API Key.";
    }
    return await fetchVertexChat({
      responder,
      messageHistory: sanitizeHistoryForVertex(messageHistory),
      userProfile,
      groupContext,
      settings: {
        selectedModel: settings?.selectedModel,
        useSearchGrounding: settings?.useSearchGrounding,
        shareTimeContext: settings?.shareTimeContext,
        shareCalendarNotes: settings?.shareCalendarNotes,
        calendarNotes: settings?.calendarNotes,
        clientTimeContext: getAppTimeContext(settings),
      },
      clientTimeContext: getAppTimeContext(settings),
      initiationContext,
      isVoiceNoteReply,
    });
  }

  // Option B: Custom API Key (Gemini AI Studio)
  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');

  if (!finalKey) {
    return "API Key not configured. Please enter your Gemini AI Studio API key in Settings, or switch to 'Built-in (Vertex AI)' mode.";
  }

  const ai = new GoogleGenAI({ apiKey: finalKey });


  try {
    const historyString = messageHistory
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

    const timeContext = settings?.shareTimeContext !== false ? `
CURRENT SYSTEM DATE AND TIME:
${getAppTimeContext(settings)}
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

    const voiceNotePrompt = isVoiceNoteReply ? `
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

    const recentMessagesWithMedia = messageHistory.slice(-5).filter(m => (m.image && m.image.startsWith('data:')) || (m.audio && m.audio.startsWith('data:')));
    const parts: any[] = [{ text: systemPrompt }];

    recentMessagesWithMedia.slice(-2).forEach(msg => {
      if (msg.image && msg.image.startsWith('data:')) {
        const base64Data = msg.image.split(',')[1] || msg.image;
        parts.push({
          inlineData: { mimeType: "image/jpeg", data: base64Data }
        });
      }
      if (msg.audio && msg.audio.startsWith('data:')) {
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

    const response = await ai.models.generateContent({
      model: settings?.selectedModel || DEFAULT_MODEL,
      contents: [{ role: 'user', parts }],
      config,
    });

    return response.text || "...";
  } catch (error: any) {
    console.error("Connection error:", error);
    if (error.status === 401 || error.status === 403) {
      return "Invalid API Key. Please check your settings.";
    }
    return "Connection issues... please try again.";
  }
};

export const getGeminiDiaryEntry = async (
  persona: { name: string; role?: string; speechStyle?: string; about?: string; systemInstruction?: string },
  messageHistory: { text: string; sender: string; senderName?: string }[],
  startDate: string,
  endDate: string,
  settings?: AppSettings
) => {
  const provider = settings?.aiProvider || 'vertex';

  if (provider === 'vertex') {
    if (!settings?.isVertexUnlocked) {
      return "Built-in Cloud (Vertex AI) is locked. Please enter the passcode in Settings to unlock server credits.";
    }
    return await fetchVertexDiary({
      persona,
      messageHistory: (messageHistory || []).slice(-40).map(m => ({
        text: m.text,
        sender: m.sender,
        senderName: m.senderName,
      })),
      startDate,
      endDate,
      settings: { selectedModel: settings?.selectedModel },
    });
  }

  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');

  if (!finalKey) {
    return "API Key not configured. Please enter your Gemini AI Studio API key in Settings, or switch to 'Built-in (Vertex AI)' mode.";
  }

  const ai = new GoogleGenAI({ apiKey: finalKey });

  try {
    const historyString = messageHistory
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

    const response = await ai.models.generateContent({
      model: settings?.selectedModel || DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: diaryPrompt }] }],
    });

    return response.text || "I couldn't find the words today...";
  } catch (error: any) {
    console.error("Diary generation error:", error);
    return "I'm having trouble reflecting on today right now...";
  }
};

export const generateGeminiVoiceNote = async (
  textWithCues: string,
  voiceName: string,
  settings?: AppSettings,
  personaContext?: {
    name?: string;
    speechStyle?: string;
    role?: string;
  }
): Promise<{ ok: boolean; audioDataUrl?: string; error?: string }> => {
  const provider = settings?.aiProvider || 'vertex';

  if (!textWithCues || !textWithCues.trim()) {
    return { ok: false, error: "Text is empty for voice note generation." };
  }

  const selectedVoice = voiceName || 'Aoede';
  const voiceDescriptor = getVoiceDescriptor(selectedVoice);
  const traitDesc = voiceDescriptor?.stylePrompt || voiceDescriptor?.trait || 'natural and expressive';

  // Construct Google Cloud recommended style prompt steering if not already styled
  let steeredInput = textWithCues.trim();
  const hasExistingDirective = steeredInput.startsWith('Say the following') || steeredInput.startsWith('TTS the following');

  if (!hasExistingDirective) {
    const promptParts = [
      personaContext?.name ? `as ${personaContext.name}` : '',
      `with a ${traitDesc} vocal tone`,
      personaContext?.speechStyle ? `(speech style: ${personaContext.speechStyle})` : ''
    ].filter(Boolean).join(' ');

    steeredInput = `Say the following in a natural WhatsApp voice note ${promptParts}: ${textWithCues.trim()}`;
  }

  // Option A: Vertex AI (Built-in Server Credits)
  if (provider === 'vertex') {
    if (!settings?.isVertexUnlocked) {
      return { ok: false, error: "Built-in Cloud (Vertex AI) is locked. Passcode required in Settings." };
    }
    const res = await fetchVertexTTS({
      text: steeredInput,
      voiceName: selectedVoice,
      stylePrompt: traitDesc,
      personaName: personaContext?.name,
      speechStyle: personaContext?.speechStyle
    });
    if (res.ok && res.audioData) {
      return { ok: true, audioDataUrl: res.audioData };
    }
    return { ok: false, error: res.error || "Vertex TTS generation failed." };
  }

  // Option B: Custom API Key (Gemini AI Studio)
  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');

  if (!finalKey) {
    return { ok: false, error: "API Key not configured. Enter your Gemini AI Studio API key in Settings." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: finalKey });
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
      return { ok: false, error: "Gemini TTS did not return audio data." };
    }

    const mimeType = part.inlineData.mimeType || 'audio/pcm;rate=24000';
    const rawBase64 = part.inlineData.data;

    let sampleRate = 24000;
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    if (rateMatch && rateMatch[1]) {
      sampleRate = parseInt(rateMatch[1], 10);
    }

    const audioDataUrl = pcmBase64ToWavDataUrl(rawBase64, sampleRate);
    return { ok: true, audioDataUrl };
  } catch (error: any) {
    console.error("Gemini AI Studio TTS error:", error);
    return { ok: false, error: error?.message || "TTS generation error." };
  }
};

/**
 * Helper to convert an avatar URL or data URI to base64 inlineData
 */
export async function resolveAvatarBase64(avatarUrl?: string): Promise<{ data: string; mimeType: string } | null> {
  if (!avatarUrl) return null;

  try {
    if (avatarUrl.startsWith('data:')) {
      const parts = avatarUrl.split(',');
      const mimeMatch = parts[0].match(/data:(.*?);base64/);
      return {
        mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
        data: parts[1] || ''
      };
    }

    const response = await fetch(avatarUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result && result.startsWith('data:')) {
          const parts = result.split(',');
          const mimeMatch = parts[0].match(/data:(.*?);base64/);
          resolve({
            mimeType: mimeMatch ? mimeMatch[1] : blob.type || 'image/jpeg',
            data: parts[1] || ''
          });
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Could not resolve avatar to base64:", err);
    return null;
  }
}

export type ImageGenerationMode = 'selfie' | 'candid' | 'pov';

export interface SynthesizeImageContextResult {
  mode: ImageGenerationMode;
  is_persona_subject: boolean;
  user_wants_posed?: boolean;
  caption: string;
  action_and_setting: string;
}

export async function synthesizeImageContextAndCaption(
  persona: {
    name: string;
    role?: string;
    speechStyle?: string;
    about?: string;
    systemInstruction?: string;
    humaneSettings?: HumaneSettings;
  },
  userPrompt: string,
  messageHistory: { text: string; sender: string; senderName?: string }[],
  userProfile?: UserProfile,
  settings?: AppSettings
): Promise<{ ok: boolean; result?: SynthesizeImageContextResult; error?: string }> {
  const provider = settings?.aiProvider || 'vertex';

  // Option A: Vertex AI
  if (provider === 'vertex') {
    if (!settings?.isVertexUnlocked) {
      return {
        ok: false,
        error: "Built-in Cloud (Vertex AI) is locked. Please enter passcode in Settings."
      };
    }

    try {
      const res = await fetch('/api/gemini/image-synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vertex-passcode': VERTEX_PASSCODE,
        },
        body: JSON.stringify({
          persona,
          userPrompt,
          messageHistory: (messageHistory || []).slice(-10).map(m => ({
            text: m.text,
            sender: m.sender,
            senderName: m.senderName,
          })),
          userProfile,
          settings: { selectedModel: settings?.selectedModel },
        }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        return { ok: true, result: data.result };
      }
      return { ok: false, error: data.error || 'Failed to synthesize photo context.' };
    } catch (e: any) {
      console.error("Error calling /api/gemini/image-synthesize:", e);
      return { ok: false, error: e.message || 'Unable to connect to synthesis endpoint.' };
    }
  }

  // Option B: Custom Studio API Key
  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');
  if (!finalKey) {
    return { ok: false, error: "API Key not configured." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: finalKey });
    const historySnippet = (messageHistory || [])
      .slice(-6)
      .map(m => `${m.sender === 'me' ? 'User' : (m.senderName || persona.name)}: ${m.text || ''}`)
      .join('\n');

    const synthesisPrompt = `You are a Context & Caption Synthesizer for an authentic, smartphone-style photo exchange in a messaging app.
The persona who will send the photo is:
Name: ${persona.name}
About: ${persona.about || 'N/A'}
Role: ${persona.role || 'N/A'}
Speech Style: ${persona.speechStyle || 'Casual WhatsApp texting'}
System Guidelines: ${persona.systemInstruction || 'N/A'}

Recent Chat History:
${historySnippet || '(No prior messages)'}

User Request / Current Prompt:
"${userPrompt}"

TASK:
Analyze the conversation and user request according to the following STRICT priority order:

1. USER QUERY FIRST (HIGHEST PRIORITY):
   If the user asks for something specific (e.g. "show me what you're eating", "send a pic of your dog", "show me your outfit", "selfie please"), follow their EXACT instruction above everything else.

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

    const response = await ai.models.generateContent({
      model: settings?.selectedModel || DEFAULT_MODEL,
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
      parsed = match ? JSON.parse(match[0]) : {};
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
      }
    };
  } catch (err: any) {
    console.error("Studio synthesis error:", err);
    return { ok: false, error: err.message || "Synthesis error." };
  }
}

export async function generatePersonaImage(options: {
  model?: string;
  mode?: ImageGenerationMode;
  is_persona_subject: boolean;
  user_wants_posed?: boolean;
  action_and_setting: string;
  avatarBase64?: string;
  avatarMimeType?: string;
  avatarUrl?: string;
  settings?: AppSettings;
}): Promise<{ ok: boolean; imageDataUrl?: string; error?: string; blocked?: boolean }> {
  const { model, action_and_setting, avatarBase64, avatarMimeType, avatarUrl, settings } = options;
  const mode: ImageGenerationMode = options.mode || (options.is_persona_subject ? 'selfie' : 'pov');
  const isSubject = mode === 'selfie' || mode === 'candid';
  const provider = settings?.aiProvider || 'vertex';
  const modelToUse = model || settings?.selectedImageModel || DEFAULT_IMAGE_MODEL;

  // Option A: Vertex AI
  if (provider === 'vertex') {
    if (!settings?.isVertexUnlocked) {
      return { ok: false, error: "Built-in Cloud (Vertex AI) is locked. Enter passcode in Settings." };
    }

    try {
      const res = await fetch('/api/gemini/image-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vertex-passcode': VERTEX_PASSCODE,
        },
        body: JSON.stringify({
          model: modelToUse,
          mode,
          is_persona_subject: isSubject,
          user_wants_posed: options.user_wants_posed,
          action_and_setting,
          avatarBase64,
          avatarMimeType,
          avatarUrl,
        }),
      });

      const data = await res.json();
      if (res.ok && data.imageData) {
        return { ok: true, imageDataUrl: data.imageData };
      }
      return {
        ok: false,
        error: data.error || "Failed to generate image.",
        blocked: data.blocked,
      };
    } catch (e: any) {
      console.error("Error calling /api/gemini/image-generate:", e);
      return { ok: false, error: e.message || "Failed to connect to image generation endpoint." };
    }
  }

  // Option B: Custom Studio API Key
  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');
  if (!finalKey) {
    return { ok: false, error: "API Key not configured." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: finalKey });
    let parts: any[] = [];
    let promptText = '';

    if (mode === 'selfie') {
      promptText = `Use [Input Image 1] as the subject reference (identical face, exact facial structure, hair, and eye shape). A spontaneous, casual amateur selfie taken on a smartphone front-facing camera. She is ${action_and_setting}. Arm extended holding the phone at a slight, natural angle; the shot is slightly off-center and imperfectly framed. Natural, flat indoor lighting or screen glare illuminating her face—strictly no studio rim lighting or warm glam glow. Casual relaxed expression, half-smile or candid smirk (not an Instagram model pose). Authentic smartphone front-lens compression, subtle motion blur around edges, faint digital camera grain. Raw unedited Snapchat/WhatsApp front camera snap, zero beauty filter, zero cinematic styling.`;

      if (avatarBase64) {
        parts.push({
          inlineData: {
            mimeType: avatarMimeType || 'image/jpeg',
            data: avatarBase64.includes(',') ? avatarBase64.split(',')[1] : avatarBase64,
          }
        });
      }
      parts.push({ text: promptText });
    } else if (mode === 'candid') {
      if (options.user_wants_posed) {
        promptText = `Use [Input Image 1] as the subject reference (same woman, exact same facial features, hair, and skin tone). A casual, amateur smartphone snapshot of her ${action_and_setting}. She is posing casually for someone taking her photo on a phone, looking directly toward the camera with a natural, unforced expression. Shot on an everyday smartphone, slightly imperfect composition, authentic room/outdoor lighting. Realistic skin texture, natural soft focus, raw unedited mobile photo.`;
      } else {
        promptText = `Use [Input Image 1] as the subject reference (same woman, exact same facial features, hair, and skin tone). A natural, unposed amateur photo of her ${action_and_setting}. Captured quickly on an everyday smartphone, feels accidental rather than staged. Composition is slightly imperfect: off-center framing, awkward angle (either slightly too low or tilted, horizon not completely straight, or part of her body slightly cropped out of frame). She is mid-action or looking away casually (looking at her phone, lost in thought, or reaching for something—not aware of or posing for the camera). Uneven realistic lighting [e.g., flat fluorescent lighting, harsh daylight with one side slightly overblown, or fading low light with subtle grain]. Focus is naturally soft or slightly missed rather than razor-sharp, with subtle motion blur from quick movement. An uncurated, unedited raw capture sent over chat.`;
      }

      if (avatarBase64) {
        parts.push({
          inlineData: {
            mimeType: avatarMimeType || 'image/jpeg',
            data: avatarBase64.includes(',') ? avatarBase64.split(',')[1] : avatarBase64,
          }
        });
      }
      parts.push({ text: promptText });
    } else {
      // mode === 'pov'
      promptText = `A casual amateur first-person POV photo taken on a smartphone of ${action_and_setting}. Documentary everyday realism, flat natural light or harsh indoor fluorescent bulbs. Slightly off-center angle, real clutter in the background, believable phone lens depth. An accidental 2-second snapshot, no editorial color grading, zero artistic styling.`;
      parts.push({ text: promptText });
    }

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
    if (candidate?.finishReason === 'SAFETY') {
      return { ok: false, blocked: true, error: "Prompt triggered safety filter." };
    }

    const part = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);
    if (part && part.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'image/jpeg';
      return {
        ok: true,
        imageDataUrl: `data:${mime};base64,${part.inlineData.data}`,
      };
    }

    return { ok: false, error: "No image received from Gemini." };
  } catch (err: any) {
    console.error("Studio image generation error:", err);
    const errStr = err?.message || String(err);
    return {
      ok: false,
      blocked: errStr.includes('SAFETY') || errStr.includes('blocked'),
      error: errStr,
    };
  }
}

export async function generatePersonaImageExcuse(
  persona: {
    name: string;
    role?: string;
    speechStyle?: string;
    about?: string;
    systemInstruction?: string;
    humaneSettings?: HumaneSettings;
  },
  userPrompt: string,
  settings?: AppSettings
): Promise<string> {
  const provider = settings?.aiProvider || 'vertex';

  if (provider === 'vertex') {
    try {
      const res = await fetch('/api/gemini/image-excuse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vertex-passcode': VERTEX_PASSCODE,
        },
        body: JSON.stringify({
          persona,
          userPrompt,
          settings: { selectedModel: settings?.selectedModel },
        }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        return data.text;
      }
    } catch (e) {
      console.warn("Fallback to local excuse:", e);
    }
  } else {
    const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');
    if (finalKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: finalKey });
        const excusePrompt = `You are ${persona.name}. The user asked you to send a photo ('${userPrompt}'), but right now your camera is unavailable (e.g. app crashed, camera glitch, bad lighting). In your exact natural speech style (${persona.speechStyle || 'casual'}), reply with 1 short, in-character sentence explaining why you can't send one right now. Never say you are an AI.`;
        const res = await ai.models.generateContent({
          model: settings?.selectedModel || DEFAULT_MODEL,
          contents: [{ role: 'user', parts: [{ text: excusePrompt }] }],
        });
        if (res.text) return res.text.trim();
      } catch (e) {
        console.warn("Studio excuse generation failed:", e);
      }
    }
  }

  // Graceful deterministic fallback
  const excuses = [
    "My camera app literally just crashed on me, hold on!",
    "Ugh, terrible lighting in here right now haha, I'll send one later!",
    "My lens is completely fogged up right now lol, give me a bit!",
    "Phone is glitching out when I open the camera, hold up!"
  ];
  return excuses[Math.floor(Math.random() * excuses.length)];
}

