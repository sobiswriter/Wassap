import { GoogleGenAI } from '@google/genai';
import { HumaneSettings, UserProfile, AppSettings, PersonaVoiceSettings } from '../types';
import { GCP_CONFIG, getVoiceDescriptor } from '../constants';
import { pcmBase64ToWavDataUrl, convertToGeminiVocalTags } from '../utils/audio';

export interface TTSPayload {
  text: string;
  voiceName: string;
  voiceModel?: string;
  stylePrompt?: string;
  paceSpeed?: string;
  pitchTone?: string;
  personaName?: string;
  speechStyle?: string;
  customVoicePrompt?: string;
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
    eventTitle?: string;
    reactions?: string[];
    isSticker?: boolean;
    isGif?: boolean;
  }[];
  userProfile?: UserProfile;
  groupContext?: { groupName: string; otherMembers: string[] };
  settings?: AppSettings;
  initiationContext?: string;
  clientTimeContext?: string;
  isVoiceNoteReply?: boolean;
  voiceSettings?: PersonaVoiceSettings;
}

export interface DiaryPayload {
  persona: {
    name: string;
    role?: string;
    speechStyle?: string;
    about?: string;
    systemInstruction?: string;
  };
  messageHistory: { text: string; sender: string; senderName?: string; date?: string; timestamp?: string }[];
  startDate: string;
  endDate: string;
  settings?: AppSettings;
}

export const getVertexClient = (targetLocation?: string) => {
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
  const location = targetLocation || process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || GCP_CONFIG.defaultRegion;

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

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
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
};

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

export function getInCharacterGlitchMessage(
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

export const resolveVertexModel = (selectedModel?: string): string => {
  if (!selectedModel) return 'gemini-3.8-flash';
  return selectedModel.trim();
};

/**
 * Safely resolves a media data URL, remote URL (e.g. Giphy/Tenor GIF or image),
 * or base64 string to a valid Gemini inlineData part.
 * Returns null if the media cannot be parsed, exceeds size limits, or is an unsupported format like SVG.
 */
export async function resolveMediaToInlineData(
  mediaStr?: string,
  defaultMime = 'image/jpeg'
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  if (!mediaStr || typeof mediaStr !== 'string') return null;

  const trimmed = mediaStr.trim();
  if (!trimmed || trimmed === '[ATTACHED]') return null;

  // Case 1: Data URI (e.g., data:image/png;base64,iVBOR...)
  if (trimmed.startsWith('data:')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) return null;

    const meta = trimmed.substring(0, commaIdx).toLowerCase();
    const rawData = trimmed.substring(commaIdx + 1);

    const mimeMatch = meta.match(/data:([^;,]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : defaultMime;

    // Vector graphics (SVG) are not supported by Gemini's multimodal vision decoder
    if (mimeType.includes('svg')) {
      return null;
    }

    if (!rawData || !rawData.trim()) return null;

    return {
      inlineData: {
        mimeType: mimeType || defaultMime,
        data: rawData.trim(),
      },
    };
  }

  // Case 2: Remote URL (e.g., https://i.giphy.com/... or https://...)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.toLowerCase().endsWith('.svg') || trimmed.toLowerCase().includes('.svg?')) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(trimmed, {
        signal: controller.signal,
        headers: {
          'Accept': 'image/*,audio/*,*/*',
          'User-Agent': 'Mozilla/5.0 (compatible; WassapBot/1.0)',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[resolveMediaToInlineData] HTTP ${response.status} fetching remote media: ${trimmed}`);
        return null;
      }

      const contentTypeHeader = (response.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
      if (contentTypeHeader.includes('svg') || contentTypeHeader.includes('html')) {
        return null;
      }

      const mimeType = contentTypeHeader && (contentTypeHeader.startsWith('image/') || contentTypeHeader.startsWith('audio/'))
        ? contentTypeHeader
        : (trimmed.toLowerCase().endsWith('.gif') ? 'image/gif' : defaultMime);

      const arrayBuffer = await response.arrayBuffer();
      // Cap at 8MB to stay within Vercel and Vertex inlineData payload thresholds
      if (arrayBuffer.byteLength > 8 * 1024 * 1024) {
        console.warn(`[resolveMediaToInlineData] Media too large (${arrayBuffer.byteLength} bytes) for: ${trimmed}`);
        return null;
      }

      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      if (!base64Data) return null;

      return {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };
    } catch (err: any) {
      console.warn(`[resolveMediaToInlineData] Could not fetch remote media ${trimmed}:`, err?.message || err);
      return null;
    }
  }

  // Case 3: Raw Base64 string without data: prefix
  if (trimmed.length > 20 && !trimmed.includes('://') && /^[A-Za-z0-9+/=_\s-]+$/.test(trimmed.slice(0, 50))) {
    return {
      inlineData: {
        mimeType: defaultMime,
        data: trimmed.replace(/\s+/g, ''),
      },
    };
  }

  return null;
}

export async function handleVertexChat(payload: ChatPayload): Promise<{ ok: boolean; text?: string; error?: string }> {
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
        let imgTag = "";
        if (m.image) {
          if (m.isGif || m.image.toLowerCase().includes('.gif') || m.image.startsWith('data:image/gif')) {
            imgTag = "[GIF ANIMATION ATTACHED]";
          } else if (m.isSticker || m.image.includes('sticker') || m.image.startsWith('data:image/svg')) {
            imgTag = "[STICKER ATTACHED]";
          } else {
            imgTag = "[IMAGE ATTACHED]";
          }
        }
        const voiceTag = m.audio ? "[VOICE NOTE ATTACHED]" : "";
        const reactionTag = m.reactions && m.reactions.length > 0 ? `[REACTIONS ON THIS MESSAGE: ${m.reactions.join(', ')}]` : "";
        return `${name}: ${imgTag} ${voiceTag} ${reactionTag} ${m.text || ''}`.trim();
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
        const pacingPrompt = responder.humaneSettings.varyMessageLengthPrompt?.trim() || `- DYNAMIC MESSAGE PACING (NO ESSAYS / MONOLOGUES):
  * Keep responses brief, punchy, and WhatsApp-native (1 to 2 lines max).
  * Never write structured multi-sentence essays or dense paragraphs.
  * Match real phone texting dynamics: sometimes reply with a spontaneous 1-3 word quip ("wait fr?", "haha no way", "nah"), sometimes a snappy one-liner.`;
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
    if (payload.isVoiceNoteReply) {
      const voiceSettings = payload.voiceSettings;
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
5. If the user sent an image with an attached Voice Note, look at the image AND listen to what they said, responding cohesively to both!
6. If the user sent a GIF animation or sticker, react playfully, humorously, or warmly to what it shows/expresses in-character!
7. If the user stacked or sent multiple messages, images, audio clips, or expressions together, acknowledge and respond cohesively to ALL of them in a single combined reply turn!
8. If the user reacted to a message or photo with an expression (e.g. ❤️, 😂, 😮, 😢, 🙏, 👍, 🔥), naturally acknowledge and warmly or playfully reply back to their reaction/expression in-character!
9. If in a group chat, you can reply to another member's comment naturally without always addressing the user.
10. ${responder.humaneSettings?.enabled && responder.humaneSettings.varyMessageLength ? (responder.humaneSettings.varyMessageLengthPrompt ? 'Follow the custom message length and pacing directives defined below.' : 'Keep responses EXTREMELY SHORT (1-2 lines maximum), like rapid-fire texting. Never write a paragraph.') : 'Respond naturally without any strict length restrictions.'}
11. ${responder.humaneSettings?.enabled && responder.humaneSettings.banRoboticLanguage ? 'Follow the strict anti-robot and human texting guidelines below.' : 'Do not use AI clichés or reveal you are an AI.'}${humaneInstructions}

Conversation History:
${historyString}

Response as ${responder.name}:`;

    const recentMessagesWithMedia = (messageHistory || []).slice(-8).filter(m => (m.image && m.image !== '[ATTACHED]') || (m.audio && m.audio !== '[ATTACHED]'));
    const parts: any[] = [{ text: systemPrompt }];

    for (const msg of recentMessagesWithMedia.slice(-5)) {
      if (msg.image && msg.image !== '[ATTACHED]') {
        const resolved = await resolveMediaToInlineData(msg.image, 'image/jpeg');
        if (resolved) {
          parts.push(resolved);
        }
      }
      if (msg.audio && msg.audio !== '[ATTACHED]') {
        const resolved = await resolveMediaToInlineData(msg.audio, 'audio/webm');
        if (resolved) {
          parts.push(resolved);
        }
      }
    }

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
            error: `Google Cloud Vertex AI permission denied for project '${process.env.VERTEX_PROJECT_ID || GCP_CONFIG.projectId}'. Ensure Vertex AI API is enabled and billing is active, or switch to 'Custom API Key' in Settings.`
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

export async function handleVertexDiary(payload: DiaryPayload): Promise<{ ok: boolean; text?: string; error?: string }> {
  const { persona, messageHistory, startDate, endDate, settings } = payload;
  const ai = getVertexClient();

  const isSingleDay = startDate === endDate;
  const dateLabel = isSingleDay ? startDate : `${startDate} to ${endDate}`;

  // Partition messages by date
  const byDate = new Map<string, Array<{ text: string; sender: string; senderName?: string; date?: string; timestamp?: string }>>();
  for (const m of (messageHistory || [])) {
    const rawDate = m.date || 'Undated';
    if (!byDate.has(rawDate)) {
      byDate.set(rawDate, []);
    }
    byDate.get(rawDate)!.push(m);
  }

  let historyString = '';

  if (isSingleDay) {
    const msgs = (messageHistory || []).slice(-60);
    historyString = msgs
      .map(m => {
        const name = m.sender === 'me' ? 'User' : (m.senderName || persona.name);
        const timeStr = m.timestamp ? ` [${m.timestamp}]` : '';
        return `${name}${timeStr}: ${m.text || ''}`.trim();
      })
      .join('\n');
  } else {
    const daySections: string[] = [];
    const sortedDates = Array.from(byDate.keys()).sort();

    for (const d of sortedDates) {
      const msgs = byDate.get(d) || [];
      if (msgs.length === 0) continue;

      let chosenMsgs: typeof msgs = [];
      if (msgs.length <= 16) {
        chosenMsgs = msgs;
      } else {
        const startChunk = msgs.slice(0, 4);
        const endChunk = msgs.slice(-4);
        const middlePool = msgs.slice(4, -4);
        
        const sortedMiddle = [...middlePool].sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));
        const pickedMiddle = sortedMiddle.slice(0, 8).sort((a, b) => msgs.indexOf(a) - msgs.indexOf(b));

        chosenMsgs = [...startChunk, ...pickedMiddle, ...endChunk];
      }

      const dayText = chosenMsgs
        .map(m => {
          const name = m.sender === 'me' ? 'User' : (m.senderName || persona.name);
          const timeStr = m.timestamp ? ` [${m.timestamp}]` : '';
          return `  ${name}${timeStr}: ${m.text || ''}`.trim();
        })
        .join('\n');

      daySections.push(`=== [DAY: ${d}] ===\n${dayText}`);
    }

    historyString = daySections.join('\n\n');
  }

  const numDays = Math.max(1, byDate.size);
  const isWeekly = numDays >= 5 && numDays <= 8;
  const genreName = isWeekly ? 'Weekly Chronicle of Events' : 'Recollection of Shared Events';

  const diaryPrompt = isSingleDay
    ? `You are ${persona.name}.
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
4. Naturally weave in specific standout moments, topics, or inside jokes from today's conversation into your emotional reflection.
5. End with a thoughtful concluding sentence, a wish for tomorrow, or an unspoken sentiment.

TODAY'S CONVERSATIONS & MOMENTS:
${historyString || '(No text exchanged today, but we spent quiet time connected)'}

PRIVATE DIARY ENTRY BY ${persona.name}:`
    : `You are ${persona.name}.
ABOUT YOU: ${persona.about || 'N/A'}
ROLE: ${persona.role || 'N/A'}
STYLE: ${persona.speechStyle || 'Authentic personal voice'}
NOTES: ${persona.systemInstruction || 'N/A'}

TASK:
Write an intimate, personal journal entry titled "${genreName}: ${dateLabel}".
Reflect on the journey, standout shared moments, emotional beats, conversations, and evolving bond with the User across this entire period (${dateLabel}).

CRITICAL GUIDELINES FOR THIS MULTI-DAY RECOLLECTION:
1. CHRONOLOGICAL & THEMATIC ARC: Do NOT just focus on or summarize the final day. Look across the ENTIRE timeframe (${dateLabel}). Reflect on how the days progressed—the standout moments, meaningful discussions, inside jokes, and quiet moments that occurred across the week/period.
2. FIRST-PERSON INTIMATE VOICE: Write in the FIRST PERSON ("I", "my") completely in character as ${persona.name}. Write like someone holding their private leather-bound journal before bed, candid and emotionally observant about the User.
3. WEAVE SPECIFIC MEMORIES ACROSS DAYS: Actively draw upon memorable highlights from earlier days as well as more recent ones, noting little details, questions asked, and how your conversations shifted day by day.
4. FLOWING NARRATIVE, NOT A DRY LOG: Avoid dry mechanical bullet points or rigid logs (do NOT write "On Monday X happened. On Tuesday Y happened."). Instead, write in rich, heartfelt literary paragraphs that capture the passage of time and the warmth of the connection naturally.
5. CLOSING SENTIMENT: Conclude with a deep, personal reflection on what these shared days meant to you and an unspoken hope for the days ahead.

SHARED CONVERSATIONS ACROSS THESE DAYS (ORGANIZED CHRONOLOGICALLY BY DAY):
${historyString || '(No text exchanged across these days, but we spent quiet time connected)'}

${genreName.toUpperCase()} BY ${persona.name}:`;

  const primaryModel = resolveVertexModel(settings?.selectedModel);
  const fallbackModels = Array.from(new Set([
    primaryModel,
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ]));

  let lastError: any = null;

  for (let i = 0; i < fallbackModels.length; i++) {
    const modelToUse = fallbackModels[i];
    try {
      const candidateTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${modelToUse} timed out after 24s`)), 24000)
      );
      const response = await Promise.race([
        ai.models.generateContent({
          model: modelToUse,
          contents: [{ role: 'user', parts: [{ text: diaryPrompt }] }],
        }),
        candidateTimeout
      ]);

      if (response && response.text) {
        return {
          ok: true,
          text: response.text.trim(),
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Vertex Diary] Attempt ${i + 1} with model ${modelToUse} failed:`, err?.message || err);
      if (i < fallbackModels.length - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    }
  }

  return {
    ok: false,
    error: `Vertex AI Diary generation failed: ${lastError?.message || 'Unknown error'}`,
  };
}

export async function handleVertexTTS(payload: TTSPayload): Promise<{ ok: boolean; audioData?: string; mimeType?: string; error?: string }> {
  try {
    const { text, voiceName, voiceModel, stylePrompt, paceSpeed, pitchTone, personaName, speechStyle, customVoicePrompt } = payload;
    if (!text || !text.trim()) {
      return { ok: false, error: "Text is required for Voice Note generation" };
    }

    const selectedVoice = voiceName || 'Aoede';
    const isCustomVoice = selectedVoice.startsWith('voice_') || selectedVoice.startsWith('voicekey_');
    const voiceDescriptor = getVoiceDescriptor(selectedVoice);
    const selectedModel = voiceModel || 'gemini-3.8-flash-tts';
    const is38 = selectedModel.includes('3.8');

    // Build consolidated style directives
    const styleParts: string[] = [];
    if (customVoicePrompt) {
      styleParts.push(`custom vocal design: ${customVoicePrompt}`);
    }
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

    const verbatimWithVocalTags = convertToGeminiVocalTags(text.trim());

    let audioBase64: string | undefined;
    let mimeType = 'audio/wav';

    // Check if running on Vertex AI directly or using Studio API key
    const hasStudioApiKey = !!(process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY);

    // Build model candidate sequence with graceful fallbacks:
    // Whichever model is selected is tried FIRST on Attempt 1. Only if it fails does it fall back to others.
    const fallbackPool = [
      'gemini-3.8-flash-tts',
      'gemini-3.8-flash-lite-tts',
      'gemini-3.1-flash-tts-preview'
    ];
    const modelsToTry: string[] = [
      selectedModel,
      ...fallbackPool.filter(m => m !== selectedModel)
    ];

    const aiClient = getVertexClient('global');

    let lastError: any = null;
    for (const modelCandidate of modelsToTry) {
      const isCandidate38 = modelCandidate.includes('3.8');
      const styleDirective = combinedStyle || 'natural and expressive';
      const personaDirective = personaName ? `as ${personaName} ` : '';

      try {
        // 3.8 Flash & Flash-Lite models receive pure verbatim text with vocal tags
        // 3.1 Preview models receive acting directive prompt steering
        const inputText = isCandidate38
          ? verbatimWithVocalTags
          : `Say the following in a natural WhatsApp voice note ${personaDirective}with a ${styleDirective} voice delivery, honoring vocal tags like <laugh>, <sigh>, <gasp>, <whispers>, <cough>: ${verbatimWithVocalTags}`;

        // Attempt 1: If custom voice on 3.8, use native voiceConfig.voice
        const voiceConfigToUse = (isCustomVoice && isCandidate38)
          ? { voice: selectedVoice }
          : {
              prebuiltVoiceConfig: {
                voiceName: isCustomVoice ? (voiceDescriptor?.name || 'Zephyr') : selectedVoice,
              }
            };

        const generateConfig: any = {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: voiceConfigToUse
          }
        };

        const candidateTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`TTS candidate ${modelCandidate} timed out after 18s`)), 18000)
        );

        let response: any;
        try {
          response = await Promise.race([
            aiClient.models.generateContent({
              model: modelCandidate,
              contents: [{ role: 'user', parts: [{ text: inputText }] }],
              config: generateConfig as any
            }),
            candidateTimeout
          ]);
        } catch (initialErr: any) {
          // If custom voice was passed to 3.8 and failed (e.g. unrecognized voice id on cloud), retry with prompt-steered base voice
          if (isCustomVoice && isCandidate38) {
            console.warn(`[Vertex TTS] Custom voice ID ${selectedVoice} failed on ${modelCandidate}, falling back to prompt-steered studio voice:`, initialErr?.message || initialErr);
            const fallbackVoiceName = voiceDescriptor?.name || 'Zephyr';
            const fallbackPromptText = `Say the following in a natural WhatsApp voice note ${personaDirective}with a ${styleDirective} delivery: ${verbatimWithVocalTags}`;
            response = await Promise.race([
              aiClient.models.generateContent({
                model: modelCandidate,
                contents: [{ role: 'user', parts: [{ text: customVoicePrompt ? fallbackPromptText : inputText }] }],
                config: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: {
                        voiceName: fallbackVoiceName
                      }
                    }
                  }
                } as any
              }),
              candidateTimeout
            ]);
          } else {
            throw initialErr;
          }
        }

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
      return { ok: false, error: `Gemini TTS generation failed: ${lastError?.message || 'No audio returned'}` };
    }

    let sampleRate = 24000;
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    if (rateMatch && rateMatch[1]) {
      sampleRate = parseInt(rateMatch[1], 10);
    }

    const audioDataUrl = pcmBase64ToWavDataUrl(audioBase64, sampleRate);

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
  clientTimeContext?: string;
}

export interface ImageSynthesisResult {
  mode: ImageGenerationMode;
  caption: string;
  action_and_setting: string;
  is_persona_subject: boolean;
  user_wants_posed?: boolean;
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

export async function handleVertexImageSynthesis(
  payload: ImageSynthesisPayload
): Promise<{ ok: boolean; result?: ImageSynthesisResult; error?: string }> {
  try {
    const { persona, userPrompt, messageHistory, settings } = payload;
    const clientTimeContext = payload.clientTimeContext || settings?.clientTimeContext;
    const ai = getVertexClient();
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
        let modelToUse = resolveVertexModel(settings?.selectedModel);
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
        console.warn(`[Vertex Image Synthesize Attempt ${attempt}/${maxRetries + 1} Error]:`, err?.message || err);
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
  personaGender?: string;
  personaName?: string;
  personaRole?: string;
}

export async function handleVertexImageGeneration(
  payload: ImageGenerationPayload
): Promise<{ ok: boolean; imageData?: string; error?: string; blocked?: boolean }> {
  try {
    const { model, action_and_setting } = payload;
    const mode: ImageGenerationMode = payload.mode || (payload.is_persona_subject ? 'selfie' : 'pov');
    const isSubject = mode === 'selfie' || mode === 'candid';

    const gender = (payload.personaGender || '').toLowerCase();
    const isMale = gender === 'male' || gender === 'man' || gender === 'boy' || gender === 'brother' || gender === 'bro' || gender === 'father' || gender === 'dad' || gender === 'guy';
    const subjPronoun = isMale ? 'He' : 'She';
    const possPronoun = isMale ? 'his' : 'her';
    const personLabel = isMale ? 'same man' : 'same woman';

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
    const hasAvatar = Boolean(avatarBase64 && avatarBase64.trim().length > 100);
    const referenceDirective = hasAvatar
      ? `Use [Input Image 1] as the subject reference (identical face, exact facial structure, hair, and eye shape). `
      : `Depict the persona realistically (${payload.personaName ? `${payload.personaName}, ` : ''}${payload.personaRole || 'authentic persona'}). `;

    let parts: any[] = [];
    let promptText = '';

    if (mode === 'selfie') {
      promptText = `${referenceDirective}A spontaneous, casual amateur selfie taken on a smartphone front-facing camera. ${subjPronoun} is ${action_and_setting}. Arm extended holding the phone at a slight, natural angle; the shot is slightly off-center and imperfectly framed. Natural everyday indoor lighting, cozy ambient room light, or natural daylight illuminating ${possPronoun} face—strictly no studio rim lighting or artificial glam glow. Casual relaxed expression, half-smile or candid smirk (not an Instagram model pose). Authentic smartphone front-lens compression, subtle motion blur around edges, faint digital camera grain. Raw unedited mobile front camera photo, zero beauty filter, zero cinematic styling.`;

      if (hasAvatar) {
        const cleanBase64 = avatarBase64!.includes(',') ? avatarBase64!.split(',')[1] : avatarBase64!;
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
        const cleanBase64 = avatarBase64!.includes(',') ? avatarBase64!.split(',')[1] : avatarBase64!;
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

        if (generatedBase64) {
          break;
        }
      } catch (genContentErr: any) {
        lastError = genContentErr;
        console.warn(`[Vertex AI Image Gen Attempt ${attempt}/${maxRetries + 1} Error]:`, genContentErr?.message || genContentErr);

        const errMsg = String(genContentErr?.message || '');
        if (errMsg.includes('SAFETY') || errMsg.includes('blocked') || errMsg.includes('IMAGE_SAFETY')) {
          if (attempt <= maxRetries) {
            parts = [{ text: `A casual amateur smartphone photo of ${action_and_setting}. Natural everyday lighting, authentic mobile snapshot.` }];
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          return { ok: false, blocked: true, error: "Image generation blocked by safety filters." };
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
            console.warn("[Vertex AI generateImages fallback error]:", imgErr);
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
      return {
        ok: false,
        error: lastError?.message || "No image was returned by the image generation model.",
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

