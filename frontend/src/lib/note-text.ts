import limits from "./core-limits.json";

// Core bounds a note's text in UTF-8 bytes (ADR-0010 D1); core-limits.json is kept equal to the
// pinned Core's by a Go test.
export const maxNoteBytes = limits.noteBytes;

const encoder = new TextEncoder();

export function noteBytes(text: string): number {
  return encoder.encode(text.trim()).length;
}

// clipNote returns the trimmed text cut to at most maxNoteBytes at a code point boundary, and
// whether anything was cut.
export function clipNote(text: string): { text: string; clipped: boolean } {
  const trimmed = text.trim();
  if (encoder.encode(trimmed).length <= maxNoteBytes) return { text: trimmed, clipped: false };
  let used = 0;
  let out = "";
  for (const ch of trimmed) {
    const size = encoder.encode(ch).length;
    if (used + size > maxNoteBytes) break;
    out += ch;
    used += size;
  }
  return { text: out.trimEnd(), clipped: true };
}
