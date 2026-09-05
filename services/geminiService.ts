import { GoogleGenAI } from "@google/genai";
import { UserProfile, AppSettings, HumaneSettings } from "../types";
import { DEFAULT_MODEL, VERTEX_PASSCODE, getVoiceDescriptor } from "../constants";
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
      messageHistory,
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

    const recentMessagesWithMedia = messageHistory.slice(-5).filter(m => m.image || m.audio);
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
      messageHistory,
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
