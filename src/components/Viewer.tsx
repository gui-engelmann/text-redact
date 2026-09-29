"use client";

import { memo, type MouseEvent } from "react";
import { MASK, tokenize, type Segment } from "@/lib/redact";

type Props = {
  segments: Segment[];
  onAdd: (term: string) => void;
  onRemove: (term: string) => void;
};

/** The document: click a word to redact it, click a redaction to restore it, or select a phrase. */
export const Viewer = memo(function Viewer({ segments, onAdd, onRemove }: Props) {
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    // Ignore the second click of a double-click, which would undo the first.
    if (e.detail > 1) return;

    const selection = window.getSelection();
    const selected = selection?.toString().trim() ?? "";
    if (selected && !selected.includes(MASK)) {
      selection?.removeAllRanges();
      onAdd(selected);
      return;
    }

    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-word],[data-term]");
    if (!el) return;
    if (el.dataset.term !== undefined) onRemove(el.dataset.term);
    else onAdd(el.textContent ?? "");
  };

  return (
    <div
      data-testid="viewer"
      onClick={handleClick}
      className="text-[15px] leading-8 break-words whitespace-pre-wrap"
    >
      {segments.map((s, i) =>
        s.type === "redacted" ? (
          <mark
            key={i}
            data-term={s.term}
            title={s.value}
            className="cursor-pointer rounded-md bg-accent px-1 py-0.5 font-medium text-on-accent transition hover:opacity-70"
          >
            {MASK}
          </mark>
        ) : (
          tokenize(s.value).map((t, j) =>
            t.type === "word" ? (
              <span
                key={`${i}-${j}`}
                data-word=""
                className="cursor-pointer rounded-md transition-colors hover:bg-accent-soft hover:text-accent-strong"
              >
                {t.value}
              </span>
            ) : (
              t.value
            ),
          )
        ),
      )}
    </div>
  );
});
