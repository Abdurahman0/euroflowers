"use client";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import Select from "./Select";
import { useStore } from "@/lib/store";
import type { Packaging, StockBatch } from "@/lib/types";

/**
 * Lead uchun sklad sarfi tanlagichlari — gul (stock_usage_input) va
 * material/savat (packaging_usage_input) qatorlari. Lead «Sotildi» bo'lganda
 * backend AYNAN shu qatorlar bo'yicha skladni avtomatik kamaytiradi.
 */

export type StockRow = { stock_batch: number; quantity_stems: number };
export type PackRow = { packaging: number; quantity: number };

export const batchLabel = (b: StockBatch) =>
  `${b.variant_detail?.flower_detail?.name_uz ?? ""} — ${b.variant_detail?.name_uz || b.variant_detail?.name_ru || ""}`.trim();

const PKG_TYPE: Record<string, string> = { wrap: "O'ram", basket: "Savat", box: "Quti", accessory: "Aksessuar" };

const chipCls =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold normal-case tracking-normal";
const chipStyle = { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text)" } as const;

export function StockUsagePicker({
  batches,
  rows,
  onChange,
}: {
  batches: StockBatch[];
  rows: StockRow[];
  onChange: (rows: StockRow[]) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [pick, setPick] = useState(0);
  const [qty, setQty] = useState("10");
  const byId = (id: number) => batches.find((b) => b.id === id);

  const add = () => {
    const b = byId(pick);
    const n = +qty || 0;
    if (!b || n <= 0) return showToast("Partiyani va sonini tanlang");
    const already = rows.find((r) => r.stock_batch === b.id)?.quantity_stems ?? 0;
    if (already + n > b.remaining_stems) {
      return showToast(`Qoldiq yetarli emas: ${b.remaining_stems} dona bor (№${b.batch_number})`);
    }
    const i = rows.findIndex((r) => r.stock_batch === b.id);
    onChange(i >= 0 ? rows.map((r, j) => (j === i ? { ...r, quantity_stems: r.quantity_stems + n } : r)) : [...rows, { stock_batch: b.id, quantity_stems: n }]);
    setQty("10");
  };

  return (
    <span className="flex flex-col gap-2">
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <Select
            value={pick}
            onChange={(v) => setPick(+v)}
            placeholder={batches.length ? "Sklad partiyasini tanlang" : "Skladda faol partiya yo'q"}
            options={batches.map((b) => ({
              value: b.id,
              label: batchLabel(b),
              sub: `${b.remaining_stems} dona bor · ${Math.round(+b.sale_price_per_stem).toLocaleString("ru")} so'm/dona · №${b.batch_number}`,
            }))}
          />
        </span>
        <input
          className="inp !w-[64px] shrink-0 text-right"
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
          aria-label="Soni (dona)"
        />
        <button type="button" onClick={add} className="icon-btn shrink-0 border" style={{ borderColor: "var(--border)" }} title="Gul qo'shish" aria-label="Gul qo'shish">
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </span>
      {rows.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {rows.map((r) => {
            const b = byId(r.stock_batch);
            return (
              <span key={r.stock_batch} className={chipCls} style={chipStyle}>
                🌸 {b ? batchLabel(b) : `Partiya #${r.stock_batch}`} × {r.quantity_stems}
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((x) => x.stock_batch !== r.stock_batch))}
                  aria-label="Olib tashlash"
                  className="opacity-60 transition-opacity hover:opacity-100"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}

export function MaterialUsagePicker({
  materials,
  rows,
  onChange,
}: {
  materials: Packaging[];
  rows: PackRow[];
  onChange: (rows: PackRow[]) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [pick, setPick] = useState(0);
  const [qty, setQty] = useState("1");
  const byId = (id: number) => materials.find((m) => m.id === id);

  const add = () => {
    const m = byId(pick);
    const n = +qty || 0;
    if (!m || n <= 0) return showToast("Materialni va sonini tanlang");
    const i = rows.findIndex((r) => r.packaging === m.id);
    onChange(i >= 0 ? rows.map((r, j) => (j === i ? { ...r, quantity: r.quantity + n } : r)) : [...rows, { packaging: m.id, quantity: n }]);
    setQty("1");
  };

  return (
    <span className="flex flex-col gap-2">
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <Select
            value={pick}
            onChange={(v) => setPick(+v)}
            placeholder={materials.length ? "Material/savat tanlang" : "Material yo'q"}
            options={materials.map((m) => ({
              value: m.id,
              label: `${m.name_uz || m.name_ru}${m.size ? ` (${m.size})` : ""}`,
              sub: `${PKG_TYPE[m.packaging_type] ?? m.packaging_type} · ${Math.round(+m.sale_price).toLocaleString("ru")} so'm · ${m.quantity} dona bor`,
            }))}
          />
        </span>
        <input
          className="inp !w-[64px] shrink-0 text-right"
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
          aria-label="Soni"
        />
        <button type="button" onClick={add} className="icon-btn shrink-0 border" style={{ borderColor: "var(--border)" }} title="Material qo'shish" aria-label="Material qo'shish">
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </span>
      {rows.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {rows.map((r) => {
            const m = byId(r.packaging);
            return (
              <span key={r.packaging} className={chipCls} style={chipStyle}>
                🧺 {m ? m.name_uz || m.name_ru : `Material #${r.packaging}`} × {r.quantity}
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((x) => x.packaging !== r.packaging))}
                  aria-label="Olib tashlash"
                  className="opacity-60 transition-opacity hover:opacity-100"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}
