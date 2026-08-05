import { enumLabel } from "./enumLabel";
export const fmt = (n: number | string | null | undefined): string => {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(num)) return "—";
  return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
};

export const initials = (name: string): string =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

/**
 * ⚠️ SERVER YOZGAN VAQTNI AYNAN O'QISH — brauzer mintaqasidan QAT'I NAZAR.
 *
 * Backend `created_at` ni MAHALLIY vaqt sifatida `+05:00` bilan yuboradi
 * (masalan `2026-08-03T22:10:39.551452+05:00`). `new Date(iso).getHours()` esa
 * qiymatni BRAUZER mintaqasiga o'giradi — natijada:
 *   TZ=Asia/Tashkent → 03.08 · 22:10  ✓
 *   TZ=UTC           → 03.08 · 17:10  ✗
 *   TZ=Asia/Tokyo    → 04.08 · 02:10  ✗ KUN SILJIDI
 * Server allaqachon kerakli mintaqada yozgani uchun HECH QANDAY o'girish
 * kerak emas — satrning o'zidan o'qiymiz. Offsetsiz/buzuq satrda `null`.
 */
export function readIsoParts(iso: string | null | undefined):
  { y: number; mo: number; d: number; h: number; mi: number } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** "03.08 · 22:10" — server yozgan vaqt AYNAN (mintaqa o'girilmaydi). */
export const fmtLocalTime = (iso: string | null | undefined): string => {
  const p = readIsoParts(iso);
  if (!p) return iso ? fmtTime(iso) : "—"; // buzuq satr → eski yo'l (xavfsiz zaxira)
  return `${p2(p.d)}.${p2(p.mo)} · ${p2(p.h)}:${p2(p.mi)}`;
};

/** "03.08.2026" — server yozgan sana AYNAN. */
export const fmtLocalDate = (iso: string | null | undefined): string => {
  const p = readIsoParts(iso);
  if (!p) return iso ? fmtDate(iso) : "—";
  return `${p2(p.d)}.${p2(p.mo)}.${p.y}`;
};

/** ISO datetime → "13.07 · 14:05" (bugun bo'lsa faqat soat). */
export const fmtTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return hm;
  const dm = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${dm} · ${hm}`;
};

/** ISO date/datetime → "13.07.2026". */
export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

/** DateFilter → backend `created_at_after` qiymati (YYYY-MM-DD).
    Chip ko'rsatadigan oraliq bilan AYNAN bir xil: "7 kun" = bugun bilan 7 kun
    (bugun−6), "30 kun" = bugun−29 — bitta ortiqcha kun qo'shilmaydi. */
export const dateAfterParam = (filter: "bugun" | "hafta" | "oy"): string => {
  const d = new Date();
  if (filter === "hafta") d.setDate(d.getDate() - 6);
  if (filter === "oy") d.setDate(d.getDate() - 29);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Maxsus oraliq → {created_at_after, created_at_before} (before — keyingi kun,
    DRF "<" solishtiradi, "to" kuni ham qamrab olinadi). */
export const rangeParams = (r: { from: string; to: string }): { created_at_after: string; created_at_before: string } => {
  return { created_at_after: r.from, created_at_before: dateBeforeParam(r.to) };
};

/**
 * date_to uchun EKSKLYUZIV oxir. Backend `date_to=YYYY-MM-DD` ni kun BOSHIga
 * (00:00) deb oladi — ya'ni tanlangan kunni chiqarib tashlaydi (jonli tekshiruvda
 * tasdiqlangan). Tanlangan kunni to'liq qamrash uchun KEYINGI kun yuboriladi.
 */
export const dateBeforeParam = (ymdStr: string): string => {
  const d = new Date(ymdStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** ⚠️ ENDPOINT `date_to` ASIMMETRIYASI (backend HUJJATLASHTIRMAGAN — LIST 2 savoli):
 *  • /api/dashboard/ va /api/analytics/ `date_to` ni EKSKLYUZIV (kun BOSHI) deb oladi →
 *    foydalanuvchi tanlagan OXIRGI kun qamralishi uchun +1 kun yuboriladi.
 *  • /api/accounting/ `date_to` ni INKLYUZIV oladi → XOM (o'zgarishsiz) yuboriladi.
 *  Ikkalasi ham AYNAN bir foydalanuvchi oralig'ini qamraydi. Agar kimdir keyin bu +1 ni
 *  "tozalasa", dashboard oxirgi kun tushumini JIMGINA yo'qotadi (eski trailing-+1 bug oilasi)
 *  va hech narsa xato bermaydi — shuning uchun bu YAGONA joyda va Vitest bilan qulflangan. */
export const dashboardDateTo = (to?: string): string | undefined => (to ? dateBeforeParam(to) : undefined);
export const accountingDateTo = (to?: string): string | undefined => to;

/** ISO datetime → lokal "YYYY-MM-DDTHH:mm" (DatePicker withTime qiymati). */
export const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Sklad harakati lead'ga bog'liq bo'lsa — o'sha kanban kartasiga o'tish uchun ID
    (backend: reference_type="lead"; eski yozuvlar uchun sababdagi "Lead #N"). */
export const movementLeadId = (m: { reference_type?: string; reference_id?: number | null; reason?: string }): number | null => {
  if (m.reference_type === "lead" && m.reference_id) return m.reference_id;
  const hit = (m.reason ?? "").match(/Lead #(\d+)/);
  return hit ? +hit[1] : null;
};

/** Sklad harakatining MANBA yorlig'i (reference_type). `florist_issue` endi alohida —
    skladdan floristga chiqarish (katalog/sotuv chiqimidan farqli). Noma'lum turlar
    uchun null (xom satr KO'RSATILMAYDI). */
export const MOVEMENT_REF_LABEL: Record<string, string> = {
  florist_issue: "Floristga chiqarildi",
  florist_return: "Floristdan qaytdi",
  florist_waste: "Florist qo'lida chiqit",
  catalog_item: "Katalog",
  // ⚠️ RESTAVRATSIYA — skladdan QO'SHIMCHA olingan gul (buzilgan katalog guli uchun
  // harakat YARATILMAYDI — u allaqachon hisobdan chiqqan).
  catalog_rework: "Restavratsiya",
  lead: "Buyurtma",
};
/** ⚠️ NOMA'LUM `reference_type` — ilgari JIMGINA `null` qaytarardi va yangi tur
    (masalan `catalog_rework`) jurnalda ko'rinmay qolardi. Endi o'qiladigan yorliq
    beriladi va konsol BIR MARTA ogohlantiradi (§0d). */
export const movementRefLabel = (referenceType?: string | null): string | null =>
  referenceType ? enumLabel(MOVEMENT_REF_LABEL, referenceType, "sklad harakati manbasi (reference_type)") : null;

/** created_at date filtri: bugun / 7 kun / 30 kun. */
export const inDateFilter = (iso: string, filter: "bugun" | "hafta" | "oy"): boolean => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  const now = new Date();
  if (filter === "bugun") return d.toDateString() === now.toDateString();
  const days = filter === "hafta" ? 7 : 30;
  return now.getTime() - d.getTime() <= days * 86400000;
};

/** Nomdan slug yasaydi (backend `slug` maydonini talab qiladi).
    O'zbek/kirill harflari lotinga o'giriladi, bo'shliqlar "-" bo'ladi. */
// apostroflar/tinish belgilari oxirgi regex bilan olib tashlanadi — bu yerda faqat kirill
const SLUG_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "x", ц: "s", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
  э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};
export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .split("")
    .map((ch) => (ch in SLUG_MAP ? SLUG_MAP[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "gul";
