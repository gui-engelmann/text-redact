"use client";

import { ArrowRight, FileUp, LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";

type Props = {
  onText: (text: string) => void;
  onFile: (file: File) => void;
  error: string | null;
  busy: boolean;
};

/** Start screen: paste, type, drop or pick a file. */
export function Intake({ onText, onFile, error, busy }: Props) {
  const [draft, setDraft] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (draft.trim()) onText(draft);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:py-16">
      <div
        className={`relative flex min-h-[55vh] flex-1 flex-col rounded-3xl border-2 border-dashed bg-surface transition focus-within:border-accent ${
          error ? "animate-shake border-danger" : "border-border"
        }`}
      >
        {!draft && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted">
            <span className="grid size-20 place-items-center rounded-full bg-accent-soft text-accent-strong">
              {busy ? (
                <LoaderCircle className="size-9 animate-spin" aria-label="Reading file" />
              ) : (
                <Upload className="size-9" aria-hidden />
              )}
            </span>
            <span className={`text-sm tracking-wide ${error ? "text-danger" : ""}`}>
              {error ?? "Drop · Paste · Type"}
            </span>
          </div>
        )}

        <textarea
          autoFocus
          aria-label="Text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            // Pasting into an empty box goes straight to redacting.
            const pasted = e.clipboardData.getData("text");
            if (!draft && pasted.trim()) {
              e.preventDefault();
              onText(pasted);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          className="relative flex-1 resize-none bg-transparent p-6 pb-20 text-base leading-relaxed outline-none"
        />

        <div className="absolute right-4 bottom-4 flex gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Open file"
            title="Open file"
            className="grid size-12 place-items-center rounded-full border border-border bg-surface text-fg transition hover:border-accent hover:text-accent-strong"
          >
            <FileUp className="size-5" aria-hidden />
          </button>
          {draft.trim() && (
            <button
              type="button"
              onClick={submit}
              aria-label="Start"
              title="Start"
              className="grid size-12 place-items-center rounded-full bg-accent text-on-accent shadow-sm transition hover:brightness-95"
            >
              <ArrowRight className="size-5" aria-hidden />
            </button>
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          hidden
          data-testid="file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
