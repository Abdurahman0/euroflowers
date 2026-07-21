"use client";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import Select from "./Select";
import { useStore } from "@/lib/store";
import type { CatalogItem, Packaging, StockBatch } from "@/lib/types";

/**
 * Lead uchun sklad sarfi tanlagichlari — gul (stock_usage_input) va
 * material/savat (packaging_usage_input) qatorlari. Lead «Sotildi» bo'lganda
 * backend AYNAN shu qatorlar bo'yicha skladni avtomatik kamaytiradi.
 */

export type StockRow = { stock_batch: number; quantity_stems: number };
export type PackRow = { packaging: number; quantity: number };
export type CatalogRow = { item: CatalogItem; qty: number };

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
    // qo'shilgach tanlov tozalanadi — keyingi gul toza ro'yxatdan tanlanadi
    setPick(0);
    setQty("10");
  };

  // ro'yxatda ko'rinadigan qoldiq: skladdagi − allaqachon qo'shilgani (jonli)
  const leftOf = (b: StockBatch) => b.remaining_stems - (rows.find((r) => r.stock_batch === b.id)?.quantity_stems ?? 0);

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
              sub: `Skladda: ${leftOf(b)} dona · ${Math.round(+b.sale_price_per_stem).toLocaleString("ru")} so'm/dona · №${b.batch_number}`,
              hint: `${leftOf(b)} dona`,
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

/** Turi = «Katalog» bo'lganda: gul alohida emas, TAYYOR katalog pozitsiyasi
    tanlanadi — tarkibi (skladdagi partiyalar) leadga sarf sifatida yoziladi. */
export function CatalogUsagePicker({
  items,
  rows,
  onChange,
}: {
  items: CatalogItem[];
  rows: CatalogRow[];
  onChange: (rows: CatalogRow[]) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [pick, setPick] = useState(0);
  const [qty, setQty] = useState("1");
  const remaining = (it: CatalogItem) => Math.max((it.quantity_total ?? 1) - (it.quantity_sold ?? 0), 0);

  const add = () => {
    const it = items.find((x) => x.id === pick);
    const n = +qty || 0;
    if (!it || n <= 0) return showToast("Katalog gulini va sonini tanlang");
    const already = rows.find((r) => r.item.id === it.id)?.qty ?? 0;
    if (already + n > remaining(it)) return showToast(`Katalogda ${remaining(it)} ta qoldi: ${it.name_uz || it.name_ru}`);
    const i = rows.findIndex((r) => r.item.id === it.id);
    onChange(i >= 0 ? rows.map((r, j) => (j === i ? { ...r, qty: r.qty + n } : r)) : [...rows, { item: it, qty: n }]);
    // qo'shilgach tanlov tozalanadi
    setPick(0);
    setQty("1");
  };

  // ko'rinadigan qoldiq: katalogdagi − allaqachon qo'shilgani (jonli)
  const leftOf = (it: CatalogItem) => remaining(it) - (rows.find((r) => r.item.id === it.id)?.qty ?? 0);

  return (
    <span className="flex flex-col gap-2">
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <Select
            value={pick}
            onChange={(v) => setPick(+v)}
            placeholder={items.length ? "Katalogdan tayyor gul tanlang" : "Katalogda sotuvdagi gul yo'q"}
            options={items.map((it) => ({
              value: it.id,
              label: it.name_uz || it.name_ru,
              sub: `${Math.round(+it.price).toLocaleString("ru")} so'm · sotuvda: ${leftOf(it)} ta`,
              hint: `${leftOf(it)} ta`,
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
        <button type="button" onClick={add} className="icon-btn shrink-0 border" style={{ borderColor: "var(--border)" }} title="Katalog guli qo'shish" aria-label="Katalog guli qo'shish">
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </span>
      {rows.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <span key={r.item.id} className={chipCls} style={chipStyle}>
              🛍 {r.item.name_uz || r.item.name_ru} × {r.qty}
              <button
                type="button"
                onClick={() => onChange(rows.filter((x) => x.item.id !== r.item.id))}
                aria-label="Olib tashlash"
                className="opacity-60 transition-opacity hover:opacity-100"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          ))}
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
    const already = rows.find((r) => r.packaging === m.id)?.quantity ?? 0;
    if (already + n > m.quantity) return showToast(`Skladda yetarli emas: ${m.quantity} dona bor (${m.name_uz || m.name_ru})`);
    const i = rows.findIndex((r) => r.packaging === m.id);
    onChange(i >= 0 ? rows.map((r, j) => (j === i ? { ...r, quantity: r.quantity + n } : r)) : [...rows, { packaging: m.id, quantity: n }]);
    // qo'shilgach tanlov tozalanadi
    setPick(0);
    setQty("1");
  };

  // ko'rinadigan qoldiq: skladdagi − allaqachon qo'shilgani (jonli)
  const leftOf = (m: Packaging) => m.quantity - (rows.find((r) => r.packaging === m.id)?.quantity ?? 0);

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
              sub: `${PKG_TYPE[m.packaging_type] ?? m.packaging_type} · ${Math.round(+m.sale_price).toLocaleString("ru")} so'm · skladda: ${leftOf(m)} dona`,
              hint: `${leftOf(m)} dona`,
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
