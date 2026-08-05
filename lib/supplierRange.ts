import { dateBeforeParam, fmtLocalDate } from "./format";

/**
 * YETKAZIB BERUVCHI — SANA ORALIG'I.
 *
 * ⚠️ JONLI AUDIT (2026-08-05, GET + OpenAPI):
 *
 * | endpoint                  | oraliq bormi | qaysi maydon                    |
 * |---------------------------|--------------|----------------------------------|
 * | /api/suppliers/           | YO'Q         | — (jamilar BUTUN DAVR)           |
 * | /api/stock-batches/       | BOR          | `created_at_after/_before`       |
 * | /api/stock-movements/     | BOR          | `created_at_after/_before`       |
 * | /api/stock-deliveries/    | yo'q (oraliq)| faqat ANIQ kun `received_at=`    |
 * | /api/supplier-payments/   | yo'q (oraliq)| faqat ANIQ kun `paid_at=`        |
 *
 * ⚠️ PARTIYADAGI TUZOQ — `created_at` ≠ `received_at`. Ekranda KO'RINADIGAN sana
 * `received_at` (yuk sarlavhasi, partiya yangiligi), lekin server FAQAT `created_at`
 * (bazaga kiritilgan payt) bo'yicha filtrlaydi. Jonli ma'lumotda ular BOSHQA kun:
 * 27 ta partiya `received_at 2026-08-04`, `created_at 2026-08-05` — bir kun farq.
 * Ya'ni «02.08 — 04.08» so'ralganda server'ga `created_at` yuborilsa 27 ta partiya
 * JIMGINA yo'qolardi. Shuning uchun partiyalar `received_at` bo'yicha KLIENTDA
 * saralanadi (`inReceivedRange`) — serverdagi mos filtr YO'Q, taxmin qilinmaydi.
 *
 * ⚠️ `received_at_after` / `received_at_before` / `date_from` — server ularni
 * TANIMAYDI va JIMGINA hammasini qaytaradi (33 → 33). Shuning uchun ular
 * hech qachon yuborilmaydi: filtr ishlagandek ko'rinib, aslida ishlamasdi.
 */

export type DateRange = { from: string; to: string };

export const EMPTY_RANGE: DateRange = { from: "", to: "" };

export const hasRange = (r: DateRange): boolean => !!(r.from || r.to);

/** «YYYY-MM-DD» va oy/kun HAQIQIY oraliqda. ⚠️ Faqat shakl tekshirilsa `2026-13-99`
    o'tib ketib, ro'yxatni JIMGINA bo'shatardi. */
export const isYmd = (v: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return !!m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
};

/** URL → oraliq (`?date_from=&date_to=`). Buzuq qiymat E'TIBORGA OLINMAYDI. */
export function readRange(search: string): DateRange {
  const p = new URLSearchParams(search);
  const ok = (v: string | null) => (v && isYmd(v) ? v : "");
  const from = ok(p.get("date_from"));
  const to = ok(p.get("date_to"));
  // teskari kiritilgan oraliq (dan > gacha) — almashtiriladi, bo'sh ro'yxat ko'rsatilmaydi
  return from && to && from > to ? { from: to, to: from } : { from, to };
}

/** Oraliq → URL kalitlari (bo'shi UMUMAN yozilmaydi — «filtrsiz» sukut holati). */
export function rangeToParams(r: DateRange): Record<string, string> {
  const out: Record<string, string> = {};
  if (r.from) out.date_from = r.from;
  if (r.to) out.date_to = r.to;
  return out;
}

/**
 * SERVER filtri — FAQAT `created_at` bo'yicha ishlaydigan endpointlar uchun
 * (`/api/stock-movements/`). `date_to` INKLYUZIV ko'rinadi, shuning uchun
 * server'ga KEYINGI kun yuboriladi (loyihadagi yagona `dateBeforeParam` qoidasi).
 */
export function createdAtQuery(r: DateRange): Record<string, string> {
  const out: Record<string, string> = {};
  if (r.from) out.created_at_after = r.from;
  if (r.to) out.created_at_before = dateBeforeParam(r.to);
  return out;
}

/**
 * KLIENT filtri — `received_at` / `paid_at` (server oraliq bermaydi).
 * ⚠️ Satrlar YYYY-MM-DD bo'lgani uchun TO'G'RIDAN-TO'G'RI solishtiriladi;
 * `new Date()` orqali o'tkazilmaydi (brauzer mintaqasi kunni siljitardi).
 * Ikkala chek ham INKLYUZIV — foydalanuvchi tanlagan kunlar qamraladi.
 */
export function inDateRange(ymd: string | null | undefined, r: DateRange): boolean {
  if (!hasRange(r)) return true;
  const d = (ymd ?? "").slice(0, 10);
  if (!isYmd(d)) return true; // sanasiz/buzuq yozuv YASHIRILMAYDI
  if (r.from && d < r.from) return false;
  if (r.to && d > r.to) return false;
  return true;
}

/** «02.08.2026 — 05.08.2026» · «02.08.2026 dan» · «05.08.2026 gacha» · «Butun davr» */
export function rangeLabel(r: DateRange): string {
  if (r.from && r.to) return `${fmtLocalDate(r.from)} — ${fmtLocalDate(r.to)}`;
  if (r.from) return `${fmtLocalDate(r.from)} dan`;
  if (r.to) return `${fmtLocalDate(r.to)} gacha`;
  return "Butun davr";
}
