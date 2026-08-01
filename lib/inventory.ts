import type { ArrangementType, CatalogKind, CatalogVolume, FloristVolumeRate, MovementType, PackagingType, RoundingSide, SalarySource, StaffType, StockBatch, StockDelivery, VolumeRateInput } from "./types";

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

/* ===== YUK (delivery) — MARKAZLASHGAN o'zbekcha yorliqlar =====
   ⚠️ "Partiya" = StockBatch (backend xatolari ham shunday ataydi) — o'zgarmaydi.
   Yuk = partiyalarni guruhlaydigan yozuv. Yorliqlar SHU YERDA, literal sifatida sochilmaydi.
   ⚠️ Yuk `number` TAKRORLANADI — yorliqda DOIM sana bilan birga ko'rsatiladi (ikki "7" ni ajratish). */
export const DELIVERY = {
  one: "Yuk",
  many: "Yuklar",
  neu: "Yangi yuk",
  addFlower: "Gul qo'shish",
  colNumber: "Yuk",
  supplierWord: "Postavshik",
  /** "Yuk 7 · 01.08.2026" */
  label: (number: string, dateLabel: string) => `Yuk ${number} · ${dateLabel}`,
  /** "Yuk 7 · 01.08.2026 · Golland Flowers" (detalь/read-only satr) */
  labelFull: (number: string, dateLabel: string, supplier?: string | null) =>
    `Yuk ${number} · ${dateLabel}${supplier ? ` · ${supplier}` : ""}`,
} as const;

/** MATERIAL YUKI — markazlashgan yorliqlar. Gul "Yuk"idan ALOHIDA so'z ("Partiya" = StockBatch). */
export const MATERIAL_DELIVERY = {
  one: "Material yuki",
  many: "Material yuklari",
  neu: "Yangi material yuki",
  receive: "Material kiritish",
  colNumber: "Yuk",
  supplierWord: "Postavshik",
  lastSupplier: "Oxirgi postavshik",
  /** "Material yuki M-1 · 01.08.2026" */
  label: (number: string, dateLabel: string) => `Material yuki ${number} · ${dateLabel}`,
  labelFull: (number: string, dateLabel: string, supplier?: string | null) =>
    `Material yuki ${number} · ${dateLabel}${supplier ? ` · ${supplier}` : ""}`,
} as const;

/* ===== MATERIAL KIRITISH (receive) — sof mantiq (UI'dan mustaqil, testlanadi) =====
   ⚠️ cost_price: bo'sh/null → kalit TUSHIRILADI (materialning tannarxi o'zgarmaydi); "0" → "0"
   YUBORILADI (operator ataylab nol qildi). Falsy tekshiruv ISHLATILMAYDI (zero ≠ bo'sh).
   quantity min 1 (0 rad etiladi). */
export type MaterialReceiveReq = { packaging: number; quantity: number; cost_price?: string; reason?: string };
export function buildMaterialReceivePayload(v: { packaging: number; quantity: number | string; costPrice?: string | null; reason?: string }):
  { ok: true; req: MaterialReceiveReq } | { ok: false; reason: string } {
  if (!v.packaging) return { ok: false, reason: "Materialni tanlang" };
  const q = Math.floor(typeof v.quantity === "string" ? parseFloat(v.quantity) || 0 : v.quantity || 0);
  if (q < 1) return { ok: false, reason: "Soni kamida 1 bo'lishi kerak" };
  const req: MaterialReceiveReq = { packaging: v.packaging, quantity: q };
  if (v.costPrice != null && v.costPrice !== "") req.cost_price = String(+v.costPrice); // "0" → "0" ketadi
  if (v.reason && v.reason.trim()) req.reason = v.reason.trim();
  return { ok: true, req };
}
/** typed "0" tannarx — LOUD ogohlantirish (nol tannarx katalog tannarxini kam ko'rsatadi). */
export const receiveZeroCost = (costPrice?: string | null): boolean => costPrice != null && costPrice !== "" && +costPrice === 0;

/** Partiya optioniga QISQA yuk konteksti — "Yuk 7 · 01.08" (ikki o'xshash partiyani ajratish).
    delivery_detail.received_at "2026-08-01" → "01.08". Yuk bo'lmasa bo'sh string. */
export const batchDeliveryTag = (dd?: { number: string; received_at: string } | null): string => {
  if (!dd) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dd.received_at || "");
  const date = m ? `${m[3]}.${m[2]}` : "";
  return `${DELIVERY.one} ${dd.number}${date ? ` · ${date}` : ""}`;
};

/* ===== POCHKA → DONA NARXI (yaxlitlash) — server bilan AYNAN bir xil bo'lishi shart =====
   Qoida (spec): dona narxi = round(pochka narxi / pochkadagi dona / 100) * 100.
   AVVAL bo'lamiz (pochka/dona), KEYIN 100 ga yaxlitlaymiz (round-then-divide EMAS).
   Yarmi va undan yuqorisi tepaga (Math.round musbatlarda half-up). 50 dan past → 0. */
export const exactPerStem = (bunchPrice: number, stemsPerBunch: number): number =>
  !stemsPerBunch || stemsPerBunch <= 0 ? 0 : bunchPrice / stemsPerBunch;

export const roundToHundred = (n: number): number => Math.round(n / 100) * 100;

/** Pochka narxidan yaxlitlangan dona narxi (server saqlaydigan qiymat). */
export const perStemFromBunch = (bunchPrice: number, stemsPerBunch: number): number =>
  roundToHundred(exactPerStem(bunchPrice, stemsPerBunch));

/** Yaxlitlash dona narxni O'ZGARTIRDIMI — formada "(yaxlitlandi, aniq hisob 998)" izohi uchun.
    exact butun bo'lmasa ham (masalan 998.4) taqqoslash aniq: exactRounded ≠ rounded. */
export const roundingNote = (bunchPrice: number, stemsPerBunch: number): { rounded: number; exact: number; changed: boolean; zeroed: boolean } => {
  const exact = exactPerStem(bunchPrice, stemsPerBunch);
  const rounded = roundToHundred(exact);
  return { rounded, exact, changed: Math.round(exact) !== rounded, zeroed: bunchPrice > 0 && rounded === 0 };
};

/* ===== SAQLANGAN PARTIYA — server `rounding` bloki (DISPLAY-ONLY) =====
   ⚠️ SAQLANGAN partiya narxini KO'RSATISH server blokidan chiqadi — farqni O'ZIMIZ hisoblamaymiz,
   exact'ni hisobga ULAMAYMIZ. (Forma preview'i ayri: u round(bunch/stems/100)*100 client helper'idan.) */
const num2 = (n: number) => n.toLocaleString("ru", { maximumFractionDigits: 2 });
/** "(aniq: 998 · +2)" — FAQAT is_rounded=true bo'lganda (aks holda null → ko'rsatma). Server sonlari. */
export const roundingHint = (side?: RoundingSide | null): string | null => {
  if (!side || !side.is_rounded) return null;
  const sign = side.per_stem_diff > 0 ? "+" : "";
  return `aniq: ${num2(side.per_stem_exact)} · ${sign}${num2(side.per_stem_diff)}`;
};
/** Yuk sarlavhasi uchun: "aniq hisob: 99 800 · yaxlitlashdan +200" — FAQAT rounding_diff ≠ 0 bo'lganda. */
export const deliveryRoundingHint = (d: Pick<StockDelivery, "total_cost_exact" | "rounding_diff">): string | null => {
  if (!d.rounding_diff) return null;
  const sign = d.rounding_diff > 0 ? "+" : "";
  return `aniq hisob: ${num2(d.total_cost_exact ?? 0)} · yaxlitlashdan ${sign}${num2(d.rounding_diff)}`;
};

/* ===== PARTIYA (StockBatch) PAYLOAD — yuk-bog'langan holat + pochka/dona narx qoidasi =====
   ⚠️ NARX: pochka qiymati ASOSIY; dona qiymati FAQAT operator qo'lda kiritganda yuboriladi.
   Ikkalasi ham yuborilsa server hech narsa hisoblamaydi (ataylab override). Standart: pochka only.
   ⚠️ YUK-bog'langanda batch_number/received_at/supplier YUBORILMAYDI — ular yukdan olinadi. */
export type BatchPayloadInput = {
  variant: number;
  heightCm: number;
  stemsPerBunch: number;
  /** yuk (delivery) id — berilsa batch_number/received_at/supplier TASHLANADI */
  deliveryId?: number | null;
  /** faqat yuk-bog'lanmagan holatda */
  supplier?: number | null;
  batchNumber?: string;
  receivedAt?: string;
  /** miqdor — faqat BITTASI (pochka yoki dona) */
  receivedBunches?: number | null;
  receivedStems?: number | null;
  /** narx — pochka asosiy; dona faqat override bo'lganda */
  costPerBunch?: string | null;
  costPerStem?: string | null; // qo'lda override
  salePerBunch?: string | null;
  salePerStem?: string | null; // qo'lda override
  minimumSaleStems?: number | null;
  imageUrl?: string | null;
};
export function buildBatchPayload(v: BatchPayloadInput): Record<string, unknown> {
  const p: Record<string, unknown> = { variant: v.variant, height_cm: v.heightCm, stems_per_bunch: v.stemsPerBunch };
  if (v.deliveryId) {
    p.delivery = v.deliveryId;
    // batch_number / received_at / supplier ATAYLAB yuborilmaydi — yukdan olinadi
  } else {
    if (v.batchNumber) p.batch_number = v.batchNumber;
    if (v.receivedAt) p.received_at = v.receivedAt.slice(0, 10);
    if (v.supplier) p.supplier = v.supplier;
  }
  if (v.receivedBunches != null) p.received_bunches = v.receivedBunches.toFixed(2);
  else if (v.receivedStems != null) p.received_stems = v.receivedStems;
  // narx: yuborilganini qo'yamiz — ikkalasi bo'lsa (override) ikkalasi ketadi, aks holda pochka only
  if (v.costPerBunch) p.cost_per_bunch = v.costPerBunch;
  if (v.costPerStem) p.cost_per_stem = v.costPerStem;
  if (v.salePerBunch) p.sale_price_per_bunch = v.salePerBunch;
  if (v.salePerStem) p.sale_price_per_stem = v.salePerStem;
  if (v.minimumSaleStems) p.minimum_sale_stems = v.minimumSaleStems;
  if (v.imageUrl) p.image_url = v.imageUrl;
  return p;
}

/* ===== PARTIYA TAHRIRLASH (PATCH) — FAQAT O'ZGARGAN maydonlar =====
   ⚠️ To'liq-obyekt ustiga yozish EMAS: tegilmagan maydon QAYTA YUBORILMAYDI (user-branch
   payload'i bilan bir xil intizom). Narx qoidasi create bilan bir xil: pochka asosiy;
   dona narxi FAQAT «qo'lda kiritish» (manual) da yuboriladi — override bo'lsa ikkalasi ham. */
export type BatchEditForm = {
  batch_number: string;
  received_at: string; // "YYYY-MM-DD"
  height_cm: string;
  stems_per_bunch: string;
  minimum_sale_stems: string;
  notes: string;
  image_url: string;
  cost_per_bunch: string;
  sale_price_per_bunch: string;
  cost_per_stem: string; // override qiymati
  sale_price_per_stem: string; // override qiymati
  costManual: boolean;
  saleManual: boolean;
};
export type BatchEditOriginal = {
  batch_number?: string; received_at?: string; height_cm?: number; stems_per_bunch?: number;
  minimum_sale_stems?: number; notes?: string; image_url?: string;
  cost_per_bunch?: string; sale_price_per_bunch?: string; cost_per_stem?: string; sale_price_per_stem?: string;
};
const numEq = (a: string, b: string | number | undefined | null): boolean =>
  (parseFloat(a) || 0) === (b == null ? 0 : typeof b === "string" ? (parseFloat(b) || 0) : b);
function addPriceEdit(p: Record<string, unknown>, kind: "cost" | "sale", manual: boolean, bunch: string, stem: string, origBunch?: string, origStem?: string) {
  const bunchKey = kind === "cost" ? "cost_per_bunch" : "sale_price_per_bunch";
  const stemKey = kind === "cost" ? "cost_per_stem" : "sale_price_per_stem";
  const bunchChanged = bunch.trim() !== "" && !numEq(bunch, origBunch);
  if (manual) {
    // OVERRIDE — dona narxi o'zgargan bo'lsa yuboriladi; pochka ham o'zgargan bo'lsa u ham (ikkalasi knowingly)
    if (stem.trim() !== "" && !numEq(stem, origStem)) p[stemKey] = String(+stem);
    if (bunchChanged) p[bunchKey] = String(+bunch);
  } else if (bunchChanged) {
    // AVTO — faqat pochka narxi (server dona narxini qayta hisoblaydi); dona YUBORILMAYDI
    p[bunchKey] = String(+bunch);
  }
}
export function buildBatchEditPayload(orig: BatchEditOriginal, form: BatchEditForm): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (form.batch_number.trim() !== (orig.batch_number ?? "")) p.batch_number = form.batch_number.trim();
  const origDate = (orig.received_at ?? "").slice(0, 10);
  if (form.received_at && form.received_at.slice(0, 10) !== origDate) p.received_at = form.received_at.slice(0, 10);
  if (+form.height_cm > 0 && +form.height_cm !== orig.height_cm) p.height_cm = +form.height_cm;
  if (+form.stems_per_bunch > 0 && +form.stems_per_bunch !== orig.stems_per_bunch) p.stems_per_bunch = +form.stems_per_bunch;
  if (+form.minimum_sale_stems > 0 && +form.minimum_sale_stems !== orig.minimum_sale_stems) p.minimum_sale_stems = +form.minimum_sale_stems;
  if (form.notes !== (orig.notes ?? "")) p.notes = form.notes;
  if (form.image_url !== (orig.image_url ?? "")) p.image_url = form.image_url;
  addPriceEdit(p, "cost", form.costManual, form.cost_per_bunch, form.cost_per_stem, orig.cost_per_bunch, orig.cost_per_stem);
  addPriceEdit(p, "sale", form.saleManual, form.sale_price_per_bunch, form.sale_price_per_stem, orig.sale_price_per_bunch, orig.sale_price_per_stem);
  return p;
}
/** RETROAKTIV o'zgarish bormi — tannarx/pochka-dona bo'linishi (avval yasalgan kataloglar tannarxiga ta'sir). */
export const batchEditIsRetroactive = (payload: Record<string, unknown>): boolean =>
  "cost_per_bunch" in payload || "cost_per_stem" in payload || "stems_per_bunch" in payload;

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
