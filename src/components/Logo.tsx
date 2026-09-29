/** A page of text with one line blacked out. */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5 select-none">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <rect x="8" y="8.5" width="12" height="2.5" rx="1.25" fill="var(--on-accent)" opacity=".7" />
        <rect x="8" y="14" width="16" height="5" rx="1.5" fill="var(--on-accent)" />
        <rect x="8" y="22" width="9" height="2.5" rx="1.25" fill="var(--on-accent)" opacity=".7" />
      </svg>
      <span className="text-xl font-medium tracking-tight">Redactor</span>
    </span>
  );
}
