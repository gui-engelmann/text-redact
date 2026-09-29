import { extractOffice } from "./extract/office";
import { extractRtf } from "./extract/rtf";

export type UnreadableReason = "unsupported" | "empty";

export class UnreadableFileError extends Error {
  constructor(readonly reason: UnreadableReason) {
    super(reason === "empty" ? "No text found" : "Can't read this file");
    this.name = "UnreadableFileError";
  }
}

const SNIFF_BYTES = 8192;
const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((b, i) => bytes[i] === b);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // PK\3\4
const RTF = [0x7b, 0x5c, 0x72, 0x74, 0x66]; // {\rtf

async function extract(bytes: Uint8Array): Promise<string> {
  if (startsWith(bytes, PDF)) {
    const { extractPdf } = await import("./extract/pdf");
    return extractPdf(bytes);
  }
  if (startsWith(bytes, ZIP)) {
    const text = extractOffice(bytes);
    if (text === null) throw new UnreadableFileError("unsupported");
    return text;
  }
  if (bytes.subarray(0, SNIFF_BYTES).includes(0)) throw new UnreadableFileError("unsupported");
  const text = new TextDecoder("utf-8").decode(bytes);
  return startsWith(bytes, RTF) ? extractRtf(text) : text;
}

/**
 * Read the text of a file: plain text of any kind, PDF, Word (.docx), PowerPoint (.pptx),
 * Excel (.xlsx), OpenDocument (.odt/.odp/.ods) or RTF. The format is sniffed from the
 * content, so the file name doesn't matter.
 */
export async function readTextFile(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try {
    text = await extract(bytes);
  } catch (err) {
    if (err instanceof UnreadableFileError) throw err;
    throw new UnreadableFileError("unsupported");
  }
  if (!text.trim()) throw new UnreadableFileError("empty");
  return text;
}

/** Copy text to the clipboard, falling back to execCommand outside secure contexts. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall through to the legacy path
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("Copy failed");
}
