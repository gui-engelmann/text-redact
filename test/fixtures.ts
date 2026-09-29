// Builds small documents in each supported format, for unit and e2e tests.
import { strToU8, zipSync } from "fflate";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const ODF =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';

// Copies into a fresh ArrayBuffer so the result is a valid BlobPart.
const bytes = (u8: Uint8Array) => new Uint8Array(u8);

const zip = (files: Record<string, string>) =>
  bytes(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));

/** Paragraphs become <w:p>; "\t" becomes <w:tab/>. */
export function docx(paragraphs: string[]): Uint8Array<ArrayBuffer> {
  const body = paragraphs
    .map(
      (p) =>
        `<w:p>${p
          .split("\t")
          .map((run) => `<w:r><w:t xml:space="preserve">${run}</w:t></w:r>`)
          .join("<w:r><w:tab/></w:r>")}</w:p>`,
    )
    .join("");
  return zip({
    "[Content_Types].xml": "<Types/>",
    "word/document.xml": `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`,
  });
}

/** One slide per entry, one paragraph per line. */
export function pptx(slides: string[][]): Uint8Array<ArrayBuffer> {
  const files: Record<string, string> = {
    "ppt/presentation.xml": `<p:presentation ${P}/>`,
  };
  slides.forEach((lines, i) => {
    const paras = lines.map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join("");
    files[`ppt/slides/slide${i + 1}.xml`] =
      `<p:sld ${P} ${A}><p:cSld><p:spTree><p:sp><p:txBody>${paras}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  });
  return zip(files);
}

/** A single sheet; strings go through the shared string table, numbers inline. */
export function xlsx(rows: (string | number)[][]): Uint8Array<ArrayBuffer> {
  const shared: string[] = [];
  const sheetRows = rows
    .map(
      (row) =>
        `<row>${row
          .map((cell) => {
            if (typeof cell === "number") return `<c><v>${cell}</v></c>`;
            shared.push(cell);
            return `<c t="s"><v>${shared.length - 1}</v></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  return zip({
    "xl/workbook.xml": `<workbook ${S}/>`,
    "xl/sharedStrings.xml": `<sst ${S}>${shared.map((s) => `<si><t>${s}</t></si>`).join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<worksheet ${S}><sheetData>${sheetRows}</sheetData></worksheet>`,
  });
}

/** An OpenDocument text file: paragraphs, then an optional table. */
export function odt(paragraphs: string[], table: string[][] = []): Uint8Array<ArrayBuffer> {
  const paras = paragraphs.map((p) => `<text:p>${p}</text:p>`).join("\n    ");
  const rows = table
    .map(
      (r) =>
        `<table:table-row>${r.map((c) => `<table:table-cell><text:p>${c}</text:p></table:table-cell>`).join("")}</table:table-row>`,
    )
    .join("");
  return zip({
    mimetype: "application/vnd.oasis.opendocument.text",
    "content.xml": `<?xml version="1.0"?>
<office:document-content ${ODF}>
  <office:body><office:text>
    ${paras}
    ${rows ? `<table:table>${rows}</table:table>` : ""}
  </office:text></office:body>
</office:document-content>`,
  });
}

/** A minimal one-font PDF with one text line per entry, one page per array. */
export function pdf(pages: string[][]): Uint8Array<ArrayBuffer> {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((lines, i) => {
    const escaped = lines.map((l) => l.replace(/[\\()]/g, "\\$&"));
    const stream = `BT /F1 12 Tf 72 720 Td 16 TL ${escaped.map((l) => `(${l}) '`).join(" ")} ET`;
    objects[pageIds[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
    objects[pageIds[i] + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return bytes(strToU8(out));
}

export const rtf = String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Arial;}}{\colortbl;\red0\green0\blue0;}
{\*\generator Test;}\f0 Jos\'e9 Silva\par
Card: 4111\tab 1111\par
Caf\u233?\par
}`;
