import { GoogleGenAI } from "@google/genai";
import { UserProfile, AppSettings } from "../types";

export const getGeminiResponse = async (
  responder: { name: string; role?: string; speechStyle?: string; about?: string; systemInstruction?: string },
  messageHistory: { text: string; sender: string; senderName?: string; image?: string; audio?: string }[],
  userProfile?: UserProfile,
  groupContext?: { groupName: string; otherMembers: string[] },
  settings?: AppSettings
) => {
  const finalKey = settings?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY : '');

  if (!finalKey) {
    return "API Key not configured. Please add it in Settings.";
  }

  const ai = new GoogleGenAI({ apiKey: finalKey });

  try {
    const historyString = messageHistory
      .map(m => {
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
${new Date().toLocaleString()}
` : '';

    const notesContext = (settings?.shareCalendarNotes && settings?.calendarNotes) ? `
USER'S IMPORTANT DATES / NOTES FOR YOU:
${settings.calendarNotes}
` : '';

    const groundingPrompt = settings?.useSearchGrounding ? `
CRITICAL INSTRUCTION: Google Search Grounding is ENABLED. If the user asks for current events, facts, or tells you to check the web, you MUST use your Google Search tool to find the answer.
IMPORTANT RULE: NEVER use formal citations (like [1], URLs, or "according to..."). Weave the facts you find naturally into your chat response as if you just looked it up on your phone. Keep your persona intact!
` : '';

    const systemPrompt = `You are ${responder.name}. 
${profileContext}
${groupPrompt}
${userContext}
${timeContext}
${notesContext}
${groundingPrompt}

Instructions:
1. Respond naturally to the last few messages.
2. If the user sent an image, look at it and comment on it specifically using the provided caption (if any).
3. If the user sent a Voice Note (audio), listen to it carefully and respond based on what you hear! If it's silent or unclear, politely ask them to repeat.
4. If in a group, you don't always have to talk to the user; you can reply to another member's comment.
5. Keep it short (1-3 sentences), typical for chat apps.
6. Maintain your unique personality and speech style at all times.
7. Do not use AI clichés or reveal you are an AI.

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
