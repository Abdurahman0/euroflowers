import type { ArrangementType, CatalogKind, CatalogVolume, FloristVolumeRate, MovementType, PackagingType, SalarySource, StaffType, StockBatch, VolumeRateInput } from "./types";

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
/** "6 pochka" (o'nlik bo'lsa .00 tashlanadi) */
export const bunches = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || Number.isNaN(v)) return "—";
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
  return `${s} pochka`;
};

/**
 * IKKI BIRLIKDA — "340 dona · 13.6 pochka". Pochka = dona / pochkadagi dona
 * (1-2 xona, ortiqcha nol tashlanadi). Butun ilova bo'ylab BITTA joydan
 * (batch gauge, harakatlar jurnali, kompozitsiya qoldiq maslahatlari, chiqit
 * oynasi) — birliklar bir xil ko'rinishi uchun.
 */
export const formatStemsAndBunches = (
  stemCount: number | string | null | undefined,
  stemsPerBunch: number | null | undefined
): string => {
  const v = typeof stemCount === "string" ? parseFloat(stemCount) : stemCount;
  if (v == null || Number.isNaN(v)) return "—";
  if (!stemsPerBunch || stemsPerBunch <= 0) return stems(v);
  return `${stems(v)} · ${bunches(v / stemsPerBunch)}`;
};

/* ===== yuborishdan oldin NORMALLASHTIRISH (katalog / social post) =====
   Bitta buket/savat = BITTA CatalogItem, ichida ko'p qatorli composition.
   Bir xil stock_batch (yoki packaging) qatorlari BITTAGA birlashtiriladi
   (miqdorlar qo'shiladi) — backend ham himoya uchun birlashtiradi, ammo biz
   ideal shaklni yuboramiz. */
export type CompEntry = { stock_batch: number; quantity_stems: number; quantity_bunches?: string };
export const normalizeComposition = (rows: CompEntry[]): CompEntry[] => {
  const map = new Map<number, CompEntry>();
  for (const r of rows) {
    if (!r.stock_batch) continue;
    const ex = map.get(r.stock_batch);
    if (ex) {
      ex.quantity_stems += r.quantity_stems || 0;
      if (r.quantity_bunches != null || ex.quantity_bunches != null) {
        const sum = (parseFloat(ex.quantity_bunches ?? "0") || 0) + (parseFloat(r.quantity_bunches ?? "0") || 0);
        ex.quantity_bunches = sum.toFixed(2);
      }
    } else {
      map.set(r.stock_batch, {
        stock_batch: r.stock_batch,
        quantity_stems: r.quantity_stems || 0,
        ...(r.quantity_bunches != null ? { quantity_bunches: r.quantity_bunches } : {}),
      });
    }
  }
  return Array.from(map.values());
};

export type MatEntry = { packaging: number; quantity: number };
export const normalizeMaterials = (rows: MatEntry[]): MatEntry[] => {
  const map = new Map<number, MatEntry>();
  for (const r of rows) {
    if (!r.packaging) continue;
    const ex = map.get(r.packaging);
    if (ex) ex.quantity += r.quantity || 0;
    else map.set(r.packaging, { packaging: r.packaging, quantity: r.quantity || 0 });
  }
  return Array.from(map.values());
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

/** HAJM — YAGONA manba. API qiymati DOIM shu (small/medium/large); UI faqat Uzbek
    yorliq ko'rsatadi. Matritsa/filtr/composer HAMMASI shundan kelib chiqadi —
    hech qayerda erkin "S"/"M"/"L" satr YOZILMAYDI (auto-to'ldirish jimgina buziladi). */
export const VOLUMES = ["small", "medium", "large"] as const;
export const ARRANGEMENTS = ["bouquet", "basket"] as const;
export const VOLUME_LABEL: Record<CatalogVolume, string> = { small: "Kichik", medium: "O'rta", large: "Katta" };
/** Qisqa yorliq (matritsa ustuni) — API qiymati emas, faqat ko'rsatish uchun. */
export const VOLUME_SHORT: Record<CatalogVolume, string> = { small: "S", medium: "M", large: "L" };
export const ARRANGEMENT_UZ: Record<(typeof ARRANGEMENTS)[number], string> = { bouquet: "Buket", basket: "Savat" };

/** Tarif ↔ katalog MOSLIGI — aynan satr-tenglik (volume + arrangement_type).
    Backend auto-to'ldirishi ham SHU tenglikni ishlatadi. `small !== "S"` — shuning
    uchun matritsa doim small/medium/large saqlaydi. Faol bo'lmagan tarif hisobga
    olinmaydi. */
export function volumeArrangementMatch(
  rate: Pick<FloristVolumeRate, "volume" | "arrangement_type" | "is_active">,
  volume: CatalogVolume | "" | null | undefined,
  arrangement: ArrangementType | "" | null | undefined,
): boolean {
  if (!volume || !arrangement) return false;
  return rate.is_active !== false && rate.volume === volume && rate.arrangement_type === arrangement;
}

/** Katalog uchun mos tarifni topadi (florist + hajm + turi). `florist` berilsa,
    faqat o'sha floristning tarifi olinadi (per-florist model). */
export function rateSalaryForCatalog(
  rates: FloristVolumeRate[] | null | undefined,
  florist: number | null | undefined,
  volume: CatalogVolume | "" | null | undefined,
  arrangement: ArrangementType | "" | null | undefined,
): FloristVolumeRate | undefined {
  if (!rates || !florist) return undefined;
  return rates.find((r) => r.florist === florist && volumeArrangementMatch(r, volume, arrangement));
}

/** ⚠️ NOM TUZOG'I xaritasi — YAGONA joy:
    tarifning `florist_fee` (florist ISH HAQI) → katalogning `florist_salary_amount`.
    Katalogning O'ZINING `florist_fee` (mijozdan xizmat haqi) bilan ARALASHTIRMANG. */
export const rateToCatalogSalary = (rate: FloristVolumeRate): string => String(Math.round(+rate.florist_fee));

/** Matritsa katagi (tahrirlanadigan holat). `fee` = florist ish haqi (rate.florist_fee). */
export type RateCell = { arrangement_type: (typeof ARRANGEMENTS)[number]; volume: CatalogVolume; fee: string; stems: string };
/** TO'LIQ ALMASHTIRISH payload — FAQAT to'ldirilgan kataklar (fee bor) yuboriladi.
    ⚠️ Yuborilmagan katak backend'da is_active:false bo'ladi (ataylab). Bo'sh grid → []
    (hammasi o'chadi — UI'da alohida tasdiq bilan himoyalanadi). Vitest bilan qamralgan. */
export function buildVolumeRatesPayload(cells: RateCell[]): VolumeRateInput[] {
  return cells
    .filter((c) => c.fee.trim() !== "")
    .map((c) => ({
      arrangement_type: c.arrangement_type,
      volume: c.volume,
      florist_fee: String(+c.fee),
      ...(c.stems.trim() !== "" ? { default_stems: +c.stems } : {}),
    }));
}

/** Katalog `florist_salary_amount` payload — ⚠️ ZERO qiymat, BO'SH EMAS.
    - "" / null  → kalit TUSHIRILADI (backend tarifdan avto-to'ldiradi, spec §4)
    - "0"        → "0" YUBORILADI (operator ataylab nol qildi — backend avto-to'ldirmasin)
    - boshqa     → son sifatida yuboriladi
    Falsy tekshiruv (`if (v)`) ISHLATILMAYDI — u ataylab "0" ni bo'shdek talqin qilardi. */
export function catalogSalaryPayload(value: string | null | undefined): { florist_salary_amount: string } | Record<string, never> {
  if (value === "" || value == null) return {};
  return { florist_salary_amount: String(+value) };
}
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
