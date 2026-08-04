import type { CatalogSaleRow, CatalogSalesTotals } from "./types";

/**
 * KATALOG SOTUV TARIXI — sof mantiq (so'rov quruvchi, chegirma qatori, jamilar).
 *
 * ⚠️ BU RO'YXAT HISOB-KITOBGA QARSHI EMAS — jonli tekshiruvda AYNAN teng chiqdi:
 *     /api/catalog/sales/          totals.revenue = 7 430 000  (20 sotuv)
 *     /api/accounting/?branch=main total_sales    = 7 430 000  (20 sotuv)
 *     /api/dashboard/  period_catalog_sales_revenue = 7 430 000
 * Filtrsiz `/api/accounting/` esa 11 645 000 beradi — ortiqcha 25 qator BUTUNLAY
 * «Parkent filiali»niki. Ya'ni bu endpoint O'Z FILIALI bilan chegaralangan
 * (xuddi `/api/catalog/` kabi), tannarx/foyda esa umuman yo'q.
 */

/** ⚠️ Pul maydonlari STRING ham, NUMBER ham kelishi mumkin (jonli javob aralash). */
export const saleNum = (v: string | number | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : parseFloat(v) || 0;

/** Spec: `page_size` eng ko'pi 100. */
export const SALES_PAGE_SIZE_MAX = 100;
export const SALES_PAGE_SIZE = 25;

export type SalesFilters = {
  dateFrom?: string;
  dateTo?: string;
  /** "" = hammasi; cash | card | debt | unknown */
  payment?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

/**
 * SERVER so'rovi — hamma filtr serverda, klientda kesish YO'Q (ro'yxat cheksiz o'sadi).
 * Bo'sh qiymatlar UMUMAN qo'shilmaydi (bo'sh satr yuborilmaydi).
 */
export function buildSalesQuery(f: SalesFilters): Record<string, string | number> {
  const q: Record<string, string | number> = {};
  if (f.dateFrom) q.date_from = f.dateFrom;
  if (f.dateTo) q.date_to = f.dateTo;
  if (f.payment) q.payment_type = f.payment;
  const s = (f.search ?? "").trim();
  if (s) q.search = s;
  if (f.page && f.page > 1) q.page = f.page;
  q.page_size = Math.min(Math.max(f.pageSize ?? SALES_PAGE_SIZE, 1), SALES_PAGE_SIZE_MAX);
  return q;
}

/** URL'ga yoziladigan ko'rinish (bo'shlari tushiriladi) — chuqur havola + yangilashda saqlanadi. */
export function salesFiltersToParams(f: SalesFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.dateFrom) p.date_from = f.dateFrom;
  if (f.dateTo) p.date_to = f.dateTo;
  if (f.payment) p.payment = f.payment;
  const s = (f.search ?? "").trim();
  if (s) p.q = s;
  if (f.page && f.page > 1) p.page = String(f.page);
  return p;
}

/** Sahifalar soni — `count` va `page_size` dan. */
export const salesPageCount = (count: number, pageSize: number): number =>
  pageSize > 0 ? Math.max(Math.ceil(count / pageSize), 1) : 1;

/** Chegirmali qatormi — FAQAT `discount_amount > 0` bo'lganda chizib ko'rsatiladi. */
export const isDiscounted = (r: Pick<CatalogSaleRow, "discount_amount">): boolean =>
  saleNum(r.discount_amount) > 0;

/**
 * Chegirma qatori ko'rinishi: ~~asl~~ **haqiqiy** · «sabab».
 * Chegirma bo'lmasa `listed` null — chizilgan narx UMUMAN chiqmaydi.
 */
export function discountView(r: CatalogSaleRow): { listed: number | null; sold: number; reason: string } {
  const disc = isDiscounted(r);
  return {
    listed: disc ? saleNum(r.listed_total) : null,
    sold: saleNum(r.sale_total),
    reason: disc ? (r.discount_reason ?? "").trim() : "",
  };
}

/** To'lov turi filtri — spec'dagi to'rt qiymat + «hammasi». */
export const PAYMENT_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "To'lov: hammasi" },
  { value: "cash", label: "Naqd" },
  { value: "card", label: "Karta" },
  { value: "debt", label: "Qarz" },
  // ⚠️ Server bu qiymatni hozircha TANIMAYDI (filtrsiz qaytaradi) — UI ogohlantiradi.
  { value: "mixed", label: "Aralash" },
  { value: "unknown", label: "Aniqlanmagan" },
];

/** Sarlavha jamilari — server bergani AYNAN (qayta hisoblanmaydi). */
export function totalsView(t: CatalogSalesTotals | null | undefined) {
  return {
    count: t?.sales_count ?? 0,
    quantity: t?.quantity ?? 0,
    revenue: saleNum(t?.revenue),
    discount: saleNum(t?.discount_total),
    cash: saleNum(t?.cash_total),
    card: saleNum(t?.card_total),
    debt: saleNum(t?.debt_total),
  };
}
