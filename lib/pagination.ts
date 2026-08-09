import type { Paginated } from "./types";

/**
 * SAHIFALASH — YAGONA manba (spec: FRONTEND_PAGINATION_TOTALS_API.md, 09.08.2026).
 *
 * ⚠️ NEGA BITTA JOYDA: ilgari har ro'yxat o'zicha yig'ardi — kimdir hamma
 * sahifani aylanib chiqib `results.length` ni «jami» deb ko'rsatardi, kimdir
 * 500 qatorda to'xtab qolganini bilmasdi ham (audit jurnali: 2482 dan 500 tasi
 * ko'rinib, sarlavhada «500» deb turardi). Endi qoida bitta joyda.
 */

/** Sukut sahifa hajmi (spec: server sukuti ham 30). */
export const DEFAULT_PAGE_SIZE = 30;
/** ⚠️ SERVER SHIFTI — 200 dan katta so'ralsa server baribir 200 qaytaradi (jonli tekshirildi). */
export const MAX_PAGE_SIZE = 200;
/** Tanlagichdagi variantlar. */
export const PAGE_SIZE_OPTIONS = [30, 50, 100, 200] as const;

/**
 * ⚠️ FAQAT tanlagich (dropdown/select) va EKSPORT uchun.
 * Katta jadvallarga (`/api/catalog/`, `/api/stock-movements/`) ISHLATMANG — spec
 * buni ochiq taqiqlaydi. Sabab: florist qoldig'i tanlagichi 30 tada jimgina
 * kesilib qolar edi va operator qolganini umuman ko'rmasdi.
 */
export const ALL_PAGE_SIZE = "all";

/** Sahifa raqamini xavfsiz o'qish — 1 dan kichik yoki buzuq bo'lsa 1. */
export const clampPage = (v: unknown): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

/** Sahifa hajmini chegaraga soladi. `all` o'zgarmaydi. */
export const clampPageSize = (v: unknown): number | typeof ALL_PAGE_SIZE => {
  if (v === ALL_PAGE_SIZE || v === "0" || v === 0 || v === -1) return ALL_PAGE_SIZE;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
};

/* ===== SAHIFA HOLATI ===== */

export type PageState = { page: number; pageSize: number | typeof ALL_PAGE_SIZE };

export const readPageState = (search: string, fallbackSize: number = DEFAULT_PAGE_SIZE): PageState => {
  const p = new URLSearchParams(search);
  const rawSize = p.get("page_size");
  return {
    page: clampPage(p.get("page") ?? 1),
    pageSize: rawSize == null ? clampPageSize(fallbackSize) : clampPageSize(rawSize),
  };
};

/** URL'ga yoziladigan kalitlar — sukut qiymatlar YOZILMAYDI (havola toza qoladi). */
export const pageStateToParams = (s: PageState, fallbackSize: number = DEFAULT_PAGE_SIZE): Record<string, string> => {
  const out: Record<string, string> = {};
  if (s.page > 1) out.page = String(s.page);
  if (s.pageSize !== fallbackSize) out.page_size = String(s.pageSize);
  return out;
};

/**
 * ⚠️ FILTR O'ZGARSA SAHIFA 1 GA QAYTADI.
 * Aks holda 5-sahifada turib filtrni torraytirsak, server bo'sh sahifa qaytaradi
 * va ekran «hech narsa topilmadi» deb turadi — aslida natija BOR, biz shunchaki
 * mavjud bo'lmagan sahifani so'ragan bo'lamiz.
 */
export const resetPageOnFilterChange = <F extends Record<string, unknown>>(prev: F, next: F, cur: PageState): PageState => {
  const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
  for (const k of keys) if (String(prev[k] ?? "") !== String(next[k] ?? "")) return { ...cur, page: 1 };
  return cur;
};

/** So'rov parametrlari — filtrlar + sahifa. Bo'sh qiymatlar TUSHIRILADI. */
export const buildListQuery = (
  filters: Record<string, unknown>,
  s: PageState,
): Record<string, string | number> => {
  const q: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    q[k] = typeof v === "number" ? v : String(v);
  }
  q.page_size = s.pageSize === ALL_PAGE_SIZE ? ALL_PAGE_SIZE : s.pageSize;
  if (s.pageSize !== ALL_PAGE_SIZE && s.page > 1) q.page = s.page;
  return q;
};

/* ===== SAHIFA MA'LUMOTI ===== */

export type PageInfo = {
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  count: number;
  /** shu sahifada nechta qator ko'rinyapti */
  shown: number;
  /** «31–60 / 154» uchun */
  from: number;
  to: number;
};

/**
 * ⚠️ SERVER RAQAMLARI USTUN. `total_pages` / `has_next` serverdan kelsa AYNAN
 * o'sha ishlatiladi; kelmasa (eski javob) ehtiyot chorasi sifatida hisoblanadi.
 * Hech qachon `next` havolasi tahlil qilinmaydi.
 */
export const readPageInfo = <T,>(body: Paginated<T> | null | undefined, req: PageState): PageInfo => {
  const count = Number(body?.count ?? 0) || 0;
  const shown = body?.results?.length ?? 0;
  const size = Number(body?.page_size) || (req.pageSize === ALL_PAGE_SIZE ? shown || count : req.pageSize) || DEFAULT_PAGE_SIZE;
  const page = Number(body?.page) || (req.pageSize === ALL_PAGE_SIZE ? 1 : req.page);
  const totalPages = body?.total_pages != null
    ? Number(body.total_pages) || 1
    : Math.max(1, Math.ceil(count / Math.max(size, 1)));
  const hasNext = body?.has_next != null ? !!body.has_next : page < totalPages;
  const hasPrevious = body?.has_previous != null ? !!body.has_previous : page > 1;
  const from = count === 0 ? 0 : (page - 1) * size + 1;
  return { page, pageSize: size, totalPages, hasNext, hasPrevious, count, shown, from, to: count === 0 ? 0 : from + shown - 1 };
};

/**
 * Sahifa tugmalari: 1 … 4 5 [6] 7 8 … 20 (joriy atrofida `span` ta).
 * `-1` — «…» ajratgichi.
 */
export const pageNumbers = (current: number, total: number, span = 1): number[] => {
  if (total <= 1) return [1];
  const out: number[] = [];
  const push = (n: number) => { if (out[out.length - 1] !== n) out.push(n); };
  const lo = Math.max(2, current - span);
  const hi = Math.min(total - 1, current + span);
  push(1);
  if (lo > 2) push(-1);
  for (let i = lo; i <= hi; i++) push(i);
  if (hi < total - 1) push(-1);
  if (total > 1) push(total);
  return out;
};

/* ===== JAMILAR ===== */

/**
 * ⚠️ JAMI — `totals` yoki `count` DAN, HECH QACHON `results.length` DAN EMAS.
 * Ekrandagi qatorlar soni «jami» EMAS: sahifalangan ro'yxatda u har doim
 * page_size dan oshmaydi va foydalanuvchiga yolg'on raqam ko'rsatadi.
 */
export const totalOf = <T,>(body: Paginated<T> | null | undefined, totalsKey?: string): number => {
  if (totalsKey) {
    const v = body?.totals?.[totalsKey];
    if (v != null && Number.isFinite(Number(v))) return Number(v);
  }
  return Number(body?.count ?? 0) || 0;
};

/** `totals` dan SON o'qish — yo'q bo'lsa 0 (spec: faqat mavjud kalitlar keladi). */
export const totalsNum = (totals: Record<string, unknown> | undefined | null, key: string): number => {
  const v = totals?.[key];
  return v == null || !Number.isFinite(Number(v)) ? 0 : Number(v);
};

/** ⚠️ Pul STRING bo'lib keladi — Number() shu yerda, bir joyda. */
export const totalsMoney = (totals: Record<string, unknown> | undefined | null, key: string): number => totalsNum(totals, key);

/**
 * `by_status` / `by_type` / `by_kind` — FAQAT mavjud kalitlar bo'ladi.
 * ⚠️ `?? 0` shu yerda: chaqiruvchi `by_status.archived` deb yozsa, bitta ham
 * arxiv yo'q kunda `undefined` chiqib ekranda «NaN» ko'rinardi.
 */
export const countMapOf = (totals: Record<string, unknown> | undefined | null, key: string): Record<string, number> => {
  const raw = totals?.[key];
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = Number(v) || 0;
  return out;
};

/** `by_source` — {count, amount}; amount STRING → number. */
export const sourceMapOf = (
  totals: Record<string, unknown> | undefined | null,
  key: string,
): Record<string, { count: number; amount: number }> => {
  const raw = totals?.[key];
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, { count: number; amount: number }> = {};
  for (const [k, v] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    out[k] = { count: Number(v?.count) || 0, amount: Number(v?.amount) || 0 };
  }
  return out;
};

/** Bitta kalitni `?? 0` bilan o'qish (chaqiruvchi qulayligi uchun). */
export const mapCount = (m: Record<string, number>, key: string): number => m[key] ?? 0;
