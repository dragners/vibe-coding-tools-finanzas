import { useEffect, useId, useRef, useState } from "react";
import type { CategoryBadge, BadgeVariant } from "./categoryBadges";

type Props = {
  label: string;
  caption: string;
  allLabel: string;
  clearLabel: string;
  options: CategoryBadge[];
  selected: BadgeVariant[];
  onChange: (values: BadgeVariant[]) => void;
  align?: "left" | "right";
};

export function MultiSelectFilter({ label, caption, allLabel, clearLabel, options, selected, onChange, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const selection = options.filter(option => selected.includes(option.variant));
  const summary = selection.length === 1 ? selection[0].text : selection.length || allLabel;
  return (
    <div ref={containerRef} className="relative min-w-0"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={event => {
      if (event.key === "Escape" && open) { setOpen(false); buttonRef.current?.focus(); }
    }}>
      <button ref={buttonRef} type="button" aria-label={label} aria-expanded={open} aria-controls={listId}
        title={selection.length ? `${label}: ${selection.map(option => option.text).join(", ")}` : `${label}: ${allLabel}`}
        onClick={() => setOpen(value => !value)}
        className="flex h-[42px] w-full items-center justify-between gap-1 rounded-xl border border-slate-300/80 bg-white/90 px-2.5 text-xs text-slate-700 shadow-sm hover:border-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
        <span className="truncate">{caption}: {summary}</span><span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div id={listId} role="group" aria-label={label}
          className={`absolute top-full z-50 mt-1.5 max-h-80 w-60 max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          {selected.length > 0 ? <button type="button" aria-label={`${clearLabel}: ${label}`} onClick={() => { onChange([]); setOpen(false); buttonRef.current?.focus(); }}
            className="mb-1 w-full rounded-lg px-2 py-1 text-left text-xs text-cyan-700 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">{clearLabel}</button> : null}
          {options.map(option => (
            <label key={option.variant} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-700 hover:bg-slate-50">
              <input type="checkbox" checked={selected.includes(option.variant)}
                onChange={() => onChange(selected.includes(option.variant) ? selected.filter(value => value !== option.variant) : [...selected, option.variant])}
                className="h-3.5 w-3.5 rounded accent-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" />
              {option.text}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
