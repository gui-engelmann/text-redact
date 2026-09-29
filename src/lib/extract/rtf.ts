// Groups whose content is metadata, not document text.
const SKIP = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "header",
  "footer",
  "listtable",
  "listoverridetable",
  "revtbl",
  "rsidtbl",
  "generator",
  "xmlnstbl",
  "themedata",
  "colorschememapping",
  "datastore",
  "latentstyles",
]);

const cp1252 = new TextDecoder("windows-1252");

/** Plain text of an RTF document. Handles the common control words, not layout. */
export function extractRtf(rtf: string): string {
  let out = "";
  const stack: { skip: boolean; uc: number }[] = [];
  let skip = false;
  let uc = 1; // characters to drop after a \u escape
  let pendingSkip = 0;
  let i = 0;

  const emit = (s: string) => {
    if (skip) return;
    if (pendingSkip > 0) {
      pendingSkip--;
      return;
    }
    out += s;
  };

  while (i < rtf.length) {
    const ch = rtf[i];
    if (ch === "{") {
      stack.push({ skip, uc });
      i++;
      if (rtf.startsWith("\\*", i)) skip = true;
      continue;
    }
    if (ch === "}") {
      ({ skip, uc } = stack.pop() ?? { skip: false, uc: 1 });
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      i++;
      continue;
    }
    if (ch !== "\\") {
      emit(ch);
      i++;
      continue;
    }

    const next = rtf[i + 1];
    if (next === "\\" || next === "{" || next === "}") {
      emit(next);
      i += 2;
      continue;
    }
    if (next === "'") {
      emit(cp1252.decode(new Uint8Array([parseInt(rtf.slice(i + 2, i + 4), 16)])));
      i += 4;
      continue;
    }
    if (next === "~") {
      emit(" ");
      i += 2;
      continue;
    }
    if (next === "\n" || next === "\r") {
      emit("\n");
      i += 2;
      continue;
    }

    const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i, i + 40));
    if (!m) {
      i += 2;
      continue;
    }
    i += m[0].length;
    const [, word, arg] = m;
    if (SKIP.has(word)) skip = true;
    else if (word === "par" || word === "line" || word === "row") emit("\n");
    else if (word === "tab" || word === "cell") emit("\t");
    else if (word === "uc") uc = Number(arg ?? 1);
    else if (word === "u") {
      let code = Number(arg);
      if (code < 0) code += 65536;
      emit(String.fromCharCode(code));
      pendingSkip = skip ? 0 : uc;
    }
  }
  return out;
}
