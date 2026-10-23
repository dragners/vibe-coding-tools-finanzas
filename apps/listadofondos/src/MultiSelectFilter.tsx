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
  multiple?: boolean;
};

export function MultiSelectFilter<T extends string>({ label, caption, allLabel, clearLabel, options, selected, onChange, align = "left", multiple = true }: Props<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
  const isFiltered = multiple ? selected.length > 0 : selected[0] !== options[0]?.value;
  const selectOption = (value: T) => {
    onChange(multiple ? selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value] : [value]);
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
        <div ref={listRef} id={listId} role={multiple ? "group" : "radiogroup"} aria-label={label}
          className={`absolute top-full z-50 mt-1.5 max-h-80 w-72 max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          {multiple && selected.length > 0 ? <button type="button" aria-label={`${clearLabel}: ${label}`} onClick={() => { onChange([]); setOpen(false); buttonRef.current?.focus(); }}
            className="mb-1 w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-cyan-700 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">{clearLabel}</button> : null}
          {options.map((option, index) => {
            const checked = selected.includes(option.value);
            return (
              <button key={option.value} type="button" role={multiple ? "checkbox" : "radio"} aria-checked={checked}
                tabIndex={multiple || checked ? 0 : -1}
                onClick={() => selectOption(option.value)}
                onKeyDown={event => {
                  if (!multiple && ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) {
                    event.preventDefault();
                    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
                      : (index + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
                    selectOption(options[next].value);
                    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
                  }
                }}
                className={`mb-1 flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors last:mb-0 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600 ${option.style ?? "border-slate-200 bg-slate-100 text-slate-700"} ${checked ? "font-semibold" : ""}`}>
                <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center border ${multiple ? "rounded" : "rounded-full"} ${checked ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-300 bg-white"}`}>
                  {checked ? <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg> : null}
                </span>
                <span>{option.text}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
