/** C0 and C1 controls (including DEL and NEL), and the line and paragraph separators. */
const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/gu;

const NAMED: Record<string, string> = {
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\b": "\\b",
  "\f": "\\f",
};

/**
 * Replaces each control character with a visible escape, so a message or a
 * report line stays on one line. Text that is already escaped is unchanged.
 */
export function escapeControls(text: string): string {
  return text.replace(CONTROL, (ch) => NAMED[ch] ?? `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
