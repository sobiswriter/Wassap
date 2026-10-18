export function reactionContext(context: string | undefined, hasMessage: boolean): string | undefined {
  if (!context) return undefined;
  return `${context}\n${hasMessage
    ? 'REACTION PRIORITY: A new message accompanies this reaction. Answer its text, images and audio first. Let the reaction subtly color your tone or a brief aside only when relevant; do not explain or announce the emoji. It is fine to leave it implicit.'
    : 'REACTION PRIORITY: The reaction is the new interaction. Respond briefly in character to its feeling and the message it refers to; do not mechanically describe the emoji.'}`;
}

export function isSingleEmoji(value: string): boolean {
  if (!value || value.length > 32) return false;
  // Reject prose while allowing joined families, skin tones, flags and keycaps.
  const segments = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value));
  return segments.length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(value)
    && /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200d\ufe0f\u0300-\u036f\u{e0020}-\u{e007f}0-9#*\u20e3]+$/u.test(value);
}
