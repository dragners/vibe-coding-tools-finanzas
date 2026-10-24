import { useEffect, useId, useRef, useState } from "react";

type FilterOption<T extends string> = { value: T; text: string; style?: string };
type Props<T extends string> = {
  label: string;
  caption: string;
  allLabel: string;
  clearLabel: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (values: T[]) => void;
  align?: "left" | "right";
};

export function MultiSelectFilter<T extends string>({ label, caption, allLabel, clearLabel, options, selected, onChange, align = "left" }: Props<T>) {
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
  const selection = options.filter(option => selected.includes(option.value));
  const summary = selection.length === 1 ? selection[0].text : selection.length || allLabel;
  const isFiltered = selected.length > 0;
  const selectOption = (value: T) => {
    onChange(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
  };
  return (
    <div ref={containerRef} className="relative min-w-0"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={event => {
        if (event.key === "Escape" && open) { setOpen(false); buttonRef.current?.focus(); }
      }}>
      <button ref={buttonRef} type="button" aria-label={label} aria-expanded={open} aria-controls={listId}
        title={selection.length ? `${label}: ${selection.map(option => option.text).join(", ")}` : `${label}: ${allLabel}`}
        onClick={() => setOpen(value => !value)}
        className={`flex h-[42px] w-full items-center justify-between gap-1.5 rounded-xl border px-2.5 text-xs text-slate-700 shadow-sm transition-colors hover:border-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${open || isFiltered ? "border-cyan-300 bg-cyan-50" : "border-slate-300/80 bg-white/90"}`}>
        <span className="flex min-w-0 flex-col gap-0.5 text-left leading-tight">
          <span className="text-[9px] font-bold text-slate-500">{caption}</span>
          <span className="truncate font-bold">{summary}</span>
        </span>
        <svg aria-hidden="true" className={`h-3 w-3 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open ? (
        <div id={listId} role="group" aria-label={label}
          className={`absolute top-full z-50 mt-1.5 max-h-80 w-72 max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          {selected.length > 0 ? <button type="button" aria-label={`${clearLabel}: ${label}`} onClick={() => { onChange([]); setOpen(false); buttonRef.current?.focus(); }}
            className="mb-1 w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-cyan-700 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">{clearLabel}</button> : null}
          {options.map(option => {
            const checked = selected.includes(option.value);
            return (
              <button key={option.value} type="button" role="checkbox" aria-checked={checked}
                onClick={() => selectOption(option.value)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 ${checked ? "bg-cyan-50" : "hover:bg-slate-50"}`}>
                <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-300 bg-white"}`}>
                  {checked ? <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg> : null}
                </span>
                <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full border ${option.style ?? "border-slate-400 bg-slate-300"}`} />
                <span>{option.text}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
