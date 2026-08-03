import type { BasketMaterial, MaterialReceiveInput, MaterialUnit, Packaging } from "./types";

/**
 * MATERIAL O'LCHOV BIRLIGI — YAGONA MANBA (§2).
 * Kirim formasi materialning `unit`iga qarab QAYTA QURILADI. Tarqoq if/else o'rniga
 * bitta konfiguratsiya xaritasi: maydon nomlari, yorliqlar va preview formulasi shu yerda.
 *
 *   piece (Lenta, Lak, qog'oz, savat) → { quantity, cost_price }   — cost_price 1 DONA narxi
 *   bunch (Gupka)                     → { bunches, cost_per_bunch } — backend hisoblaydi:
 *                                        quantity   = bunches × units_per_bunch
 *                                        cost_price = cost_per_bunch ÷ units_per_bunch
 *
 * ⚠️ Backend matematikani O'ZI bajaradi — biz faqat AYNAN shu hisobni oldindan ko'rsatamiz
 *    (ishonch uchun: operator nima yozilishini submit'dan oldin ko'radi).
 */

export const MATERIAL_UNIT_LABEL: Record<MaterialUnit, string> = { piece: "Dona", bunch: "Pochka" };

/** Savat materiali yorliqlari (backend BasketMaterialEnum) */
export const BASKET_MATERIAL_LABEL: Record<BasketMaterial, string> = {
  wooden: "Yog'ochli",
  plastic_handle: "Plastmassa ruchkali",
  woven: "To'qima",
};

/** Materialning birligi — yo'q bo'lsa `piece` (backend default; eski yozuvlar). */
export const unitOf = (m?: Pick<Packaging, "unit"> | null): MaterialUnit => (m?.unit === "bunch" ? "bunch" : "piece");

/** Bitta birlik uchun maydon konfiguratsiyasi — forma SHU asosda quriladi. */
export type UnitConfig = {
  unit: MaterialUnit;
  /** birlik yorlig'i ("Dona" / "Pochka") */
  label: string;
  /** miqdor inputining yorlig'i */
  qtyLabel: string;
  qtyPlaceholder: string;
  /** narx inputining yorlig'i */
  costLabel: string;
  costPlaceholder: string;
  /** bu birlik `units_per_bunch` ni talab qiladimi (bunch → ha) */
  needsUnitsPerBunch: boolean;
};

export const UNIT_CONFIG: Record<MaterialUnit, UnitConfig> = {
  piece: {
    unit: "piece",
    label: "Dona",
    qtyLabel: "Soni (dona)",
    qtyPlaceholder: "Masalan: 20",
    costLabel: "1 dona tannarxi (ixtiyoriy)",
    costPlaceholder: "Bo'sh — tannarx o'zgarmaydi",
    needsUnitsPerBunch: false,
  },
  bunch: {
    unit: "bunch",
    label: "Pochka",
    qtyLabel: "Soni (pochka)",
    qtyPlaceholder: "Masalan: 5",
    costLabel: "1 pochka tannarxi (ixtiyoriy)",
    costPlaceholder: "Bo'sh — tannarx o'zgarmaydi",
    needsUnitsPerBunch: true,
  },
};

export const configFor = (m?: Pick<Packaging, "unit"> | null): UnitConfig => UNIT_CONFIG[unitOf(m)];

/** Qoldiqni ikki birlikda ko'rsatish: bunch materialda "100 dona · 5 pochka", aks holda "100 dona". */
export function quantityDual(m: Pick<Packaging, "unit" | "units_per_bunch" | "quantity">): string {
  const qty = Math.max(Math.round(m.quantity ?? 0), 0);
  const upb = Math.round(+(m.units_per_bunch ?? 0) || 0);
  const base = `${qty.toLocaleString("ru")} dona`;
  if (unitOf(m) !== "bunch" || upb <= 1) return base;
  const bunches = qty / upb;
  // butun bo'lmasa bir xona (7.5 pochka) — yaxlitlab yolg'on ko'rsatmaymiz
  const b = Number.isInteger(bunches) ? String(bunches) : bunches.toFixed(1);
  return `${base} · ${b} pochka`;
}

/** Kirim preview — backend AYNAN nimani hisoblashini ko'rsatadi (derivatsiya yashirilmaydi). */
export type ReceivePreview =
  | { ok: false; reason: string }
  | {
      ok: true;
      unit: MaterialUnit;
      /** skladga qo'shiladigan DONA soni */
      quantity: number;
      /** 1 dona tannarxi (cost berilmasa null — tannarx o'zgarmaydi) */
      costPerPiece: number | null;
      /** shu kirimning jami summasi (cost berilmasa null) */
      total: number | null;
      /** bunch rejimida derivatsiya qatorlari ("5 pochka × 20 = 100 dona") */
      lines: string[];
      /** yangi qoldiq (joriy + quantity) */
      newQuantity: number;
    };

/**
 * Kirim preview'ini hisoblaydi. `qty` — piece'da dona, bunch'da POCHKA soni.
 * bunch materialda `units_per_bunch` bo'lmasa (yoki ≤1) — TAXMIN QILMAYMIZ, bloklaymiz.
 */
export function receivePreview(
  m: Pick<Packaging, "unit" | "units_per_bunch" | "quantity" | "cost_price"> | null | undefined,
  qty: string | number,
  cost: string | number | null | undefined,
): ReceivePreview {
  if (!m) return { ok: false, reason: "Materialni tanlang" };
  const unit = unitOf(m);
  const n = Math.floor(typeof qty === "string" ? parseFloat(qty) || 0 : qty || 0);
  if (n < 1) return { ok: false, reason: unit === "bunch" ? "Pochka soni kamida 1 bo'lishi kerak" : "Soni kamida 1 bo'lishi kerak" };
  const costStr = cost == null ? "" : String(cost).trim();
  const costNum = costStr === "" ? null : Math.round(+costStr || 0);
  const cur = Math.max(Math.round(m.quantity ?? 0), 0);

  if (unit === "piece") {
    return {
      ok: true, unit, quantity: n, costPerPiece: costNum,
      total: costNum == null ? null : costNum * n,
      lines: [], newQuantity: cur + n,
    };
  }

  const upb = Math.round(+(m.units_per_bunch ?? 0) || 0);
  // ⚠️ TAXMIN YO'Q — pochkada nechta dona borligini bilmasak, hisob yolg'on chiqadi.
  if (upb <= 1) {
    return {
      ok: false,
      reason: upb === 1
        ? "Bu materialda «1 pochka = 1 dona» turibdi — pochkadagi dona sonini (units_per_bunch) to'g'rilang"
        : "Bu materialda pochkadagi dona soni (units_per_bunch) belgilanmagan — avval uni to'ldiring",
    };
  }
  const quantity = n * upb;
  const costPerPiece = costNum == null ? null : Math.round(costNum / upb);
  const lines = [`${n} pochka × ${upb} = ${quantity.toLocaleString("ru")} dona`];
  if (costNum != null) lines.push(`${costNum.toLocaleString("ru")} ÷ ${upb} = ${(costPerPiece ?? 0).toLocaleString("ru")} so'm/dona`);
  return {
    ok: true, unit, quantity, costPerPiece,
    total: costNum == null ? null : costNum * n,
    lines, newQuantity: cur + quantity,
  };
}

/** Preview'dan server payload'i — YAGONA joy (forma qayta hisoblamaydi). */
export function buildReceivePayload(v: {
  packaging: number;
  material: Pick<Packaging, "unit" | "units_per_bunch" | "quantity" | "cost_price"> | null | undefined;
  qty: string | number;
  cost?: string | number | null;
  reason?: string;
}): { ok: true; req: MaterialReceiveInput } | { ok: false; reason: string } {
  if (!v.packaging) return { ok: false, reason: "Materialni tanlang" };
  const p = receivePreview(v.material, v.qty, v.cost);
  if (!p.ok) return { ok: false, reason: p.reason };
  const costStr = v.cost == null ? "" : String(v.cost).trim();
  const n = Math.floor(typeof v.qty === "string" ? parseFloat(v.qty) || 0 : v.qty || 0);
  const req: MaterialReceiveInput = { packaging: v.packaging };
  if (p.unit === "bunch") {
    req.bunches = n;
    if (costStr !== "") req.cost_per_bunch = String(+costStr); // "0" ham yuboriladi (0≠bo'sh)
  } else {
    req.quantity = n;
    if (costStr !== "") req.cost_price = String(+costStr);
  }
  if (v.reason && v.reason.trim()) req.reason = v.reason.trim();
  return { ok: true, req };
}

/* ═══════════════════════════════════════════════════════════════════════════
   §5 SARFLANADIGAN MATERIALLAR — katalog/sotuv tanlagichlaridan CHIQARIB TASHLASH
   ═══════════════════════════════════════════════════════════════════════════
   Gupka / Lenta / Lak FAQAT kirim uchun — ular buketga «qo'shiladigan» material emas.

   ⚠️ QOIDA nomga EMAS, MA'LUMOTGA asoslangan: `packaging_type === "other"`.
   Jonli ma'lumot (2026-08-02) tekshiruvi:
     • wrap   → Flizilin, Kalka, Tuman, Setka   (katalogda ISHLATILADI)
     • basket → 15 ta savat (yog'ochli/plastmassa/to'qima × XS…XL) (ISHLATILADI)
     • box    → (hozircha bo'sh)                 (ISHLATILADI)
     • other  → Gupka, Lenta, Lak — AYNAN uchala sarflanadigan material
   Ya'ni "other" = sarflanadiganlar to'plami; wrap/basket/box esa ishlatiladiganlar.

   RAD ETILGAN muqobillar (jonli ma'lumotda ishonchsiz):
     • sale_price === 0 → HAMMA materialda 0 (savatlar ham) — hech nimani ajratmaydi;
     • unit === "bunch" → faqat Gupka'ni tutadi, Lenta/Lak o'tib ketadi;
     • nom bo'yicha ro'yxat → yangi sarflanadigan qo'shilsa jimgina buziladi.

   ⚠️ BACKEND SO'ROVI: aniq `is_sellable` / `usable_in_catalog` bayrog'i kerak
   (MATERIALS_GAPS.md GAP 5). Yangi sarflanadigan material "other"dan boshqa turga
   qo'yilsa — bu evristika buziladi. Shu bayroq kelganda SHU FUNKSIYA o'zgartiriladi,
   chaqiruvchilar (kompozitor + sotuv) tegilmaydi. */
export const isConsumableOnly = (m: Pick<Packaging, "packaging_type">): boolean => m.packaging_type === "other";

/** Katalog/sotuvda ISHLATILADIGAN materiallar (sarflanadiganlarsiz). */
export const usableInCatalog = <T extends Pick<Packaging, "packaging_type">>(list: T[]): T[] => list.filter((m) => !isConsumableOnly(m));

/** Tannarx 0 qilinmoqdami — ogohlantirish uchun (katalog tannarxi retroaktiv siljiydi). */
export const receiveZeroCost = (cost: string | number | null | undefined): boolean => {
  const s = cost == null ? "" : String(cost).trim();
  return s !== "" && (+s || 0) === 0;
};
