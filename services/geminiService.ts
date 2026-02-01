
import { GoogleGenAI } from "@google/genai";
import { UserProfile, Chat } from "../types";

// Fix: Initializing GoogleGenAI using the process.env.API_KEY directly without fallbacks
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getGeminiResponse = async (
  responder: { name: string; role?: string; speechStyle?: string; about?: string; systemInstruction?: string }, 
  messageHistory: { text: string; sender: string; senderName?: string; image?: string }[],
  userProfile?: UserProfile,
  groupContext?: { groupName: string; otherMembers: string[] }
) => {
  try {
    const historyString = messageHistory
      .map(m => {
        const name = m.sender === 'me' ? (userProfile?.name || 'User') : (m.senderName || responder.name);
        // If an image is sent, we mark it. If there's text, it's the caption/message.
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

    const userContext = userProfile ? `
USER INFORMATION (The person you are chatting with):
Name: ${userProfile.name}
About: ${userProfile.about}
Current Status: ${userProfile.status}
` : '';

    const systemPrompt = `You are ${responder.name}. 
${profileContext}
${groupPrompt}
${userContext}

Instructions:
1. Respond naturally to the last few messages.
2. If the user sent an image, look at it and comment on it specifically using the provided caption (if any).
3. If in a group, you don't always have to talk to the user; you can reply to another member's comment.
4. Keep it short (1-3 sentences), typical for chat apps.
5. Maintain your unique personality and speech style at all times.
6. Do not use AI clichés or reveal you are an AI.

Conversation History:
${historyString}

Response as ${responder.name}:`;
    
    // Check for images in the recent history to support multimodal vision
    const recentMessagesWithImages = messageHistory.slice(-3).filter(m => m.image);
    const parts: any[] = [{ text: systemPrompt }];

    if (recentMessagesWithImages.length > 0) {
      const lastImageMsg = recentMessagesWithImages[recentMessagesWithImages.length - 1];
      if (lastImageMsg.image) {
        // Extract base64 data correctly (remove prefix if present)
        const base64Data = lastImageMsg.image.split(',')[1] || lastImageMsg.image;
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        });
      }
    }

    // Using generateContent with recommended model name
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
    });

    // Access the text property directly
    return response.text || "...";
  } catch (error) {
    console.error("Connection error:", error);
    return "Connection issues...";
  }
};
