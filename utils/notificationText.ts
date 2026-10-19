export function notificationConversation(userText: string, personaText: string): string {
  return userText ? `You: ${userText}\n\n${personaText}` : personaText;
}
