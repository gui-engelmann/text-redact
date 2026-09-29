/** Text of every page of a PDF, pages separated by a blank line. Loaded on demand. */
export async function extractPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const task = pdfjs.getDocument({ data: bytes });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str + (item.hasEOL ? "\n" : "");
      }
      pages.push(text.trimEnd());
    }
    return pages.join("\n\n");
  } finally {
    await task.destroy();
  }
}
