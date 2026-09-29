import { unzipSync, strFromU8, type Unzipped } from "fflate";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const TEXT = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
const TABLE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";

export type OfficeKind = "docx" | "pptx" | "xlsx" | "odf";

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const is = (el: Element, ns: string, ...names: string[]) =>
  el.namespaceURI === ns && names.includes(el.localName);
const byNumber = (a: string, b: string) =>
  Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0) - Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);

/** Tell which office format a zip holds, or null if it isn't one we read. */
export function detectOffice(files: Unzipped): OfficeKind | null {
  if (files["word/document.xml"]) return "docx";
  if (files["ppt/presentation.xml"]) return "pptx";
  if (files["xl/workbook.xml"]) return "xlsx";
  if (files["content.xml"]) return "odf";
  return null;
}

/** Text of an OOXML part: `text` elements hold text, `blocks` end a line. */
function ooxmlText(xml: string, ns: string, text: string, blocks: string[], breaks: string[]) {
  let out = "";
  const visit = (el: Element) => {
    if (is(el, ns, text)) {
      out += el.textContent ?? "";
      return;
    }
    if (is(el, ns, "tab")) out += "\t";
    else if (is(el, ns, ...breaks)) out += "\n";
    for (const child of el.children) visit(child);
    if (is(el, ns, ...blocks)) out += "\n";
  };
  visit(parse(xml).documentElement);
  return out;
}

function docx(files: Unzipped): string {
  return ooxmlText(strFromU8(files["word/document.xml"]), W, "t", ["p"], ["br", "cr"]);
}

function pptx(files: Unzipped): string {
  return Object.keys(files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(byNumber)
    .map((name) => ooxmlText(strFromU8(files[name]), A, "t", ["p"], ["br"]).trimEnd())
    .join("\n\n");
}

function xlsx(files: Unzipped): string {
  const shared = files["xl/sharedStrings.xml"]
    ? [...parse(strFromU8(files["xl/sharedStrings.xml"])).getElementsByTagNameNS(S, "si")].map(
        (si) => [...si.getElementsByTagNameNS(S, "t")].map((t) => t.textContent).join(""),
      )
    : [];

  const cellText = (c: Element) => {
    const type = c.getAttribute("t");
    const v = c.getElementsByTagNameNS(S, "v")[0]?.textContent ?? "";
    if (type === "s") return shared[Number(v)] ?? "";
    if (type === "inlineStr")
      return [...c.getElementsByTagNameNS(S, "t")].map((t) => t.textContent).join("");
    return v;
  };

  return Object.keys(files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort(byNumber)
    .map((name) =>
      [...parse(strFromU8(files[name])).getElementsByTagNameNS(S, "row")]
        .map((row) => [...row.getElementsByTagNameNS(S, "c")].map(cellText).join("\t"))
        .join("\n"),
    )
    .join("\n\n");
}

/** OpenDocument text, presentation and spreadsheet (.odt, .odp, .ods). */
function odf(files: Unzipped): string {
  let out = "";
  const visit = (node: Node, inCell: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Only text inside paragraphs is content; the rest is XML indentation.
      if (node.parentElement?.namespaceURI === TEXT) out += node.nodeValue;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (is(el, TEXT, "s")) {
      out += " ".repeat(Number(el.getAttributeNS(TEXT, "c") ?? 1) || 1);
      return;
    }
    if (is(el, TEXT, "tab")) out += "\t";
    else if (is(el, TEXT, "line-break")) out += "\n";

    const cell = inCell || is(el, TABLE, "table-cell");
    for (const child of el.childNodes) visit(child, cell);

    if (is(el, TEXT, "p", "h")) out += inCell ? " " : "\n";
    else if (is(el, TABLE, "table-cell")) out = out.replace(/ $/, "") + "\t";
    else if (is(el, TABLE, "table-row")) out = out.replace(/\t+$/, "") + "\n";
  };
  visit(parse(strFromU8(files["content.xml"])).documentElement, false);
  return out;
}

/** Extract the text of an office document zip, or null if it isn't one. */
export function extractOffice(bytes: Uint8Array): string | null {
  const files = unzipSync(bytes, {
    filter: (f) => f.name.endsWith(".xml"),
  });
  const kind = detectOffice(files);
  if (!kind) return null;
  return { docx, pptx, xlsx, odf }[kind](files);
}
