export function notificationConversation(_userText: string, personaText: string): string {
  return personaText.replace(/\r?\n(?:[ \t]*\r?\n)+/g, '\n');
}
