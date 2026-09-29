"use client";

import { Check, Copy, MousePointerClick, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

type Props = {
  terms: string[];
  counts: Map<string, number>;
  onAdd: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
  onCopy: () => Promise<void>;
};

export function TermsPanel({ terms, counts, onAdd, onRemove, onClear, onCopy }: Props) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState("");

  const copy = async () => {
    try {
      await onCopy();
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const add = () => {
    onAdd(draft);
    setDraft("");
  };

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)]">
      <button
        type="button"
        onClick={copy}
        className={`flex h-12 items-center justify-center gap-2 rounded-full font-medium shadow-sm transition ${
          copied ? "bg-accent-strong text-surface" : "bg-accent text-on-accent hover:brightness-95"
        }`}
      >
        {copied ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span
            aria-label="Redacted terms"
            className="grid h-6 min-w-6 place-items-center rounded-full bg-accent-soft px-2 text-xs font-semibold text-accent-strong"
          >
            {terms.length}
          </span>
          {terms.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear all"
              title="Clear all"
              className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-accent-soft hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {terms.length === 0 ? (
          <div className="grid flex-1 place-items-center py-10 text-muted" aria-hidden>
            <MousePointerClick className="size-8 opacity-60" />
          </div>
        ) : (
          <ul aria-label="Terms" className="flex-1 space-y-1 overflow-y-auto p-2">
            {terms.map((term) => (
              <li
                key={term.toLowerCase()}
                className="group flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-accent-soft"
              >
                <span className="min-w-0 flex-1 truncate text-sm" title={term}>
                  {term}
                </span>
                <span className="text-xs text-muted tabular-nums">
                  {counts.get(term.toLowerCase()) ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(term)}
                  aria-label={`Remove ${term}`}
                  className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-danger"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex items-center gap-2 border-t border-border p-2"
        >
          <Plus className="ml-3 size-4 shrink-0 text-muted" aria-hidden />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Add term"
            enterKeyHint="done"
            className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-2 text-sm outline-none focus:bg-accent-soft"
          />
        </form>
      </div>
    </aside>
  );
}
