import { backdateIso, isFutureDate } from "./backdate";
import type { ExpenseSummary } from "./types";

/**
 * RASXODLAR — sof mantiq (filtr quruvchi, sana qoidasi, summa o'qish).
 *
 * ⚠️ ENG MUHIM: ro'yxat VA yig'indi AYNAN bir xil filtrni oladi. Aks holda
 * kartochkalar jadvalda ko'rinmayotgan narsani tasvirlab qoladi — bu shu sahifaning
 * klassik nosozligi. Shu bois BITTA quruvchi (`buildExpenseQuery`) ikkalasiga xizmat qiladi.
 */

/** ⚠️ `amount` STRING decimal ("150000.00") — taqqoslash DOIM raqamda. */
export const expenseNum = (v: string | number | null | undefined): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const EXPENSE_PAGE_SIZE = 20;
export const EXPENSE_PAGE_SIZE_MAX = 100;

export type ExpenseFilters = {
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  createdBy?: string;
  minAmount?: string;
  maxAmount?: string;
  search?: string;
  ordering?: string;
  page?: number;
  pageSize?: number;
};

export const EXPENSE_ORDERING_DEFAULT = "-spent_at";

/**
 * SERVER so'rovi. `forSummary` — yig'indi endpointi sahifalashni bilmaydi, shuning uchun
 * `page`/`page_size` TUSHIRILADI; qolgan HAMMA filtr AYNAN bir xil ketadi.
 */
export function buildExpenseQuery(f: ExpenseFilters, forSummary = false): Record<string, string | number> {
  const q: Record<string, string | number> = {};
  if (f.dateFrom) q.date_from = f.dateFrom;
  if (f.dateTo) q.date_to = f.dateTo;
  if (f.paymentMethod) q.payment_method = f.paymentMethod;
  if (f.createdBy) q.created_by = f.createdBy;
  // ⚠️ summa oralig'i — RAQAM sifatida tekshiriladi, bo'sh satr yuborilmaydi
  const mn = (f.minAmount ?? "").trim();
  if (mn !== "" && Number.isFinite(+mn)) q.min_amount = +mn;
  const mx = (f.maxAmount ?? "").trim();
  if (mx !== "" && Number.isFinite(+mx)) q.max_amount = +mx;
  const s = (f.search ?? "").trim();
  if (s) q.search = s;
  if (f.ordering && f.ordering !== EXPENSE_ORDERING_DEFAULT) q.ordering = f.ordering;
  if (!forSummary) {
    if (f.page && f.page > 1) q.page = f.page;
    q.page_size = Math.min(Math.max(f.pageSize ?? EXPENSE_PAGE_SIZE, 1), EXPENSE_PAGE_SIZE_MAX);
  }
  return q;
}

/** URL'da saqlanadigan ko'rinish (bo'shlari tushiriladi). */
export function expenseFiltersToParams(f: ExpenseFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.dateFrom) p.date_from = f.dateFrom;
  if (f.dateTo) p.date_to = f.dateTo;
  if (f.paymentMethod) p.pm = f.paymentMethod;
  if (f.createdBy) p.by = f.createdBy;
  if ((f.minAmount ?? "").trim()) p.min = f.minAmount!.trim();
  if ((f.maxAmount ?? "").trim()) p.max = f.maxAmount!.trim();
  if ((f.search ?? "").trim()) p.q = f.search!.trim();
  if (f.ordering && f.ordering !== EXPENSE_ORDERING_DEFAULT) p.ordering = f.ordering;
  if (f.page && f.page > 1) p.page = String(f.page);
  return p;
}

export const expensePageCount = (count: number, pageSize: number): number =>
  pageSize > 0 ? Math.max(Math.ceil(count / pageSize), 1) : 1;

/**
 * ⚠️ SANA QOIDASI — KATALOG/CHIQIMDAN BOSHQACHA.
 * Spec ANIQ aytadi: maydon BO'SH qolsa `spent_at` UMUMAN yuborilmaydi va backend
 * hozirgi vaqtni qo'yadi. Ya'ni bu yerda `new Date()` YUBORILMAYDI — boshqa
 * formalardagi «bugun» sukutini KO'R-KO'RONA takrorlamang.
 * Sana tanlansa: `YYYY-MM-DDT00:00:00+05:00` (faqat sana bo'lsa yarim tundan).
 */
export function spentAtPayload(ymd: string | null | undefined, now = Date.now()): Record<string, string> {
  const v = (ymd ?? "").trim();
  if (v === "") return {};                       // ⚠️ BO'SH → kalit YO'Q
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return {}; // buzuq → yubormaymiz
  if (isFutureDate(v, now)) return {};           // kelajak → klient himoyasi
  const iso = backdateIso(v, now);
  if (!iso) return {};
  // backdateIso o'tgan kunga 12:00 qo'yadi; spec esa yarim tunni so'raydi
  return { spent_at: `${v}T00:00:00+05:00` };
}

/** ⚠️ `by_day` ENG YANGI KUN BIRINCHI keladi — grafik uchun XRONOLOGIK tartib kerak. */
export const byDayChronological = <T extends { date: string }>(rows: T[] | null | undefined): T[] =>
  [...(rows ?? [])].sort((a, b) => a.date.localeCompare(b.date));

/* ═══════════ KALENDAR ═══════════ */

export type CalView = "oy" | "hafta" | "kun" | "royxat";

const pad = (n: number) => String(n).padStart(2, "0");
/** YYYY-MM-DD — mahalliy komponentlardan (UTC o'girish YO'Q). */
export const ymd = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

/**
 * ⚠️ MAHALLIY SANA — `spent_at` `+05:00` bilan keladi va uni `new Date()` orqali
 * o'qish brauzer mintaqasiga o'girib KUNNI SILJITADI (22:10 → ertasi kun).
 * Satrning O'ZIDAN kesib olamiz — bu `fmtLocalTime` bilan bir xil qoida.
 */
export const spentDate = (iso: string | null | undefined): string => (iso ?? "").slice(0, 10);
/** "HH:MM" — xuddi shunday, satrdan. */
export const spentTime = (iso: string | null | undefined): string => (iso ?? "").slice(11, 16);

/** Dushanbadan boshlanadigan hafta (Du=0 … Yak=6). */
const mondayIndex = (jsDay: number) => (jsDay + 6) % 7;

/**
 * KO'RINIB TURGAN ORALIQ — kalendar to'ridagi BIRINCHI va OXIRGI katakcha.
 * ⚠️ Oyning o'zi emas: qo'shni oylarning kunlari ham to'rda ko'rinadi, shuning uchun
 * so'rov ularni ham qamrashi kerak (aks holda 27–31 kataklari bo'sh chiqadi).
 */
export function visibleRange(year: number, month0: number, view: CalView, anchorDay = 1):
  { from: string; to: string; days: string[] } {
  if (view === "kun") {
    const d = ymd(year, month0, anchorDay);
    return { from: d, to: d, days: [d] };
  }
  if (view === "hafta") {
    const base = new Date(Date.UTC(year, month0, anchorDay));
    base.setUTCDate(base.getUTCDate() - mondayIndex(base.getUTCDay()));
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base); d.setUTCDate(base.getUTCDate() + i);
      return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    });
    return { from: days[0], to: days[6], days };
  }
  // OY — to'liq haftalarga to'ldirilgan to'r (6 qator × 7 = 42 katak emas, kerakligicha)
  const first = new Date(Date.UTC(year, month0, 1));
  const start = new Date(first);
  start.setUTCDate(1 - mondayIndex(first.getUTCDay()));
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month0, lastDay));
  const end = new Date(last);
  end.setUTCDate(lastDay + (6 - mondayIndex(last.getUTCDay())));
  const days: string[] = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return { from: days[0], to: days[days.length - 1], days };
}

/** Oyning o'zi (Oylik jami uchun — to'r oralig'i EMAS). */
export function monthRange(year: number, month0: number): { from: string; to: string } {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return { from: ymd(year, month0, 1), to: ymd(year, month0, lastDay) };
}

/**
 * ⚠️ KATAKLARGA GURUHLASH — `spent_at` ning MAHALLIY sana qismi bo'yicha.
 * 23:30 va 00:30 yozuvlari o'z kunida qolishi SHART (UTC o'girilsa siljirdi).
 */
export function groupByDay<T extends { spent_at: string }>(rows: T[]): Record<string, T[]> {
  const g: Record<string, T[]> = {};
  for (const r of rows) {
    const k = spentDate(r.spent_at);
    if (!k) continue;
    (g[k] ??= []).push(r);
  }
  // kun ichida vaqt bo'yicha
  for (const k of Object.keys(g)) g[k].sort((a, b) => (a.spent_at < b.spent_at ? -1 : 1));
  return g;
}

/** Kun jami — server bermasa shu yerdan (spec ruxsat beradi). */
export const dayTotal = <T extends { amount: string }>(rows: T[] | undefined): number =>
  (rows ?? []).reduce((s, r) => s + expenseNum(r.amount), 0);

/**
 * ⚠️ SANA QOIDASI — uchta holat (spec §3.2):
 *  · [+] dan ochilgan, sanaga TEGILMAGAN → kalit UMUMAN yuborilmaydi
 *  · kun katakchasidan ochilgan → o'sha kun ANIQ yuboriladi
 *  · vaqt tanlangan bo'lsa — o'sha vaqt bilan
 */
export function quickAddSpentAt(dayYmd: string | null, timeHm: string | null): Record<string, string> {
  const d = (dayYmd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return {};   // tegilmagan → KALIT YO'Q
  const t = (timeHm ?? "").trim();
  const hm = /^\d{2}:\d{2}$/.test(t) ? t : "00:00";
  return { spent_at: `${d}T${hm}:00+05:00` };
}

/** To'lov usuli nuqtasi — spec belgilagan uchta rang (bizda token ekvivalenti yo'q). */
export const PAYMENT_DOT: Record<string, string> = {
  cash: "#22c55e",      // yashil
  card: "#3b82f6",      // ko'k
  transfer: "#8b5cf6",  // binafsha
};

export const MONTHS_UZ = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
export const WEEKDAYS_UZ = ["Du","Se","Chor","Pay","Ju","Sha","Yak"];

/** Kartochkalar — server bergani AYNAN, qayta hisoblanmaydi. */
export function expenseTotalsView(s: ExpenseSummary | null | undefined) {
  return {
    count: s?.totals?.expense_count ?? 0,
    total: expenseNum(s?.totals?.total),
    average: expenseNum(s?.totals?.average),
  };
}

/** POST/PATCH payload. Faqat o'zgargan kalitlar (tahrirda) — `orig` berilsa. */
export type ExpenseForm = {
  amount: string;
  destination: string;
  payment_method: string;
  spent_at: string; // "YYYY-MM-DD" yoki bo'sh
  note: string;
};

export type ExpenseValidation = { ok: boolean; errors: Record<string, string> };

/** Klient tekshiruvi — SERVER qoidasi bilan bir xil (amount > 0, destination bo'sh emas). */
export function validateExpense(f: ExpenseForm): ExpenseValidation {
  const errors: Record<string, string> = {};
  const amt = expenseNum(f.amount);
  if (!(amt > 0)) errors.amount = "Summa noldan katta bo'lishi kerak";
  if (!(f.destination ?? "").trim()) errors.destination = "Pul qayerga ketganini yozing";
  return { ok: Object.keys(errors).length === 0, errors };
}

export function buildExpensePayload(f: ExpenseForm, now = Date.now()): Record<string, unknown> {
  return {
    amount: String(expenseNum(f.amount)),
    destination: f.destination.trim(),
    ...(f.payment_method ? { payment_method: f.payment_method } : {}),
    ...((f.note ?? "").trim() ? { note: f.note.trim() } : {}),
    ...spentAtPayload(f.spent_at, now),
  };
}

/** TAHRIR — FAQAT o'zgargan kalitlar (bizdagi PATCH intizomi). */
export function buildExpenseEditPayload(
  orig: { amount?: string; destination?: string; payment_method?: string; note?: string; spent_at?: string },
  f: ExpenseForm,
  now = Date.now(),
): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (expenseNum(f.amount) !== expenseNum(orig.amount)) p.amount = String(expenseNum(f.amount));
  if (f.destination.trim() !== (orig.destination ?? "")) p.destination = f.destination.trim();
  if (f.payment_method && f.payment_method !== orig.payment_method) p.payment_method = f.payment_method;
  if ((f.note ?? "").trim() !== (orig.note ?? "")) p.note = f.note.trim();
  // sana — faqat KUN o'zgarsa (soat/daqiqa taqqoslanmaydi)
  const origYmd = (orig.spent_at ?? "").slice(0, 10);
  const nextYmd = (f.spent_at ?? "").trim();
  if (nextYmd && nextYmd !== origYmd) Object.assign(p, spentAtPayload(nextYmd, now));
  return p;
}
