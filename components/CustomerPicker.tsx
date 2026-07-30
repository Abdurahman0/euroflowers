"use client";
import { useEffect, useRef, useState } from "react";
import { Search, X, User } from "lucide-react";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";

/**
 * Ulashilgan MIJOZ TANLAGICH — sotuv oynasi va katalog kompozitorida bir xil.
 * 3 rejim: biriktirmayman / mavjud mijoz (server qidiruvi) / yangi mijoz (ism+tel).
 * Telefon MAVJUD holatda qanday yozilsa shunday yuboriladi — backend normalizatsiya
 * qiladi va telefon bo'yicha dublikatni O'ZI aniqlaydi (klient tekshiruvi YO'Q).
 */
export type CustomerPick =
  | { mode: "none" }
  | { mode: "existing"; id: number; detail?: { id: number; name: string; masked_phone?: string } }
  | { mode: "new"; name: string; phone: string };

/** Katalog PATCH/POST uchun payload. `changedFromExisting` — item'da mijoz bor edi, "none" tozalaydi. */
export function customerPayload(v: CustomerPick, hadCustomer: boolean): Record<string, unknown> | null {
  if (v.mode === "existing") return { customer: v.id };
  if (v.mode === "new") return v.name.trim() || v.phone.trim() ? { customer_name: v.name.trim(), customer_phone: v.phone.trim() } : null;
  return hadCustomer ? { customer: null } : null; // "none": faqat mavjud mijozni tozalash kerak bo'lsa
}

const MODES: { key: CustomerPick["mode"]; label: string }[] = [
  { key: "none", label: "Biriktirmayman" },
  { key: "existing", label: "Mavjud mijoz" },
  { key: "new", label: "Yangi mijoz" },
];

export default function CustomerPicker({ value, onChange, label = "Mijoz (ixtiyoriy)" }: {
  value: CustomerPick;
  onChange: (v: CustomerPick) => void;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[] | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // debounced server qidiruv (/api/customers/?search=)
  useEffect(() => {
    if (value.mode !== "existing" || !q.trim()) { setResults(null); return; }
    const t = setTimeout(() => {
      api.customers({ search: q.trim(), ordering: "-created_at", page_size: 8 }).then((r) => setResults(r)).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q, value.mode]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const selected = value.mode === "existing" ? value.detail : undefined;

  return (
    <div>
      <div className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>{label}</div>
      {/* rejim segmenti */}
      <div className="mb-2.5 flex gap-1 rounded-[12px] p-1" style={{ background: "var(--surface-2)" }}>
        {MODES.map((m) => (
          <button key={m.key} type="button"
            onClick={() => { onChange(m.key === "none" ? { mode: "none" } : m.key === "existing" ? { mode: "existing", id: value.mode === "existing" ? value.id : 0, detail: value.mode === "existing" ? value.detail : undefined } : { mode: "new", name: value.mode === "new" ? value.name : "", phone: value.mode === "new" ? value.phone : "" }); setOpen(false); setQ(""); }}
            className="flex-1 rounded-[9px] py-1.5 text-[12.5px] font-bold transition-colors"
            style={{ background: value.mode === m.key ? "var(--surface-solid)" : "transparent", color: value.mode === m.key ? "var(--primary)" : "var(--muted)" }}>
            {m.label}
          </button>
        ))}
      </div>

      {value.mode === "existing" && (
        <div ref={boxRef} className="relative">
          {selected && selected.id ? (
            <div className="flex items-center justify-between gap-2 rounded-[12px] border px-3 py-2" style={{ borderColor: "var(--primary)" }}>
              <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
                <User size={14} strokeWidth={2} style={{ color: "var(--primary)" }} />
                <span className="truncate">{selected.name || "Mijoz"}</span>
                {selected.masked_phone && <span className="shrink-0 text-[12px]" style={{ color: "var(--muted)" }}>{selected.masked_phone}</span>}
              </span>
              <button type="button" onClick={() => { onChange({ mode: "existing", id: 0, detail: undefined }); setQ(""); }} className="shrink-0 opacity-60 hover:opacity-100" title="Boshqasini tanlash"><X size={15} /></button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-[12px] border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <Search size={14} strokeWidth={2} className="shrink-0 opacity-60" />
                <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Ism yoki telefon bo'yicha qidirish…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-[color:var(--muted)]" style={{ color: "var(--text)" }} />
              </div>
              {open && q.trim() && (
                <div className="thin-scroll absolute z-30 mt-1 max-h-[220px] w-full overflow-y-auto rounded-[12px] border shadow-xl" style={{ background: "var(--surface-solid)", borderColor: "var(--border)" }}>
                  {results === null && <p className="px-3 py-2.5 text-[12.5px]" style={{ color: "var(--muted)" }}>Qidirilmoqda…</p>}
                  {results && results.length === 0 && <p className="px-3 py-2.5 text-[12.5px]" style={{ color: "var(--muted)" }}>Topilmadi — «Yangi mijoz» rejimidan foydalaning.</p>}
                  {results && results.map((c) => (
                    <button key={c.id} type="button" onClick={() => { onChange({ mode: "existing", id: c.id, detail: { id: c.id, name: c.name, masked_phone: c.masked_phone } }); setOpen(false); setQ(""); }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[color:var(--hover)]">
                      <span className="truncate text-[13px] font-semibold">{c.name || `@${c.instagram_username}` || "Mijoz"}</span>
                      <span className="shrink-0 text-[12px]" style={{ color: "var(--muted)" }}>{c.masked_phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {value.mode === "new" && (
        <div className="grid grid-cols-2 gap-2.5">
          <input className="inp" value={value.name} onChange={(e) => onChange({ mode: "new", name: e.target.value, phone: value.phone })} placeholder="Ism" />
          <input className="inp" inputMode="tel" value={value.phone} onChange={(e) => onChange({ mode: "new", name: value.name, phone: e.target.value })} placeholder="Telefon (masalan: 90 111 22 33)" />
        </div>
      )}
      {value.mode === "new" && <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>Telefon avtomatik normalizatsiya qilinadi; shu raqamli mijoz bo'lsa unga bog'lanadi.</p>}
    </div>
  );
}
