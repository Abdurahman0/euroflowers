"use client";
import { useEffect, useRef, useState } from "react";

export type SelectOption = {
  value: number | string;
  label: string;
  sub?: string;
  dot?: string; // rang nuqtasi (hex) — ixtiyoriy
};

/** Qo'lda yasalgan select — modal glass dizayniga mos, native <select> o'rniga. */
export default function Select({
  value,
  options,
  onChange,
  placeholder = "Tanlang",
}: {
  value: number | string;
  options: SelectOption[];
  onChange: (v: number | string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sel = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="inp flex items-center gap-2 text-left normal-case tracking-normal">
        {sel?.dot && <span className="h-3 w-3 shrink-0 rounded-full border border-white/40" style={{ background: sel.dot }} />}
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
          {sel ? sel.label : <span className="opacity-50">{placeholder}</span>}
        </span>
        <span className={`text-[10px] opacity-60 transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && (
        <div data-lenis-prevent className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[212px] overflow-y-auto overscroll-contain rounded-[14px] border border-white/28 shadow-2xl backdrop-blur-3xl" style={{ background: "rgba(26,20,40,.92)" }}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left normal-case tracking-normal hover:bg-white/10 ${o.value === value ? "bg-white/[.07]" : ""}`}
            >
              {o.dot && <span className="h-3 w-3 shrink-0 rounded-full border border-white/40" style={{ background: o.dot }} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-white">{o.label}</span>
                {o.sub && <span className="block truncate text-[11px] text-white/55">{o.sub}</span>}
              </span>
              {o.value === value && <span className="text-[11px]" style={{ color: "var(--accL)" }}>✓</span>}
            </button>
          ))}
          {options.length === 0 && <p className="px-3.5 py-2.5 text-[12px] text-white/55">Variant topilmadi</p>}
        </div>
      )}
    </div>
  );
}
