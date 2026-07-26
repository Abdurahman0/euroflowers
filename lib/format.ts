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
