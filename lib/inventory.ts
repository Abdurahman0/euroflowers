import type { CatalogKind, CatalogVolume, MovementType, PackagingType, SalarySource, StaffType, StockBatch } from "./types";

/**
 * Sklad/florist bo'limlari uchun MARKAZLASHGAN o'zbekcha yorliqlar,
 * formatlagichlar va operatsion belgilar (freshness, stem gauge).
 * Barcha ranglar TEMA TOKENLARIDA — qattiq rang yo'q.
 */

/* ===== formatlash ===== */
const groups = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** "120 dona" */
export const stems = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return v == null || Number.isNaN(v) ? "—" : `${groups(v)} dona`;
};
/** "6 bog'lam" (o'nlik bo'lsa .00 tashlanadi) */
export const bunches = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || Number.isNaN(v)) return "—";
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
  return `${s} bog'lam`;
};

/* ===== enum yorliqlari ===== */
export const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: "Kirim",
  out: "Chiqim",
  adjustment: "Tuzatish",
  waste: "Chiqit",
  transfer_out: "Ko'chirish (chiqdi)",
  transfer_in: "Ko'chirish (keldi)",
};
/** harakat turkumi → tema-token rangi (ikonka/chip foni) */
export const MOVEMENT_HUE: Record<MovementType, string> = {
  in: "var(--success, #3d8a5f)",
  transfer_in: "var(--success, #3d8a5f)",
  out: "var(--primary)",
  transfer_out: "var(--primary)",
  waste: "var(--danger, #a04a4a)",
  adjustment: "var(--muted)",
};

export const PACKAGING_LABEL: Record<PackagingType, string> = {
  wrap: "Buket qog'ozi",
  basket: "Savat",
  box: "Quti",
  other: "Aksessuarlar",
  accessory: "Aksessuarlar",
};

export const STAFF_LABEL: Record<StaffType, string> = { florist: "Florist", apprentice: "Shogird" };
export const VOLUME_LABEL: Record<CatalogVolume, string> = { small: "Kichik", medium: "O'rta", large: "Katta" };
export const KIND_LABEL: Record<CatalogKind, string> = { standard: "Standart", custom: "Maxsus" };
export const SALARY_SOURCE_LABEL: Record<SalarySource, string> = {
  catalog: "Katalog",
  custom_catalog: "Maxsus katalog",
  daily: "Kunlik",
  manual: "Qo'lda",
};
export const SALARY_SOURCE_HUE: Record<SalarySource, string> = {
  catalog: "var(--primary)",
  custom_catalog: "#6a6ac2",
  daily: "#b3873a",
  manual: "#8a8a8a",
};

/* ===== freshness (yangilik) — gul eskiradi, operatsion muhim ===== */
export type Freshness = { days: number; label: string; hue: string };
export const freshness = (receivedAt?: string | null): Freshness => {
  if (!receivedAt) return { days: 0, label: "—", hue: "var(--muted)" };
  const d = new Date(receivedAt);
  if (Number.isNaN(d.getTime())) return { days: 0, label: "—", hue: "var(--muted)" };
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  const label = days === 0 ? "Bugun" : `${days} kunlik`;
  const hue = days <= 3 ? "#3d8a5f" : days <= 7 ? "#b3873a" : "#a04a4a";
  return { days, label, hue };
};

/* ===== stem gauge holati ===== */
export type GaugeState = { pct: number; hue: string; tone: "ok" | "low" | "empty" };
export const gaugeOf = (b: Pick<StockBatch, "remaining_stems" | "received_stems">): GaugeState => {
  const total = Math.max(b.received_stems || 0, 1);
  const pct = Math.max(0, Math.min(1, (b.remaining_stems || 0) / total));
  if (b.remaining_stems <= 0) return { pct: 0, hue: "var(--muted)", tone: "empty" };
  if (pct < 0.2) return { pct, hue: "#b3873a", tone: "low" }; // amber
  return { pct, hue: "var(--primary)", tone: "ok" };
};
