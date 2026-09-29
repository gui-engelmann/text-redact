export const MASK = "[REDACTED]";

export type Segment =
  | { type: "text"; value: string }
  | { type: "redacted"; value: string; term: string };

export type Token = { type: "word"; value: string } | { type: "gap"; value: string };

const WORD_CHAR = /[\p{L}\p{N}]/u;
const EDGES = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Trim surrounding whitespace from a term. */
export function normalizeTerm(raw: string): string {
  return raw.trim();
}

/** Case-insensitive membership check. */
export function hasTerm(terms: string[], term: string): boolean {
  const key = term.toLowerCase();
  return terms.some((t) => t.toLowerCase() === key);
}

/**
 * Build one regex that matches every term, longest first, case-insensitive.
 * A term that starts/ends with a letter or digit only matches on a word
 * boundary on that side, so "an" never eats the middle of "and".
 */
function buildMatcher(terms: string[]): { regex: RegExp; ordered: string[] } | null {
  const seen = new Set<string>();
  const ordered = terms
    .map(normalizeTerm)
    .filter((t) => {
      const key = t.toLowerCase();
      if (!t || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.length - a.length);
  if (!ordered.length) return null;

  const source = ordered
    .map((t) => {
      const before = WORD_CHAR.test(t[0]) ? "(?<![\\p{L}\\p{N}])" : "";
      const after = WORD_CHAR.test(t[t.length - 1]) ? "(?![\\p{L}\\p{N}])" : "";
      return `(${before}${escapeRegExp(t)}${after})`;
    })
    .join("|");
  return { regex: new RegExp(source, "giu"), ordered };
}

/** Split text into plain and redacted segments. */
export function segment(text: string, terms: string[]): Segment[] {
  const matcher = buildMatcher(terms);
  if (!matcher || !text) return text ? [{ type: "text", value: text }] : [];

  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(matcher.regex)) {
    const start = m.index;
    if (start > last) out.push({ type: "text", value: text.slice(last, start) });
    const group = m.findIndex((g, i) => i > 0 && g !== undefined);
    out.push({ type: "redacted", value: m[0], term: matcher.ordered[group - 1] });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/** Replace every term occurrence with the mask. */
export function redact(text: string, terms: string[]): string {
  return segment(text, terms)
    .map((s) => (s.type === "redacted" ? MASK : s.value))
    .join("");
}

/** How many times each term (by lowercase key) occurs in the text. */
export function countMatches(text: string, terms: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of segment(text, terms)) {
    if (s.type !== "redacted") continue;
    const key = s.term.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Split plain text into clickable words and the gaps between them.
 * A word is a whitespace-separated chunk with surrounding punctuation
 * stripped, so "(john@acme.com)," yields the word "john@acme.com".
 */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const push = (type: Token["type"], value: string) => {
    if (!value) return;
    const prev = out[out.length - 1];
    if (prev && prev.type === "gap" && type === "gap") prev.value += value;
    else out.push({ type, value } as Token);
  };

  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      push("gap", part);
      continue;
    }
    const [, lead, core, trail] = EDGES.exec(part)!;
    if (!core) {
      push("gap", part);
      continue;
    }
    push("gap", lead);
    push("word", core);
    push("gap", trail);
  }
  return out;
}
