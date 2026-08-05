import type { CatalogItem } from "./types";

/**
 * RESTAVRATSIYA (catalog rework) — sof hisob qatlami.
 * Spec: FRONTEND_CATALOG_REWORK_API.md · jonli sxema: CatalogReworkCreate.
 *
 * ⚠️ ENG XAVFLI JOY — PER-DONA TUZOG'I: `composition[].quantity_stems` BITTA dona
 * uchun. `quantity: 2` va `quantity_stems: 25` → JAMI 50 dona. Operator aynan shu
 * raqamni noto'g'ri o'qiydi, shuning uchun UI ham «25 dona/dona → jami 50 dona» deb
 * yozadi va bu yerdagi hamma hisob ×quantity qiladi.
 */

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
};

/* ═══════════ QOLDIQ (app-wide) ═══════════ */

/**
 * ⚠️ KATALOG QOLDIG'I — YAGONA manba.
 *
 * Jonli server `quantity_remaining` ni O'ZI hisoblab beradi va restavratsiya
 * deploydan keyin `quantity_reworked` ham unga kiradi. Shu bois SERVER qiymati
 * AVTORITATIV; u kelmasa (eski javob / qisman obyekt) o'zimiz ayiramiz:
 *   total − sold − wasted − reworked
 *
 * ⚠️ Ilgari kod bazasida faqat `total − sold` hisoblanardi — ya'ni `quantity_wasted`
 * ALLAQACHON e'tiborsiz qolayotgan edi (jonli maydon bo'lsa ham). Bu funksiya shuni
 * ham tuzatadi.
 */
export function catalogRemaining(item: {
  quantity_total?: number | null;
  quantity_sold?: number | null;
  quantity_wasted?: number | null;
  quantity_reworked?: number | null;
  quantity_remaining?: number | null;
  status?: string;
} | null | undefined): number {
  if (!item) return 0;
  if (item.quantity_remaining != null) return Math.max(item.quantity_remaining, 0);
  const total = item.quantity_total ?? 1;
  const sold = item.quantity_sold ?? (item.status === "sold" ? total : 0);
  return Math.max(total - sold - (item.quantity_wasted ?? 0) - (item.quantity_reworked ?? 0), 0);
}

/** Kartochka qatori: «Jami 3 · Sotildi 1 · Restavratsiyada 1 · Qoldi 1» — nol qismlar tushiriladi. */
export function catalogCountsLabel(item: Parameters<typeof catalogRemaining>[0] & {
  quantity_total?: number | null; quantity_sold?: number | null;
  quantity_wasted?: number | null; quantity_reworked?: number | null;
} | null | undefined): string {
  if (!item) return "";
  const parts = [`Jami ${item.quantity_total ?? 1}`];
  if ((item.quantity_sold ?? 0) > 0) parts.push(`Sotildi ${item.quantity_sold}`);
  if ((item.quantity_reworked ?? 0) > 0) parts.push(`Restavratsiyada ${item.quantity_reworked}`);
  if ((item.quantity_wasted ?? 0) > 0) parts.push(`Chiqit ${item.quantity_wasted}`);
  parts.push(`Qoldi ${catalogRemaining(item)}`);
  return parts.join(" · ");
}

/**
 * ⚠️ «Skladdan yechish» KO'RSATILMAYDI — restavratsiya chiqimlari allaqachon
 * yechilgan holda tug'iladi (`quantity_stock_deducted = quantity_total`), bosilsa 400.
 */
export const stockAlreadyDeducted = (item: {
  quantity_total?: number | null; quantity_stock_deducted?: number | null;
} | null | undefined): boolean =>
  !!item && (item.quantity_stock_deducted ?? 0) >= (item.quantity_total ?? 1);

/* ═══════════ FORMA HOLATI ═══════════ */

export type ReworkSourceDraft = { catalog_item: number; quantity: number };
export type ReworkStockDraft = { stock_batch: number; quantity_stems: string };
export type ReworkCompDraft = { stock_batch: number; quantity_stems: string };
export type ReworkMatDraft = { packaging: number; quantity: string };
export type ReworkOutputDraft = {
  name_uz: string;
  arrangement_type: string;
  quantity: string;
  price: string;
  composition: ReworkCompDraft[];
  materials: ReworkMatDraft[];
  /** «Qo'shimcha» bo'limi — tegilmasa payload'ga TUSHMAYDI */
  volume: string;
  description_uz: string;
  note: string;
  height_cm: string;
  diameter_cm: string;
  image_url: string;
  status: string;
  branch: number;
  catalog_kind: string;
};

export const emptyOutput = (): ReworkOutputDraft => ({
  name_uz: "", arrangement_type: "bouquet", quantity: "1", price: "",
  composition: [], materials: [],
  volume: "", description_uz: "", note: "", height_cm: "", diameter_cm: "",
  image_url: "", status: "available", branch: 0, catalog_kind: "standard",
});

/* ═══════════ KIRIM / CHIQIM / YO'QOTISH ═══════════ */

/** Bitta katalog itemining BIR DONASIDAGI gul soni (o'z `composition`idan). */
export const itemStemsPerUnit = (item: Pick<CatalogItem, "composition"> | null | undefined): number =>
  (item?.composition ?? []).reduce((s, c) => s + (c?.quantity_stems ?? 0), 0);

/** Buziladigan kataloglardan keladigan gul: Σ(bir dona guli × nechta dona buziladi). */
export function sourceStems(sources: ReworkSourceDraft[], byId: Map<number, CatalogItem>): number {
  return sources.reduce((s, r) => s + itemStemsPerUnit(byId.get(r.catalog_item)) * Math.max(r.quantity, 0), 0);
}

/** Skladdan qo'shimcha olingan gul (aniq dona). */
export const stockStems = (rows: ReworkStockDraft[]): number =>
  rows.reduce((s, r) => s + Math.max(Math.round(n(r.quantity_stems)), 0), 0);

/** ⚠️ CHIQIM: Σ(tarkib guli × chiqim doni) — PER-DONA tuzog'i shu yerda hal bo'ladi. */
export const outputStems = (outputs: ReworkOutputDraft[]): number =>
  outputs.reduce((s, o) => {
    const per = o.composition.reduce((a, c) => a + Math.max(Math.round(n(c.quantity_stems)), 0), 0);
    return s + per * Math.max(Math.round(n(o.quantity)), 0);
  }, 0);

/** Bitta chiqimning JAMI guli (kartochkada «→ jami N dona» uchun). */
export const outputTotalStems = (o: ReworkOutputDraft): number =>
  o.composition.reduce((a, c) => a + Math.max(Math.round(n(c.quantity_stems)), 0), 0)
  * Math.max(Math.round(n(o.quantity)), 0);

/** Buziladigan kataloglarning tannarxi (bir dona tannarxi × dona). */
export function sourceCost(sources: ReworkSourceDraft[], byId: Map<number, CatalogItem>): number {
  return sources.reduce((s, r) => {
    const it = byId.get(r.catalog_item);
    const unit = n(it?.profit?.unit_cost) || n(it?.calculated_cost_price);
    return s + unit * Math.max(r.quantity, 0);
  }, 0);
}

/** Skladdan olingan gulning tannarxi (dona tannarxi × dona). */
export function stockCost(rows: ReworkStockDraft[], batchCost: (id: number) => number): number {
  return rows.reduce((s, r) => s + batchCost(r.stock_batch) * Math.max(Math.round(n(r.quantity_stems)), 0), 0);
}

/* ═══════════ PARTIYA BO'YICHA TEKSHIRUV ═══════════ */

export type BatchRow = {
  stock_batch: number;
  label: string;
  /** buzilgan kataloglardagi + skladdan olingan */
  available: number;
  /** barcha chiqimlarda kerak bo'ladigan */
  needed: number;
  short: number;
};

/**
 * ⚠️ HAR BIR PARTIYA uchun ALOHIDA: mavjud vs kerak.
 * Umumiy gul soni to'g'ri bo'lsa ham AYNAN bir partiya yetmasligi mumkin —
 * server ham shuni tekshiradi («EF-… guli yetmayapti: mavjud N, kerak M»).
 */
export function batchBalance(
  sources: ReworkSourceDraft[],
  stock: ReworkStockDraft[],
  outputs: ReworkOutputDraft[],
  byId: Map<number, CatalogItem>,
  batchLabel: (id: number) => string,
): BatchRow[] {
  const avail = new Map<number, number>();
  const add = (m: Map<number, number>, k: number, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const s of sources) {
    const it = byId.get(s.catalog_item);
    for (const c of it?.composition ?? []) {
      if (c?.stock_batch != null) add(avail, c.stock_batch, (c.quantity_stems ?? 0) * Math.max(s.quantity, 0));
    }
  }
  for (const r of stock) add(avail, r.stock_batch, Math.max(Math.round(n(r.quantity_stems)), 0));

  const need = new Map<number, number>();
  for (const o of outputs) {
    const q = Math.max(Math.round(n(o.quantity)), 0);
    for (const c of o.composition) {
      if (c.stock_batch > 0) add(need, c.stock_batch, Math.max(Math.round(n(c.quantity_stems)), 0) * q);
    }
  }
  const ids = Array.from(new Set(Array.from(avail.keys()).concat(Array.from(need.keys())))).filter((id) => id > 0);
  return ids.map((id) => {
    const available = avail.get(id) ?? 0;
    const needed = need.get(id) ?? 0;
    return { stock_batch: id, label: batchLabel(id), available, needed, short: Math.max(needed - available, 0) };
  }).sort((a, b) => b.short - a.short || b.needed - a.needed);
}

/* ═══════════ YAKUNIY TEKSHIRUV ═══════════ */

export type ReworkTotals = {
  sourceStems: number; stockStems: number; inputStems: number;
  outputStems: number; wasteStems: number;
  inputCost: number;
  batches: BatchRow[];
  shortBatches: BatchRow[];
  ok: boolean;
  /** BLOKLASH sababi — tugma jimgina o'chmaydi, sabab ko'rsatiladi */
  reason: string;
};

export function reworkTotals(args: {
  sources: ReworkSourceDraft[];
  stock: ReworkStockDraft[];
  outputs: ReworkOutputDraft[];
  florist: number;
  floristAmount: string;
  byId: Map<number, CatalogItem>;
  batchLabel: (id: number) => string;
  batchCost: (id: number) => number;
}): ReworkTotals {
  const { sources, stock, outputs, florist, floristAmount, byId, batchLabel, batchCost } = args;
  const src = sourceStems(sources, byId);
  const stk = stockStems(stock);
  const input = src + stk;
  const output = outputStems(outputs);
  const waste = input - output;
  const batches = batchBalance(sources, stock, outputs, byId, batchLabel);
  const shortBatches = batches.filter((b) => b.short > 0);
  const inputCost = sourceCost(sources, byId) + stockCost(stock, batchCost);

  let reason = "";
  if (!(florist > 0)) reason = "Floristni tanlang — kim ishlaganini yozish shart.";
  else if (n(floristAmount) < 0) reason = "Florist haqi manfiy bo'lmaydi";
  else if (sources.length === 0 && stock.length === 0) reason = "Kamida bitta buziladigan katalog yoki skladdan gul tanlang";
  else if (outputs.length === 0) reason = "Kamida bitta yangi mahsulot kiritilishi kerak";
  else {
    const bad = outputs.find((o) => !o.name_uz.trim());
    const noPrice = outputs.find((o) => !(n(o.price) > 0));
    const noComp = outputs.find((o) => o.composition.filter((c) => c.stock_batch > 0 && n(c.quantity_stems) > 0).length === 0);
    if (bad) reason = "Har bir yangi mahsulotga nom kiriting";
    else if (noPrice) reason = `«${noPrice.name_uz}» narxini kiriting`;
    else if (noComp) reason = `${noComp.name_uz} uchun gul tarkibi kiritilmagan`;
    else if (waste < 0) reason = "Yangi mahsulotlardagi gul soni kirimdan ko'p bo'lmasligi kerak";
    else if (shortBatches.length > 0) {
      const b = shortBatches[0];
      reason = `${b.label} guli yetmayapti: mavjud ${b.available} dona, kerak ${b.needed} dona`;
    }
  }
  return { sourceStems: src, stockStems: stk, inputStems: input, outputStems: output, wasteStems: waste, inputCost, batches, shortBatches, ok: reason === "", reason };
}

/* ═══════════ PAYLOAD ═══════════ */

/**
 * POST /api/catalog-reworks/ tanasi.
 * ⚠️ «Qo'shimcha» maydonlar TEGILMASA payload'ga UMUMAN tushmaydi (bizdagi qoida:
 * bo'sh satr / 0 yuborilmaydi). `composition[].quantity_stems` — PER DONA, o'zgarmaydi.
 */
export function buildReworkPayload(args: {
  florist: number; floristAmount: string; note: string;
  sources: ReworkSourceDraft[]; stock: ReworkStockDraft[]; outputs: ReworkOutputDraft[];
}): Record<string, unknown> {
  const { florist, floristAmount, note, sources, stock, outputs } = args;
  const p: Record<string, unknown> = { florist };
  const amt = Math.max(Math.round(n(floristAmount)), 0);
  if (amt > 0) p.florist_amount = String(amt);           // 0 → oylik yozuvi YARATILMAYDI
  if (note.trim()) p.note = note.trim();
  if (sources.length) p.sources = sources.filter((s) => s.catalog_item > 0)
    .map((s) => ({ catalog_item: s.catalog_item, quantity: Math.max(s.quantity, 1) }));
  if (stock.length) p.stock_inputs = stock.filter((r) => r.stock_batch > 0 && n(r.quantity_stems) > 0)
    .map((r) => ({ stock_batch: r.stock_batch, quantity_stems: Math.round(n(r.quantity_stems)) }));
  p.outputs = outputs.map((o) => {
    const out: Record<string, unknown> = {
      name_uz: o.name_uz.trim(),
      price: String(Math.round(n(o.price))),
      composition: o.composition.filter((c) => c.stock_batch > 0 && n(c.quantity_stems) > 0)
        .map((c) => ({ stock_batch: c.stock_batch, quantity_stems: Math.round(n(c.quantity_stems)) })),
    };
    const q = Math.max(Math.round(n(o.quantity)), 1);
    if (q !== 1) out.quantity = q;
    if (o.arrangement_type && o.arrangement_type !== "bouquet") out.arrangement_type = o.arrangement_type;
    const mats = o.materials.filter((m) => m.packaging > 0 && n(m.quantity) > 0)
      .map((m) => ({ packaging: m.packaging, quantity: Math.round(n(m.quantity)) }));
    if (mats.length) out.materials = mats;
    // «Qo'shimcha» — faqat to'ldirilganlari
    if (o.volume.trim()) out.volume = o.volume.trim();
    if (o.description_uz.trim()) out.description_uz = o.description_uz.trim();
    if (o.note.trim()) out.note = o.note.trim();
    if (n(o.height_cm) > 0) out.height_cm = Math.round(n(o.height_cm));
    if (n(o.diameter_cm) > 0) out.diameter_cm = Math.round(n(o.diameter_cm));
    if (o.image_url.trim()) out.image_url = o.image_url.trim();
    if (o.status && o.status !== "available") out.status = o.status;
    if (o.branch > 0) out.branch = o.branch;
    if (o.catalog_kind && o.catalog_kind !== "standard") out.catalog_kind = o.catalog_kind;
    return out;
  });
  return p;
}

/** «25 dona/dona → jami 50 dona» — spec eskizidagi AYNAN matn. */
export const perUnitLabel = (perUnit: number, quantity: number): string =>
  `${perUnit} dona/dona → jami ${perUnit * Math.max(quantity, 0)} dona`;
