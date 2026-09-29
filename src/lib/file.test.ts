import { describe, expect, it } from "vitest";
import { docx, odt, pptx, rtf, xlsx } from "../../test/fixtures";
import { readTextFile, UnreadableFileError } from "./file";

const read = (data: BlobPart, name = "file") => readTextFile(new File([data], name));

describe("readTextFile", () => {
  it("reads UTF-8 text", async () => {
    await expect(read("héllo\nwörld", "a.txt")).resolves.toBe("héllo\nwörld");
  });

  it("reads text files regardless of extension or mime type", async () => {
    await expect(read('{"k": 1}', "data.weird")).resolves.toBe('{"k": 1}');
  });

  it("strips a UTF-8 byte order mark", async () => {
    await expect(read(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]))).resolves.toBe("hi");
  });

  it("rejects binary files", async () => {
    const err = await read(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])).catch((e) => e);
    expect(err).toBeInstanceOf(UnreadableFileError);
    expect(err.reason).toBe("unsupported");
  });

  it("rejects files with no text", async () => {
    const err = await read(" \n\t").catch((e) => e);
    expect(err).toBeInstanceOf(UnreadableFileError);
    expect(err.reason).toBe("empty");
  });

  it("rejects zips that aren't office documents", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const err = await read(zipSync({ "a.xml": strToU8("<a/>") })).catch((e) => e);
    expect(err.reason).toBe("unsupported");
  });

  it("reads Word documents", async () => {
    const text = await read(docx(["Name: Jane Doe", "", "SSN\t123-45-6789"]), "x.docx");
    expect(text).toBe("Name: Jane Doe\n\nSSN\t123-45-6789\n");
  });

  it("reads PowerPoint slides in order", async () => {
    const slides = Array.from({ length: 11 }, (_, i) => [`Slide ${i + 1}`]);
    slides[0].push("Owner: Jane");
    const text = await read(pptx(slides), "deck.pptx");
    expect(text.split("\n\n")[0]).toBe("Slide 1\nOwner: Jane");
    expect(text.split("\n\n").at(-1)).toBe("Slide 11");
  });

  it("reads Excel sheets as tab-separated rows", async () => {
    const text = await read(xlsx([["Name", "Card"], ["Jane", 4111111111111111]]), "s.xlsx");
    expect(text).toBe("Name\tCard\nJane\t4111111111111111");
  });

  it("reads OpenDocument text and tables", async () => {
    const text = await read(odt(["Hello Jane", "Bye"], [["a", "b"], ["c", "d"]]), "x.odt");
    expect(text).toBe("Hello Jane\nBye\na\tb\nc\td\n");
  });

  it("reads RTF", async () => {
    await expect(read(rtf, "x.rtf")).resolves.toBe("José Silva\nCard: 4111\t1111\nCafé\n");
  });
});
