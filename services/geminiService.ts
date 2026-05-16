import { GoogleGenAI } from "@google/genai";
import { UserProfile, AppSettings, HumaneSettings } from "../types";

export const getGeminiResponse = async (
  responder: { name: string; role?: string; speechStyle?: string; about?: string; systemInstruction?: string; humaneSettings?: HumaneSettings },
  messageHistory: { text: string; sender: string; senderName?: string; image?: string; audio?: string }[],
  userProfile?: UserProfile,
  groupContext?: { groupName: string; otherMembers: string[] },
  settings?: AppSettings,
  initiationContext?: string
) => {
  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');

  if (!finalKey) {
    return "API Key not configured. Please add it in Settings.";
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
It is currently ${new Date().toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}.
CRITICAL RULE: Do NOT explicitly mention the time or date in your messages unless the User specifically asks about it. Use this information only to silently adjust your context (e.g. knowing it's late at night).
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
      initiationContext.includes('[MANUAL TEST]')
    );

    const initiationPrompt = initiationContext ? (isInitiationDirective ? `
CRITICAL INSTRUCTION: You are re-initiating the conversation right now.
${initiationContext.includes('[SCHEDULED INTERACTION]') || initiationContext.includes('[CATCH-UP REQUIRED]') 
  ? `INTENT: This is a scheduled interaction. You MUST prioritize this intent and address it immediately while remaining context-aware.` 
  : `CONTEXT: This is a natural check-in. Prioritize the conversation history and flow while acknowledging the silence naturally.`}
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

    const systemPrompt = `You are ${responder.name}. 
${profileContext}
${groupPrompt}
${userContext}
${timeContext}
${notesContext}
${groundingPrompt}
${initiationPrompt}
${eventInstruction}

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
      model: settings?.selectedModel || 'gemini-3-flash-preview',
      contents: { parts },
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
  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');

  if (!finalKey) {
    return "API Key not configured.";
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
      model: settings?.selectedModel || 'gemini-3-flash-preview',
      contents: { parts: [{ text: diaryPrompt }] },
    });

    return response.text || "I couldn't find the words today...";
  } catch (error: any) {
    console.error("Diary generation error:", error);
    return "I'm having trouble reflecting on today right now...";
  }
};
