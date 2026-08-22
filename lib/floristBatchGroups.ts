import { batchTitleNoHeight } from "@/lib/stockLabel";
import type { StockBatch } from "@/lib/types";

/**
 * FLORISTGA GUL CHIQARISHDA PARTIYALARNI GURUHLASH.
 *
 * ⚠️ MUAMMO: bir xil gul bir necha marta kelgan bo'lsa, tanlagichda har partiya ALOHIDA
 *    variant bo'lib turardi (jonli: «Hojiakbar · Atirgul 50 sm» — 3 ta qator). Operator
 *    uchun bu BITTA gul; qaysi partiyadan yechilishi sklad ishi.
 *
 * ⚠️ GURUH KALITI — UCHALASI ham bir xil bo'lsagina birlashadi (so'rov):
 *      postavshik (supplier id) + gul turi (variant id) + bo'yi (height_cm)
 *    «Gul turi» — tanlagichda ko'rinadigan gul + NAVI (masalan «Atirgul · Prut · Oq»):
 *    variant id shuni bildiradi. Turli nav/rang BIRLASHMAYDI — tannarxi ham, ko'rinishi
 *    ham boshqa.
 *
 * ⚠️ TAQSIMOT — ESKI (FIFO): eng OLDIN kelgan partiyadan boshlab yechiladi (gul buziladigan
 *    tovar), hech bir partiyaning qoldig'idan OSHMAYDI. Backend baribir har partiyani
 *    alohida tekshiradi (bulk-issue all-or-nothing).
 */
export type BatchGroup = {
  /** `${supplier}|${variant}|${height_cm}` — tanlagich qiymati */
  key: string;
  label: string;
  supplierName: string;
  heightLabel: string;
  /** guruhdagi barcha partiyalar qoldig'i (dona) */
  remainingStems: number;
  /** FIFO tartibida (eski → yangi) */
  items: StockBatch[];
  /**
   * Pochkadagi dona — FAQAT barcha partiyalarda BIR XIL bo'lsa. Har xil bo'lsa `null`:
   * bunda «pochka» hisobi ikki ma'noli bo'lardi, shuning uchun faqat DONA bilan ishlanadi.
   */
  stemsPerBunch: number | null;
  /** eng arzon/eng qimmat dona tannarxi (ko'rsatish uchun) */
  costMin: number;
  costMax: number;
};

const num = (v: unknown): number => (v == null || v === "" ? 0 : Number(v) || 0);
const supplierIdOf = (b: StockBatch): number | string =>
  (b as { supplier?: number | null }).supplier ?? b.supplier_detail?.id ?? "";
export const supplierNameOf = (b: StockBatch): string => b.supplier_detail?.name ?? "";

/** ⚠️ FIFO: eski kirim oldin (received_at → id). Sana teng bo'lsa kichik id oldin. */
const fifo = (a: StockBatch, b: StockBatch): number =>
  String(a.received_at ?? "").localeCompare(String(b.received_at ?? "")) || a.id - b.id;

export const groupKeyOf = (b: StockBatch): string =>
  `${supplierIdOf(b)}|${b.variant ?? ""}|${b.height_cm ?? ""}`;

export function groupBatchesForIssue(batches: StockBatch[]): BatchGroup[] {
  const map = new Map<string, StockBatch[]>();
  for (const b of batches) {
    // ⚠️ TUGAGAN partiya guruhga ham kirmaydi — undan chiqarib bo'lmaydi
    if ((b.remaining_stems ?? 0) <= 0) continue;
    const key = groupKeyOf(b);
    const cur = map.get(key);
    if (cur) cur.push(b);
    else map.set(key, [b]);
  }
  const out: BatchGroup[] = [];
  // ⚠️ Map iteratsiyasi YO'Q — tsconfig target ES5 (downlevelIteration o'chirilgan)
  map.forEach((list, key) => {
    const items = [...list].sort(fifo);
    const first = items[0];
    const spbSet = new Set(items.map((b) => b.stems_per_bunch || 1));
    const costs = items.map((b) => Math.round(num(b.cost_per_stem)));
    out.push({
      key,
      label: `${batchTitleNoHeight(first, "")}${first.height_label ? ` · ${first.height_label}` : ""}`,
      supplierName: supplierNameOf(first),
      heightLabel: first.height_label ?? (first.height_cm ? `${first.height_cm} sm` : ""),
      remainingStems: items.reduce((s, b) => s + (b.remaining_stems ?? 0), 0),
      items,
      stemsPerBunch: spbSet.size === 1 ? (items[0].stems_per_bunch || 1) : null,
      costMin: Math.min(...costs),
      costMax: Math.max(...costs),
    });
  });
  // gul nomi bo'yicha (tanlagichdagi tartib avvalgidek)
  return out.sort((a, b) => a.label.localeCompare(b.label) || a.supplierName.localeCompare(b.supplierName));
}

/**
 * Tanlangan donani guruh partiyalari bo'ylab taqsimlaydi (FIFO).
 * Qoldiq yetmasa — TO'LDIRILGANI qaytariladi (chaqiruvchi oldindan tekshiradi);
 * hech bir qatorda partiya qoldig'idan oshmaydi.
 */
export function allocateStems(items: StockBatch[], stems: number): { batch: number; quantity_stems: number }[] {
  let left = Math.max(Math.floor(stems), 0);
  const out: { batch: number; quantity_stems: number }[] = [];
  for (const b of [...items].sort(fifo)) {
    if (left <= 0) break;
    const take = Math.min(b.remaining_stems ?? 0, left);
    if (take > 0) { out.push({ batch: b.id, quantity_stems: take }); left -= take; }
  }
  return out;
}

/** Bir nechta qator bitta partiyaga tushsa — BITTA qatorga jamlanadi (server takrorni kutmaydi). */
export function mergeAllocations(rows: { batch: number; quantity_stems: number }[]): { batch: number; quantity_stems: number }[] {
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.batch, (map.get(r.batch) ?? 0) + r.quantity_stems);
  const out: { batch: number; quantity_stems: number }[] = [];
  map.forEach((quantity_stems, batch) => out.push({ batch, quantity_stems }));
  return out;
}
