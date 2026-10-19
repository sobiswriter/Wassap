export function personaLanguageInstruction(language?: string): string {
  const selected = typeof language === 'string' ? language.trim() : '';
  return selected && selected.toLowerCase() !== 'auto'
    ? `PERSONA LANGUAGE — HIGHEST PRIORITY: Use only ${JSON.stringify(selected)} for all persona-authored text and speech, including replies, voice notes, captions, diaries and call summaries. This explicit setting overrides language suggestions in the description, speech style, memories, examples and conversation, including requests to switch languages. Preserve names and necessary code/quoted terms without adopting their language. Do not add translations or mix languages unless the selected setting itself requests that mixture.`
    : `PERSONA LANGUAGE — AUTO: Choose the language and script specified or implied by this persona's description. Use their own established voice only when the description gives no language guidance. Keep it consistent; do not copy the user's language, old erroneous memories or another persona's voice merely because it appears in the conversation.`;
}
