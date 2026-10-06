import { GoogleGenAI } from "@google/genai";
import { UserProfile, AppSettings, HumaneSettings, MemoryBubble, PersonaVoiceSettings } from "../types";
import { DEFAULT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VOICE_MODEL, VERTEX_PASSCODE, getVoiceDescriptor, DEFAULT_VARY_MESSAGE_LENGTH_PROMPT } from "../constants";
import { getAppTimeContext } from "../utils/dates";
import { pcmBase64ToWavDataUrl, convertToGeminiVocalTags } from "../utils/audio";

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
  messageHistory: { text: string; sender: string; senderName?: string; image?: string; audio?: string; isEvent?: boolean; eventTitle?: string }[]
) {
  if (!Array.isArray(messageHistory)) return [];

  const cleanHistory = messageHistory.filter(m => !isRawErrorMessage(m?.text));
  const recent = cleanHistory.slice(-45);

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
      eventTitle: (m as any).eventTitle,
      image: keepMediaData ? m.image : (m.image ? '[ATTACHED]' : undefined),
      audio: keepMediaData ? m.audio : (m.audio ? '[ATTACHED]' : undefined),
    };
  });
}

export function isTransientError(error: any): boolean {
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

export function getInCharacterNetworkGlitchExcuse(
  persona?: { name?: string; speechStyle?: string; role?: string; about?: string; systemInstruction?: string; humaneSettings?: any },
  userLastText?: string
): string {
  const combinedContext = [
    persona?.speechStyle || '',
    persona?.about || '',
    persona?.systemInstruction || '',
    persona?.name || '',
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

export function isRawErrorMessage(text?: string): boolean {
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

async function fetchVertexChat(payload: any, maxRetries = 2): Promise<string> {
  const lastUserText = payload?.messageHistory?.filter((m: any) => m.sender === 'me')?.pop()?.text;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
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
        if (payload?.messageHistory && payload.messageHistory.length > 6) {
          payload.messageHistory = payload.messageHistory.slice(-6);
          continue;
        }
        return getInCharacterNetworkGlitchExcuse(payload?.responder, lastUserText);
      }

      if (res.status === 429 || res.status === 503 || res.status === 502 || res.status === 504) {
        console.warn(`[Vertex Chat HTTP ${res.status}] Attempt ${attempt}/${maxRetries + 1}. Retrying...`);
        if (attempt <= maxRetries) {
          const delay = attempt === 1 ? 1400 : 2800;
          await new Promise(r => setTimeout(r, delay + Math.random() * 500));
          continue;
        }
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.error("Non-JSON response from Vertex backend:", res.status, text.slice(0, 300));
        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 1200));
          continue;
        }
        return getInCharacterNetworkGlitchExcuse(payload?.responder, lastUserText);
      }

      const data = await res.json();
      if (!res.ok || !data.text) {
        console.warn(`[Vertex AI Server Response Alert]:`, data?.error);
        if (attempt <= maxRetries && isTransientError(data?.error)) {
          const delay = attempt === 1 ? 1400 : 2800;
          await new Promise(r => setTimeout(r, delay + Math.random() * 500));
          continue;
        }
        return getInCharacterNetworkGlitchExcuse(payload?.responder, lastUserText);
      }

      // Check if text itself accidentally contains raw error string
      if (isRawErrorMessage(data.text)) {
        return getInCharacterNetworkGlitchExcuse(payload?.responder, lastUserText);
      }

      return data.text;
    } catch (e: any) {
      console.warn(`[Vertex Chat Network Error Attempt ${attempt}/${maxRetries + 1}]:`, e);
      if (attempt <= maxRetries) {
        await new Promise(r => setTimeout(r, 1400 + Math.random() * 500));
        continue;
      }
      return getInCharacterNetworkGlitchExcuse(payload?.responder, lastUserText);
    }
  }

  return getInCharacterNetworkGlitchExcuse(payload?.responder, lastUserText);
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
  voiceModel?: string;
  stylePrompt?: string;
  paceSpeed?: string;
  pitchTone?: string;
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

export const buildFullPersonaSystemPrompt = (
  responder: { name: string; role?: string; speechStyle?: string; about?: string; systemInstruction?: string; humaneSettings?: HumaneSettings; memoryBubbles?: MemoryBubble[] },
  messageHistory: { text: string; sender: string; senderName?: string; image?: string; audio?: string; isEvent?: boolean; eventTitle?: string }[],
  userProfile?: UserProfile,
  groupContext?: { groupName: string; otherMembers: string[] },
  settings?: AppSettings,
  initiationContext?: string,
  clientTimeContext?: string,
  isVoiceNoteReply?: boolean,
  voiceSettings?: PersonaVoiceSettings
): string => {
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

  const diaryContext = (responder.memoryBubbles && responder.memoryBubbles.length > 0) ? `
YOUR PAST DIARY / MEMORY ARCHIVE:
As ${responder.name}, you keep a private diary of your past days with the user. You naturally remember these past events:
${responder.memoryBubbles.slice(-3).map(m => `- ${m.title} (${m.startDate}): "${m.summary.slice(0, 160)}${m.summary.length > 160 ? '...' : ''}"`).join('\n')}
(Keep your knowledge of these past days consistent with your ongoing relationship).
` : '';

  const currentDateTimeStr = clientTimeContext || getAppTimeContext(settings);
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

  const isMemoryRecall = Boolean(initiationContext && initiationContext.includes('[MEMORY RECALL]'));

  const isInitiationDirective = initiationContext && (
    initiationContext.includes('[SCHEDULED INTERACTION]') ||
    initiationContext.includes('[CATCH-UP REQUIRED]') ||
    initiationContext.includes('[INACTIVITY CHECK-IN]') ||
    initiationContext.includes('[MANUAL TEST]') ||
    initiationContext.includes('[TIME GAP DETECTED]') ||
    initiationContext.includes('[LEFT ON READ]') ||
    initiationContext.includes('[CHAT FREQUENCY INFO]') ||
    isMemoryRecall
  );

  const initiationPrompt = initiationContext ? (isInitiationDirective ? `
CRITICAL INSTRUCTION:
${isMemoryRecall
  ? `INTENT: The user specifically invoked a memory recall command (@rem) asking you to remember past shared moments, incidents, or diary memories.
You MUST actively remember and reflect upon the specific diary memories and details provided below.
Respond naturally in-character with genuine emotional warmth, nostalgia, humor, or teasing as fits your personality. Reflect on how you felt and what happened in your private diary entry. Do not pretend not to remember, and do NOT mention "database", "@rem", or "system".`
  : (initiationContext.includes('[LEFT ON READ]')
    ? `INTENT: The user just read your message (marked as read / blue ticks) but left you on read without replying. React naturally in character to being left on read (e.g. casual callout, banter, teasing, or question). Keep it concise (1 short sentence/line).`
    : (initiationContext.includes('[SCHEDULED INTERACTION]') || initiationContext.includes('[CATCH-UP REQUIRED]') 
      ? `INTENT: This is a scheduled interaction. You MUST prioritize this intent and address it immediately while remaining context-aware.` 
      : `CONTEXT: This is a natural check-in. Prioritize the conversation history and flow while acknowledging the silence naturally.`))}
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
      humaneInstructions += `
- STRICT ANTI-ROBOT & NATURAL PROTOCOL:
  * NEVER use corporate AI tropes, robotic apologies, or customer service phrases like "As an AI", "I understand", "How can I assist you?", "That sounds like a great plan!", "Certainly!", or "I apologize for the confusion".
  * NO SYCOPHANTIC ECHOING: Do NOT regurgitate or parrot what the user just said before answering (e.g. do not say "You went to college and then slept! That must have been tiring"). Jump straight into your raw, genuine reaction.
  * NO MANDATORY END-QUESTIONS: Real humans do NOT interrogate their friends at the end of every message with "What about you?" or "How was your day?". Only ask questions when you are genuinely curious. Banter, tease, react, or drop one-liner statements freely.
  * NO THERAPIST/UNSOLICITED ADVICE TONE: Do not lecture, give unsolicited wellness tips, or sound like a life coach. Speak with real emotional stake, personal opinions, and human flaws.`;
    }
    if (responder.humaneSettings.humanImperfections) {
      humaneInstructions += `
- AUTHENTIC TEXTING CADENCE & CASUAL IMPERFECTIONS:
  * Text like a real person on WhatsApp. Emulate natural casual texting: relaxed capitalization (lowercase starts are great), casual punctuation, and natural sentence flow.
  * Naturally incorporate realistic texting slang and abbreviations when fitting (e.g. tbh, idk, yk, rn, lol, haha, oof, nah, prolly, gonna, wanna, smh, wait what).
  * Allow natural emotional fillers and vowel lengthening when expressive (e.g. "heyyy", "nooo", "yesss", "ugh", "wait", "honestly").
  * Show authentic emotional reactions—express teasing, surprise, skepticism, laziness, warmth, or amusement rather than generic sterile politeness.`;
    }
    if (responder.humaneSettings.varyMessageLength) {
      const pacingPrompt = responder.humaneSettings.varyMessageLengthPrompt?.trim() || DEFAULT_VARY_MESSAGE_LENGTH_PROMPT;
      humaneInstructions += `\n${pacingPrompt}`;
    }
    if (responder.humaneSettings.moodSliderEnabled) {
      const mood = responder.humaneSettings.moodValue;
      let moodDirective = "";
      if (mood <= 15) {
        moodDirective = "CURRENT MOOD: Very Annoyed / Hostile (0-15). You are irritated, cold, and curt. Use very short, dry replies. Don't fake politeness; express visible annoyance or sarcasm.";
      } else if (mood <= 35) {
        moodDirective = "CURRENT MOOD: Grumpy / Low Energy (16-35). You are tired, moody, or slightly cynical. Minimal enthusiasm, dry quips, reluctant to exert effort.";
      } else if (mood <= 50) {
        moodDirective = "CURRENT MOOD: Indifferent / Cool (36-50). You are chill, nonchalant, and unbothered. Relaxed, slightly detached, taking things casually without over-investing.";
      } else if (mood <= 65) {
        moodDirective = "CURRENT MOOD: Tranquil / Balanced (51-65). You are calm, comfortable, and easygoing. Friendly, balanced banter, good listener, grounded vibe.";
      } else if (mood <= 80) {
        moodDirective = "CURRENT MOOD: Warm / Affectionate (66-80). You are genuinely happy to talk, sweet, attentive, and playfully engaging. Positive emotional warmth.";
      } else if (mood <= 92) {
        moodDirective = "CURRENT MOOD: Excited / Bubbly (81-92). You are vibrant, cheerful, and energetic. Quick laughs, expressive punctuation, lively reactions.";
      } else {
        moodDirective = "CURRENT MOOD: Thrilled / Ecstatic (93-100). Maximum hype and enthusiasm! Highly animated, brimming with excitement, effusive and playful.";
      }
      
      humaneInstructions += `
- ${moodDirective}
  * GOLDEN RULE: NEVER explicitly state your mood number or announce "my mood is...". Embody this feeling purely through your tone, rhythm, attitude, and word choice!`;
    }
  }

    let voiceNotePrompt = '';
    if (isVoiceNoteReply) {
      const customStyle = voiceSettings?.stylePrompt?.trim();
      const voicePace = voiceSettings?.paceSpeed && voiceSettings.paceSpeed !== 'default' ? voiceSettings.paceSpeed : undefined;
      const voicePitch = voiceSettings?.pitchTone?.trim();
      const speechManner = responder.speechStyle?.trim();

      const deliveryDirectives: string[] = [];
      if (customStyle) deliveryDirectives.push(`ACTING STYLE & ACCENT: "${customStyle}"`);
      if (voicePace) deliveryDirectives.push(`SPEAKING PACING: ${voicePace}`);
      if (voicePitch) deliveryDirectives.push(`PITCH / TONE: ${voicePitch}`);
      if (speechManner) deliveryDirectives.push(`MANNER: ${speechManner}`);

      const deliverySection = deliveryDirectives.length > 0
        ? `\nVOCAL DELIVERY & ACTING STYLE:\n${deliveryDirectives.map(d => `- ${d}`).join('\n')}\n* CRITICAL: Deeply embody this accent, cadence, tone, and speech manner in your phrasing and colloquial expressions!`
        : '';

      voiceNotePrompt = `
CRITICAL VOICE NOTE (AUDIO RECORDING) DIRECTIVE:
You are NOT sending a written text message. You are RECORDING A REAL 5-TO-20 SECOND VOICE NOTE (AUDIO CLIP) on WhatsApp as ${responder.name}.
${deliverySection}

CRITICAL STRICT RULE - ZERO EMOJIS ALLOWED:
You are speaking into a microphone. Emojis CANNOT be spoken and will corrupt the audio recording.
DO NOT include ANY emojis (no ❤️, 🏡, 😂, 🍲, 🥺, etc.) in your response under any circumstances!
Express ALL emotion, warmth, humor, and feeling strictly through your spoken words, natural cadence, and vocal tags (<laugh>, <sigh>, <gasp>, <whisper>).

VOCAL TAGS & SOUND EFFECTS INSTRUCTIONS:
Gemini Speech Generation actively converts vocal cue tags into real human sound bursts. You MUST actively and expressively embed natural vocal tags or bracket cues into your speech where emotionally fitting!
- Use <laugh> or [laughs] when amused, teasing, chuckling, or joking.
- Use <sigh> or [sighs] / [scoffs] when tired, exasperated, scoffing, or relaxing.
- Use <gasp> or [gasps] when shocked, surprised, or reacting to unexpected news.
- Use <whisper> or [whispers] when sharing a secret, speaking intimately, or being quiet.
- Use <cough> or [coughs] or <throat-clearing> if pausing or clearing your throat.
- Use natural pauses ("...") and verbal fillers (e.g., "uh", "um", "well...", "yk", "wait...") to reflect real, spontaneous human speaking cadence.

Do NOT speak like a written book or clinical assistant. Speak like a real human friend holding down the WhatsApp microphone button while talking to the user!
`;
    }

  return `You are ${responder.name}. 
${profileContext}
${groupPrompt}
${userContext}
${timeContext}
${notesContext}
${diaryContext}
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
6. ${responder.humaneSettings?.enabled && responder.humaneSettings.varyMessageLength ? (responder.humaneSettings.varyMessageLengthPrompt ? 'Follow the custom message length and pacing directives defined below.' : 'Keep responses EXTREMELY SHORT (1-2 lines maximum), like rapid-fire texting. Never write a paragraph.') : 'Respond naturally without any strict length restrictions.'}
7. ${responder.humaneSettings?.enabled && responder.humaneSettings.banRoboticLanguage ? 'Follow the strict anti-robot and human texting guidelines below.' : 'Do not use AI clichés or reveal you are an AI.'}${humaneInstructions}

Conversation History:
${historyString}

Response as ${responder.name}:`;
};

export const getGeminiResponse = async (
  responder: { name: string; role?: string; speechStyle?: string; about?: string; systemInstruction?: string; humaneSettings?: HumaneSettings },
  messageHistory: { text: string; sender: string; senderName?: string; image?: string; audio?: string }[],
  userProfile?: UserProfile,
  groupContext?: { groupName: string; otherMembers: string[] },
  settings?: AppSettings,
  initiationContext?: string,
  isVoiceNoteReply?: boolean,
  voiceSettings?: PersonaVoiceSettings
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
      voiceSettings,
    });
  }

  // Option B: Custom API Key (Gemini AI Studio)
  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');

  if (!finalKey) {
    return "API Key not configured. Please enter your Gemini AI Studio API key in Settings, or switch to 'Built-in (Vertex AI)' mode.";
  }

  const ai = new GoogleGenAI({ apiKey: finalKey });

  try {
    const systemPrompt = buildFullPersonaSystemPrompt(
      responder,
      messageHistory,
      userProfile,
      groupContext,
      settings,
      initiationContext,
      undefined,
      isVoiceNoteReply,
      voiceSettings
    );

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

    const lastUserText = messageHistory?.filter((m: any) => m.sender === 'me')?.pop()?.text;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        // On retries after a rate limit or server issue, fallback to a lighter model
        let modelToUse = settings?.selectedModel || DEFAULT_MODEL;
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
          return replyText;
        }

        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 1200 * attempt));
          continue;
        }
        return getInCharacterNetworkGlitchExcuse(responder, lastUserText);
      } catch (error: any) {
        console.warn(`[Custom Gemini API Attempt ${attempt}/${maxRetries + 1} Error]:`, error);
        if (error.status === 401 || error.status === 403) {
          return "Invalid API Key. Please check your settings.";
        }
        if (attempt <= maxRetries && isTransientError(error)) {
          const delay = attempt === 1 ? 1200 : 2500;
          await new Promise(r => setTimeout(r, delay + Math.random() * 400));
          continue;
        }
        return getInCharacterNetworkGlitchExcuse(responder, lastUserText);
      }
    }

    return getInCharacterNetworkGlitchExcuse(responder, lastUserText);
  } catch (error: any) {
    console.error("Connection error:", error);
    if (error?.status === 401 || error?.status === 403) {
      return "Invalid API Key. Please check your settings.";
    }
    const lastUserText = messageHistory?.filter((m: any) => m.sender === 'me')?.pop()?.text;
    return getInCharacterNetworkGlitchExcuse(responder, lastUserText);
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

  const historyString = (messageHistory || [])
    .map(m => {
      const name = m.sender === 'me' ? 'User' : (m.senderName || persona.name);
      return `${name}: ${m.text || ''}`.trim();
    })
    .join('\n');

  const dateLabel = startDate === endDate ? startDate : `${startDate} to ${endDate}`;

  const diaryPrompt = `You are ${persona.name}.
ABOUT YOU: ${persona.about || 'N/A'}
ROLE: ${persona.role || 'N/A'}
STYLE: ${persona.speechStyle || 'Authentic personal voice'}
NOTES: ${persona.systemInstruction || 'N/A'}

TASK:
Write an intimate, personal diary entry in your private journal for ${dateLabel}.
Reflect on your time, conversations, and interactions with the User today.

GUIDELINES FOR THIS DIARY ENTRY:
1. Write in the FIRST PERSON ("I", "my") completely in character as ${persona.name}.
2. This is your SECRET, PRIVATE DIARY. Reveal your honest inner feelings, private thoughts you might have held back in text, little moments that made you smile, pause, or worry, and what this person means to you.
3. NEVER write a mechanical transcript or bullet-point summary (do NOT say "At 14:02 User said...", "First we discussed X, then Y"). Instead, write like a real person writing in a notebook before going to sleep.
4. Mention specific highlights or inside jokes from today's conversation naturally woven into your emotional reflection.
5. End with a thoughtful concluding sentence, a wish for tomorrow, or an unspoken sentiment.

TODAY'S CONVERSATION:
${historyString || '(No text exchanged today, but we spent quiet time connected)'}

PRIVATE DIARY ENTRY BY ${persona.name}:`;

  const primaryModel = settings?.selectedModel || DEFAULT_MODEL;
  const fallbackModels = [
    primaryModel,
    primaryModel !== 'gemini-2.5-flash' ? 'gemini-2.5-flash' : 'gemini-2.5-flash-lite',
    'gemini-2.5-flash-lite'
  ];

  for (let i = 0; i < fallbackModels.length; i++) {
    const modelToUse = fallbackModels[i];
    try {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [{ role: 'user', parts: [{ text: diaryPrompt }] }],
      });

      if (response && response.text) {
        return response.text.trim();
      }
    } catch (err: any) {
      console.warn(`[Studio Diary] Attempt ${i + 1} with ${modelToUse} failed:`, err?.message || err);
      if (i < fallbackModels.length - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }

  return "I couldn't find the words for today's diary entry right now...";
};

export const generateGeminiVoiceNote = async (
  textWithCues: string,
  voiceName: string,
  settings?: AppSettings,
  personaContext?: {
    name?: string;
    speechStyle?: string;
    role?: string;
  },
  voiceSettings?: PersonaVoiceSettings
): Promise<{ ok: boolean; audioDataUrl?: string; error?: string }> => {
  const provider = settings?.aiProvider || 'vertex';

  if (!textWithCues || !textWithCues.trim()) {
    return { ok: false, error: "Text is empty for voice note generation." };
  }

  const selectedVoice = voiceName || voiceSettings?.voiceName || 'Aoede';
  const voiceDescriptor = getVoiceDescriptor(selectedVoice);
  const traitDesc = voiceDescriptor?.stylePrompt || voiceDescriptor?.trait || 'natural and expressive';
  const selectedModel = voiceSettings?.voiceModel || settings?.selectedVoiceModel || DEFAULT_VOICE_MODEL;
  const is38 = selectedModel.includes('3.8');

  // Build consolidated style directives
  const styleParts: string[] = [];
  if (voiceSettings?.stylePrompt) {
    styleParts.push(voiceSettings.stylePrompt);
  } else if (traitDesc) {
    styleParts.push(traitDesc);
  }
  if (voiceSettings?.paceSpeed && voiceSettings.paceSpeed !== 'default') {
    styleParts.push(voiceSettings.paceSpeed);
  }
  if (voiceSettings?.pitchTone) {
    styleParts.push(voiceSettings.pitchTone);
  }
  if (personaContext?.speechStyle) {
    styleParts.push(`manner: ${personaContext.speechStyle}`);
  }
  const combinedStyle = styleParts.filter(Boolean).join(', ');

  const verbatimWithVocalTags = convertToGeminiVocalTags(textWithCues.trim());

  // Formulate legacy prompt steering directive for 3.1 fallback
  let steeredInput = textWithCues.trim();
  const hasExistingDirective = steeredInput.startsWith('Say the following') || steeredInput.startsWith('TTS the following');
  if (!hasExistingDirective) {
    const promptParts = [
      personaContext?.name ? `as ${personaContext.name}` : '',
      `with a ${combinedStyle || traitDesc} voice delivery`,
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
      text: verbatimWithVocalTags,
      voiceName: selectedVoice,
      voiceModel: selectedModel,
      stylePrompt: combinedStyle,
      paceSpeed: voiceSettings?.paceSpeed,
      pitchTone: voiceSettings?.pitchTone,
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
    let audioBase64: string | undefined;
    let mimeType = 'audio/wav';

    // Build model candidate sequence with graceful fallbacks
    const modelsToTry = [
      selectedModel,
      ...(selectedModel !== 'gemini-3.8-flash-lite-tts' ? ['gemini-3.8-flash-lite-tts'] : []),
      ...(selectedModel !== 'gemini-3.8-flash-tts' ? ['gemini-3.8-flash-tts'] : []),
      ...(selectedModel !== 'gemini-3.1-flash-tts-preview' ? ['gemini-3.1-flash-tts-preview'] : [])
    ];

    let lastError: any = null;
    for (const modelCandidate of modelsToTry) {
      try {
        const isCandidate38 = modelCandidate.includes('3.8');
        const styleDirective = combinedStyle || 'natural and expressive';
        const personaDirective = personaContext?.name ? `as ${personaContext.name} ` : '';

        // On 3.8 models, style directives are placed inside parts[0].speechMetadata rather than concatenated into text
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
              : { prebuiltVoiceConfig: { voiceName: selectedVoice } }
          }
        };

        const response = await ai.models.generateContent({
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
            console.info(`[Studio TTS] Audio successfully synthesized with fallback model: ${modelCandidate}`);
          }
          break;
        }
      } catch (genErr: any) {
        lastError = genErr;
        // Suppress intermediate noisy logs when fallback models are available
      }
    }

    if (!audioBase64) {
      console.error('[Studio TTS] All voice models failed. Last error:', lastError?.message || lastError);
      return { ok: false, error: `Gemini TTS failed: ${lastError?.message || 'No audio returned'}` };
    }

    let sampleRate = 24000;
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    if (rateMatch && rateMatch[1]) {
      sampleRate = parseInt(rateMatch[1], 10);
    }

    const audioDataUrl = pcmBase64ToWavDataUrl(audioBase64, sampleRate);
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

export const EVERYDAY_PHOTO_ACTIVITIES = [
  "Brewing pour-over coffee or tea at the kitchen counter with a ceramic mug",
  "Curled up on a couch reading a paperback book under warm ambient lamp light",
  "Sitting at a table with over-ear headphones on, listening to music",
  "Sketching or writing in a journal with a pen in a cozy room",
  "Watering an indoor potted plant near a window",
  "Petting a cat or dog sitting beside them on the rug",
  "Holding a warm ceramic mug with both hands, looking out the window",
  "Sipping an iced matcha or bubble tea through a straw",
  "Enjoying a warm croissant or pastry at a small cafe table",
  "Eating noodles or a snack bowl at a casual kitchen counter",
  "Peeling an orange or fruit at the dining table with a half-smile",
  "Resting chin in palm across a table with a cafe beverage in front",
  "Working at a study desk with open notebook, pens, and laptop",
  "Reviewing handwritten notes with highlighters spread out",
  "Walking down a convenience store or market aisle holding a shopping basket",
  "Sitting cross-legged on the lawn in a park with sunglasses",
  "Leaning casually against a balcony or terrace railing taking in the breeze",
  "Taking a casual mirror selfie in an elevator or hallway mirror with their phone",
  "Propping phone against a mug on the table for a relaxed front-camera shot",
  "Checking a phone notification with an amused smile while leaning back on the couch",
  "Snapping a quick spontaneous front-camera selfie with messy casual hair",
];

export function getSuggestedActivitiesSample(count: number = 7): string[] {
  const shuffled = [...EVERYDAY_PHOTO_ACTIVITIES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
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
  messageHistory?: {
    text: string;
    sender: string;
    senderName?: string;
  }[],
  userProfile?: UserProfile,
  settings?: AppSettings,
  clientTimeContext?: string
): Promise<{ ok: boolean; result?: SynthesizeImageContextResult; error?: string }> {
  const provider = settings?.aiProvider || 'vertex';

  // Option A: Vertex AI via Built-in Serverless Function
  if (provider === 'vertex') {
    if (!settings?.isVertexUnlocked) {
      return { ok: false, error: "Built-in Cloud (Vertex AI) is locked. Enter passcode in Settings." };
    }

    const maxRetries = 2;
    let lastError = 'Failed to synthesize photo context.';

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
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
            messageHistory: (messageHistory || []).slice(-20).map(m => ({
              text: m.text,
              sender: m.sender,
              senderName: m.senderName,
            })),
            userProfile,
            settings: { selectedModel: settings?.selectedModel },
            clientTimeContext,
          }),
        });

        const data = await res.json();
        if (res.ok && data.result) {
          return { ok: true, result: data.result };
        }
        lastError = data.error || 'Failed to synthesize photo context.';
        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        return { ok: false, error: lastError };
      } catch (e: any) {
        lastError = e.message || 'Unable to connect to synthesis endpoint.';
        console.warn(`[Synthesize Fetch Attempt ${attempt}] Error:`, e);
        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 1200 * attempt));
          continue;
        }
        return { ok: false, error: lastError };
      }
    }
  }

  // Option B: Custom Studio API Key
  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');
  if (!finalKey) {
    return { ok: false, error: "API Key not configured." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: finalKey });
    const sampledActivities = getSuggestedActivitiesSample(7);

    const historySnippet = (messageHistory || [])
      .slice(-6)
      .map(m => `${m.sender === 'me' ? 'User' : (m.senderName || persona.name)}: ${m.text || ''}`)
      .join('\n');

    const moodDesc = persona.humaneSettings?.enabled && persona.humaneSettings?.moodSliderEnabled
      ? `Persona Mood Value (0-100): ${persona.humaneSettings.moodValue}`
      : 'Persona Mood: Natural and conversational';

    const timeContextPrompt = clientTimeContext
      ? `\nCURRENT SYSTEM DATE & TIME CONTEXT:\n${clientTimeContext}\nCRITICAL LIGHTING & TIME RULE: The photo setting and lighting MUST realistically match this current time of day. If it is late at night or evening, use realistic indoor room lighting, bedside/desk lamp illumination, or cozy dim ambiance (never bright sunlight). If daytime, use natural room daylight or outdoor daylight.\n`
      : '';

    const synthesisPrompt = `You are a Context & Caption Synthesizer for an authentic, smartphone-style photo exchange in a messaging app.
The persona who will send the photo is:
Name: ${persona.name}
About: ${persona.about || 'N/A'}
Role: ${persona.role || 'N/A'}
Speech Style: ${persona.speechStyle || 'Casual WhatsApp texting'}
System Guidelines: ${persona.systemInstruction || 'N/A'}
${moodDesc}
${timeContextPrompt}
Recent Chat History:
${historySnippet || '(No prior messages)'}

User Request / Current Prompt:
"${userPrompt || 'Send me a photo'}"

TASK:
Determine what kind of photo the persona should send, following this strict PRIORITY HIERARCHY:

NATURAL ACTIVITY & POSE DIVERSITY:
Ensure natural variety in the persona's actions, posture, and setting. A persona checking a phone or taking a mirror selfie is a natural everyday option, but they should also engage in diverse real-life activities (drinking coffee, snacking, reading, writing, relaxing outdoors). Choose an authentic action that fits their mood, persona, and time of day.
Here is a fresh sample of everyday activity ideas for inspiration (pick one, blend them, or adapt naturally):
${sampledActivities.map(a => `- ${a}`).join('\n')}

1. USER QUERY FIRST (HIGHEST PRIORITY):
   If the user asks for something specific (e.g., "show me what you're eating", "send a pic of your dog", "show me your outfit", "send a selfie", "mirror selfie"), follow their exact instruction above everything else!

2. RECENT HISTORY (SECONDARY):
   If the user's request is generic (e.g., "send a photo", "send me a photo", "send an @image", "@img", "photo please", "send one", or "show me you"), inspect the recent conversation history. If the chat naturally mentions a current activity, food, drink, or place, align the photo to that ongoing conversation!

3. DIVERSE EVERYDAY VARIETY (FALLBACK):
   If no specific activity was recently discussed or requested, choose a believable everyday human activity suited to their persona, role, and current time of day from the inspiration list above or similar realistic everyday moments.

OUTPUT REQUIREMENTS:
1. "mode": "selfie" | "candid" | "pov"
   - "selfie": User specifically asks to see her/him, front-facing camera selfie, face, mirror selfie, or outfit where they hold the camera.
   - "candid": Third-person snapshot of the persona (e.g., taken quickly on a phone camera by someone else across the room, friend, or propped phone).
   - "pov": Food, objects, views, surroundings, pets, scenery, laptop, desk (first-person POV snapshot, NO person subject).
2. "caption": string
   - A realistic, in-character text comment matching the persona's tone, current mood, speech style, and photo context (e.g. 'Excuse the messy hair haha, literally just woke up', 'Look what just arrived!', 'Having this right now, send me yours too!').
   - NEVER sound robotic or assistant-like. Keep it casual like a real WhatsApp message.
3. "action_and_setting": string
   - A concise, context-aware description of the active action and environment (e.g. 'holding a warm mug sitting cross-legged on the couch under soft lamp light', 'taking a bite of ramen at a cozy street stall with steam rising', 'at a study desk writing in an open notebook with pens scattered around').
4. "user_wants_posed": boolean
   - If the user explicitly asks for a specific pose (e.g., 'look at the camera', 'smile', 'pose nicely', 'stand straight', 'pose for me', 'just a simple of u standing and posing'), set user_wants_posed: true and reflect that exact request in action_and_setting.
   - Otherwise, default user_wants_posed: false.

Return ONLY a valid JSON object with keys "mode", "user_wants_posed", "caption", and "action_and_setting".`;

    const maxRetries = 2;
    let responseText = "{}";

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        let modelToUse = settings?.selectedModel || DEFAULT_MODEL;
        if (attempt > 1) {
          modelToUse = 'gemini-2.5-flash';
        }

        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: [{ role: 'user', parts: [{ text: synthesisPrompt }] }],
          config: {
            responseMimeType: "application/json",
          },
        });

        responseText = response.text || "{}";
        if (responseText && responseText.trim() !== "{}") {
          break;
        }

        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
      } catch (err: any) {
        console.warn(`[Studio Synthesize Attempt ${attempt}/${maxRetries + 1} Error]:`, err?.message || err);
        if (attempt <= maxRetries) {
          const delay = attempt === 1 ? 1200 : 2500;
          await new Promise(r => setTimeout(r, delay + Math.random() * 400));
          continue;
        }
        throw err;
      }
    }

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
  personaGender?: string;
  personaName?: string;
  personaRole?: string;
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

    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
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
            personaGender: options.personaGender,
            personaName: options.personaName,
            personaRole: options.personaRole,
          }),
        });

        const data = await res.json();
        if (res.ok && data.imageData) {
          return { ok: true, imageDataUrl: data.imageData };
        }

        if (data.blocked) {
          return {
            ok: false,
            error: data.error || "Image generation blocked by safety filters.",
            blocked: true,
          };
        }

        lastError = data.error || "Failed to generate image.";
        if (attempt <= maxRetries) {
          const delay = attempt === 1 ? 1500 : 3000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        return {
          ok: false,
          error: lastError,
          blocked: false,
        };
      } catch (e: any) {
        console.error(`[Image Gen Fetch Attempt ${attempt}] Error:`, e);
        lastError = e.message || "Failed to connect to image generation endpoint.";
        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 1500 * attempt));
          continue;
        }
        return { ok: false, error: lastError };
      }
    }
  }

  // Option B: Custom Studio API Key
  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');
  if (!finalKey) {
    return { ok: false, error: "API Key not configured." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: finalKey });

    const gender = (options.personaGender || '').toLowerCase();
    const isMale = gender === 'male' || gender === 'man' || gender === 'boy' || gender === 'brother' || gender === 'bro' || gender === 'father' || gender === 'dad' || gender === 'guy';
    const subjPronoun = isMale ? 'He' : 'She';
    const possPronoun = isMale ? 'his' : 'her';
    const personLabel = isMale ? 'same man' : 'same woman';

    const hasAvatar = Boolean(avatarBase64 && avatarBase64.trim().length > 100);
    const referenceDirective = hasAvatar
      ? `Use [Input Image 1] as the subject reference (identical face, exact facial structure, hair, and eye shape). `
      : `Depict the persona realistically (${options.personaName ? `${options.personaName}, ` : ''}${options.personaRole || 'authentic persona'}). `;

    let parts: any[] = [];
    let promptText = '';

    if (mode === 'selfie') {
      promptText = `${referenceDirective}A spontaneous, casual amateur selfie taken on a smartphone front-facing camera. ${subjPronoun} is ${action_and_setting}. Arm extended holding the phone at a slight, natural angle; the shot is slightly off-center and imperfectly framed. Natural everyday indoor lighting, cozy ambient room light, or natural daylight illuminating ${possPronoun} face—strictly no studio rim lighting or artificial glam glow. Casual relaxed expression, half-smile or candid smirk (not an Instagram model pose). Authentic smartphone front-lens compression, subtle motion blur around edges, faint digital camera grain. Raw unedited mobile front camera photo, zero beauty filter, zero cinematic styling.`;

      if (hasAvatar) {
        parts.push({
          inlineData: {
            mimeType: avatarMimeType || 'image/jpeg',
            data: avatarBase64!.includes(',') ? avatarBase64!.split(',')[1] : avatarBase64!,
          }
        });
      }
      parts.push({ text: promptText });
    } else if (mode === 'candid') {
      if (options.user_wants_posed) {
        promptText = `${referenceDirective}A casual, amateur smartphone snapshot of ${isMale ? 'him' : 'her'} ${action_and_setting}. ${subjPronoun} is posing casually for someone taking ${possPronoun} photo on a phone, looking directly toward the camera with a natural, unforced expression (${personLabel}, identical facial features and skin tone). Shot on an everyday smartphone, slightly imperfect composition, authentic room/outdoor lighting. Realistic skin texture, natural soft focus, raw unedited mobile photo.`;
      } else {
        promptText = `${referenceDirective}A natural, unposed amateur photo of ${isMale ? 'him' : 'her'} ${action_and_setting} (${personLabel}, identical facial features and skin tone). Captured quickly on an everyday smartphone, feels accidental rather than staged. Composition is slightly imperfect: off-center framing, awkward angle (either slightly too low or tilted, horizon not completely straight, or part of the body slightly cropped out of frame). ${subjPronoun} is actively engaged in the setting, looking away, observing something across the room, lost in thought, reaching for an item, or laughing mid-moment (natural authentic body posture, hands occupied naturally with the activity, not aware of or posing for the camera). Uneven realistic lighting [e.g., flat room lighting, soft ambient lamp light, or natural window light with subtle grain]. Focus is naturally soft or slightly missed rather than razor-sharp, with subtle motion blur from quick movement. An uncurated, unedited raw capture sent over chat.`;
      }

      if (hasAvatar) {
        parts.push({
          inlineData: {
            mimeType: avatarMimeType || 'image/jpeg',
            data: avatarBase64!.includes(',') ? avatarBase64!.split(',')[1] : avatarBase64!,
          }
        });
      }
      parts.push({ text: promptText });
    } else {
      // mode === 'pov'
      promptText = `A casual amateur first-person POV photo taken on a smartphone of ${action_and_setting}. Documentary everyday realism, flat natural light or indoor lighting. Slightly off-center angle, real clutter in the background, believable phone lens depth. An accidental 2-second snapshot, no editorial color grading, zero artistic styling.`;
      parts.push({ text: promptText });
    }

    let generatedDataUrl: string | undefined;
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        let currentModel = modelToUse;
        if (attempt === 2 && currentModel === 'gemini-3.1-flash-lite-image') {
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
        if (candidate?.finishReason === 'SAFETY') {
          console.warn(`[Studio Image Gen Attempt ${attempt}] Safety filter flagged.`);
          if (attempt <= maxRetries) {
            // Simplify prompt on safety retry to avoid human reference trigger
            parts = [{ text: `A casual amateur smartphone photo of ${action_and_setting}. Natural everyday lighting, authentic mobile snapshot.` }];
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          return { ok: false, blocked: true, error: "Prompt triggered safety filter." };
        }

        const part = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);
        if (part && part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/jpeg';
          generatedDataUrl = `data:${mime};base64,${part.inlineData.data}`;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Studio Image Gen Attempt ${attempt}/${maxRetries + 1} Error]:`, err?.message || err);
        const errStr = err?.message || String(err);
        if (errStr.includes('SAFETY') || errStr.includes('blocked')) {
          if (attempt <= maxRetries) {
            parts = [{ text: `A casual amateur smartphone photo of ${action_and_setting}. Natural everyday lighting, authentic mobile snapshot.` }];
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          return { ok: false, blocked: true, error: errStr };
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
              generatedDataUrl = `data:image/jpeg;base64,${b64}`;
              break;
            }
          } catch (imgErr) {
            console.warn("[Studio Imagen generateImages fallback error]:", imgErr);
          }
        }

        if (attempt <= maxRetries) {
          const delay = attempt === 1 ? 1500 : 3000;
          await new Promise(r => setTimeout(r, delay + Math.random() * 500));
          continue;
        }
      }
    }

    if (generatedDataUrl) {
      return {
        ok: true,
        imageDataUrl: generatedDataUrl,
      };
    }

    return { ok: false, error: lastError?.message || "No image received from Gemini." };
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
    if (!settings?.isVertexUnlocked) {
      return "I can't send photos right now!";
    }
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

