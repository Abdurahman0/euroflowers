"use client";
import { Check, Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Yagona filtr tugmasi — uzun chip qatorlari o'rniga bitta ixcham dropdown.
 * Standart qiymatda neytral "chip", tanlov faolligida aksentga yonadi.
 * Tashqariga bosish / ESC yopadi; Lenis'dan himoyalangan.
 */
export default function FilterSelect({
  value,
  options,
  onChange,
  label = "Filtr",
  align = "right",
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  /** tugmadagi yozuv — hech narsa tanlanmaganda */
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const sel = options.find((o) => o.value === value);
  const active = value !== "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`chip gap-1.5 ${active ? "chip-active" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Filter size={14} strokeWidth={1.75} />
        {active && sel ? sel.label : label}
      </button>
      {open && (
        <div
          data-lenis-prevent
          role="listbox"
          className={`absolute top-[calc(100%+6px)] z-30 min-w-[190px] overflow-hidden rounded-[14px] border py-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
          style={{ background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
        >
          {options.map((o) => (
            <button
              key={o.value || "all"}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors duration-150 hover:bg-[var(--hover)]"
              style={{ color: o.value === value ? "var(--primary)" : "var(--text)" }}
            >
              {o.label}
              {o.value === value && <Check size={14} strokeWidth={2} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
