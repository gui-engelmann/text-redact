import { describe, expect, it } from "vitest";
import { countMatches, hasTerm, MASK, redact, segment, tokenize } from "./redact";

describe("redact", () => {
  it("replaces every occurrence, ignoring case", () => {
    expect(redact("Alice met bob. ALICE left.", ["alice", "bob"])).toBe(
      `${MASK} met ${MASK}. ${MASK} left.`,
    );
  });

  it("returns the text unchanged with no terms", () => {
    expect(redact("hello", [])).toBe("hello");
    expect(redact("hello", ["", "  "])).toBe("hello");
  });

  it("treats special characters literally", () => {
    expect(redact("a.b and axb", ["a.b"])).toBe(`${MASK} and axb`);
    expect(redact("cost: $5 (approx)", ["$5", "(approx)"])).toBe(`cost: ${MASK} ${MASK}`);
  });

  it("prefers the longest overlapping term", () => {
    expect(redact("a.b and a.bc", ["a.b", "a.bc"])).toBe(`${MASK} and ${MASK}`);
    expect(redact("John Smith and John", ["John", "John Smith"])).toBe(`${MASK} and ${MASK}`);
  });

  it("does not redact inside other words", () => {
    expect(redact("an and ban", ["an"])).toBe(`${MASK} and ban`);
    expect(redact("Ann's plan", ["ann"])).toBe(`${MASK}'s plan`);
  });

  it("matches terms that start or end with punctuation inside words", () => {
    expect(redact("john@acme.com", ["@acme.com"])).toBe(`john${MASK}`);
  });

  it("redacts a name inside an email unless the whole email is a term", () => {
    expect(redact("jane@corp.io", ["jane"])).toBe(`${MASK}@corp.io`);
    expect(redact("Jane <jane@corp.io>", ["jane", "jane@corp.io"])).toBe(`${MASK} <${MASK}>`);
  });

  it("handles unicode letters as word characters", () => {
    expect(redact("José e Josémaria", ["josé"])).toBe(`${MASK} e Josémaria`);
  });

  it("preserves whitespace and line breaks", () => {
    expect(redact("key: secret\n\tsecret  end", ["secret"])).toBe(`key: ${MASK}\n\t${MASK}  end`);
  });

  it("dedupes terms case-insensitively", () => {
    expect(redact("Bob bob", ["bob", "BOB"])).toBe(`${MASK} ${MASK}`);
  });
});

describe("segment", () => {
  it("keeps the original value and the matched term", () => {
    expect(segment("Hi BOB!", ["bob"])).toEqual([
      { type: "text", value: "Hi " },
      { type: "redacted", value: "BOB", term: "bob" },
      { type: "text", value: "!" },
    ]);
  });

  it("returns no segments for empty text", () => {
    expect(segment("", ["x"])).toEqual([]);
  });
});

describe("countMatches", () => {
  it("counts occurrences per term", () => {
    const counts = countMatches("a b A c b", ["a", "B", "z"]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(2);
    expect(counts.get("z")).toBeUndefined();
  });
});

describe("hasTerm", () => {
  it("is case-insensitive", () => {
    expect(hasTerm(["Alice"], "alice")).toBe(true);
    expect(hasTerm(["Alice"], "bob")).toBe(false);
  });
});

describe("tokenize", () => {
  it("splits words and strips surrounding punctuation", () => {
    expect(tokenize('Email (john@acme.com), "now".')).toEqual([
      { type: "word", value: "Email" },
      { type: "gap", value: " (" },
      { type: "word", value: "john@acme.com" },
      { type: "gap", value: '), "' },
      { type: "word", value: "now" },
      { type: "gap", value: '".' },
    ]);
  });

  it("keeps inner punctuation and treats pure punctuation as a gap", () => {
    expect(tokenize("555-1234 — O'Brien")).toEqual([
      { type: "word", value: "555-1234" },
      { type: "gap", value: " — " },
      { type: "word", value: "O'Brien" },
    ]);
  });

  it("round-trips the original text", () => {
    const text = "  Line one.\n\n(two)  three!!\t";
    expect(
      tokenize(text)
        .map((t) => t.value)
        .join(""),
    ).toBe(text);
  });
});
