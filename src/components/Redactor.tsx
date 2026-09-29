"use client";

import { RotateCcw, Upload } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { copyText, readTextFile, UnreadableFileError } from "@/lib/file";
import { countMatches, hasTerm, normalizeTerm, redact, segment } from "@/lib/redact";
import { Intake } from "./Intake";
import { Logo } from "./Logo";
import { TermsPanel } from "./TermsPanel";
import { ThemeToggle } from "./ThemeToggle";
import { Viewer } from "./Viewer";

export function Redactor() {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [terms, setTerms] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const segments = useMemo(() => segment(text ?? "", terms), [text, terms]);
  const counts = useMemo(() => countMatches(text ?? "", terms), [text, terms]);

  const addTerm = useCallback((raw: string) => {
    const term = normalizeTerm(raw);
    if (!term) return;
    setTerms((prev) => (hasTerm(prev, term) ? prev : [...prev, term]));
  }, []);

  const removeTerm = useCallback((term: string) => {
    const key = term.toLowerCase();
    setTerms((prev) => prev.filter((t) => t.toLowerCase() !== key));
  }, []);

  const flashError = (message: string) => {
    setError(message);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 2500);
  };

  const openText = (value: string, name: string | null = null) => {
    setError(null);
    setText(value);
    setFileName(name);
  };

  const openFile = async (file: File) => {
    setBusy(true);
    try {
      openText(await readTextFile(file), file.name);
    } catch (err) {
      flashError(err instanceof UnreadableFileError ? err.message : "Can't read this file");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setText(null);
    setFileName(null);
    setTerms([]);
  };

  const hasDraggable = (e: DragEvent) =>
    e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("text/plain");

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      void openFile(file);
      return;
    }
    const dropped = e.dataTransfer.getData("text/plain");
    if (dropped.trim()) openText(dropped);
  };

  return (
    <div
      className="flex min-h-screen flex-1 flex-col"
      onDragEnter={(e) => {
        if (hasDraggable(e)) setDragging(true);
      }}
    >
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          {text !== null && (
            <button
              type="button"
              onClick={reset}
              aria-label="Start over"
              title="Start over"
              className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-accent-soft hover:text-fg"
            >
              <RotateCcw className="size-5" aria-hidden />
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {text === null ? (
        <Intake onText={openText} onFile={openFile} error={error} busy={busy} />
      ) : (
        <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 pb-8 sm:px-6 content-start items-start lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section
            className={`rounded-2xl border bg-surface p-6 sm:p-8 ${
              error ? "animate-shake border-danger" : "border-border"
            }`}
          >
            {(error || fileName) && (
              <div className={`mb-4 truncate text-xs tracking-wide ${error ? "text-danger" : "text-muted"}`}>
                {error ?? fileName}
              </div>
            )}
            <Viewer segments={segments} onAdd={addTerm} onRemove={removeTerm} />
          </section>
          <div className="order-first lg:order-none">
            <TermsPanel
              terms={terms}
              counts={counts}
              onAdd={addTerm}
              onRemove={removeTerm}
              onClear={() => setTerms([])}
              onCopy={() => copyText(redact(text, terms))}
            />
          </div>
        </main>
      )}

      {dragging && (
        <div
          data-testid="drop-overlay"
          className="fixed inset-0 z-50 grid place-items-center bg-accent/20 backdrop-blur-sm"
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="pointer-events-none grid size-40 place-items-center rounded-full border-4 border-dashed border-accent bg-surface/80 text-accent-strong">
            <Upload className="size-14" aria-hidden />
          </div>
        </div>
      )}
    </div>
  );
}
