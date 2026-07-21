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

/** DateFilter → backend `created_at_after` qiymati (YYYY-MM-DD). */
export const dateAfterParam = (filter: "bugun" | "hafta" | "oy"): string => {
  const d = new Date();
  if (filter === "hafta") d.setDate(d.getDate() - 7);
  if (filter === "oy") d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Maxsus oraliq → {created_at_after, created_at_before} (before — keyingi kun,
    DRF "<" solishtiradi, "to" kuni ham qamrab olinadi). */
export const rangeParams = (r: { from: string; to: string }): { created_at_after: string; created_at_before: string } => {
  const d = new Date(r.to + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const before = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { created_at_after: r.from, created_at_before: before };
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
