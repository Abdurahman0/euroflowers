/**
 * ARALASH TO'LOV (naqd + karta) — sof mantiq.
 *
 * ⚠️ TAQQOSLASH SUMMASI = CHEGIRMADAN KEYINGI tovar jami (`sale_price × quantity`)
 * + DASTAFKA. E'lon narxi EMAS. Sotuv oynasida: `mixedTarget(calc.totalSum, delivery)`.
 *
 * ⚠️ `mixed` va `debt` BIRGA BO'LMAYDI — `payment_type` bitta enum qiymat
 * (OpenAPI: cash | card | debt | mixed), shuning uchun ular tanlagichda
 * o'zaro istisno.
 */

/**
 * Pul satridan raqam. Formatlangan satr TAQQOSLANMAYDI — doim shu yerda songa o'giriladi.
 *
 * ⚠️ ONLIK NUQTA SAQLANADI: server `payment_breakdown` ni decimal satr sifatida beradi
 * ("150000.00"). Nuqtani ham tashlab yuborsak 150 000 → 15 000 000 bo'lib ketardi.
 * Operator kiritmasi esa bo'sh joy bilan keladi ("150 000") — u ham to'g'ri o'qiladi.
 */
export const parseMoney = (v: string | number | null | undefined): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : 0;
  const cleaned = String(v).replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** Mingliklar ajratilgan ko'rinish ("1500000" → "1 500 000"). Bo'sh → bo'sh. */
export const formatMoneyInput = (v: string | number | null | undefined): string => {
  const n = parseMoney(v);
  return n === 0 && (v === "" || v == null) ? "" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export type MixedState = {
  /** xom (formatlangan) kiritmalar */
  cash: string;
  card: string;
  /** operator maydonni QO'LDA tahrirladimi — avtomatik to'ldirish shundan keyin TO'XTAYDI */
  cashTouched: boolean;
  cardTouched: boolean;
};

export const emptyMixed: MixedState = { cash: "", card: "", cashTouched: false, cardTouched: false };

/**
 * BITTA maydon o'zgarganda — ikkinchisini QOLDIQ bilan to'ldirish.
 *
 * Qoidalar (spec + operatorga qarshi ishlamasligi uchun):
 *  · avtomatik to'ldirish FAQAT ikkinchi maydon hali QO'LDA tegilmagan bo'lsa;
 *  · MANFIY qoldiq hech qachon yozilmaydi — 0 ga qisiladi va nomuvofiqlik ko'rsatiladi;
 *  · tahrirlangan maydonning o'zi HECH QACHON qayta yozilmaydi.
 */
export function applyMixedEdit(
  prev: MixedState, field: "cash" | "card", raw: string, total: number,
): MixedState {
  const value = formatMoneyInput(raw);
  const entered = parseMoney(value);
  const next: MixedState = { ...prev, [field]: value, [`${field}Touched`]: true } as MixedState;
  const other = field === "cash" ? "card" : "cash";
  const otherTouched = field === "cash" ? prev.cardTouched : prev.cashTouched;
  // ikkinchisi QO'LDA tegilgan bo'lsa — tegmaymiz (operator bilan urishmaymiz)
  if (otherTouched) return next;
  const remainder = Math.max(total - entered, 0); // ⚠️ manfiy qoldiq YOZILMAYDI
  return { ...next, [other]: remainder > 0 ? formatMoneyInput(remainder) : "" } as MixedState;
}

/**
 * JAMI o'zgarganda (dona / chegirma tahrirlandi) — FAQAT tegilmagan maydonni qayta hisoblash.
 * Ikkalasi ham tegilgan bo'lsa hech narsa o'zgarmaydi (nomuvofiqlik ko'rsatiladi).
 */
export function recalcOnTotalChange(prev: MixedState, total: number): MixedState {
  if (prev.cashTouched && prev.cardTouched) return prev;
  if (prev.cashTouched && !prev.cardTouched) {
    const rem = Math.max(total - parseMoney(prev.cash), 0);
    return { ...prev, card: rem > 0 ? formatMoneyInput(rem) : "" };
  }
  if (prev.cardTouched && !prev.cashTouched) {
    const rem = Math.max(total - parseMoney(prev.card), 0);
    return { ...prev, cash: rem > 0 ? formatMoneyInput(rem) : "" };
  }
  return prev; // ikkalasi ham tegilmagan — hali bo'sh, to'ldirmaymiz
}

export type MixedValidation = {
  cash: number;
  card: number;
  sum: number;
  /** jami − yig'indi; musbat = KAM kiritilgan, manfiy = ORTIQ */
  diff: number;
  balanced: boolean;
  /** ikkalasi ham > 0 (spec: ikkalasi MAJBURIY) */
  bothPositive: boolean;
  ok: boolean;
  /** operatorga ko'rsatiladigan xabar (ok bo'lsa bo'sh) */
  message: string;
};

/** Yig'indi jamiga TENGmi va ikkala summa ham noldan kattami. */
export function validateMixed(state: MixedState, total: number): MixedValidation {
  const cash = parseMoney(state.cash);
  const card = parseMoney(state.card);
  const sum = cash + card;
  const diff = total - sum;
  const balanced = diff === 0 && total > 0;
  const bothPositive = cash > 0 && card > 0;
  let message = "";
  if (!balanced) {
    message = diff > 0
      ? `Farq: ${formatMoneyInput(diff)} so'm kam`
      : `Farq: ${formatMoneyInput(-diff)} so'm ortiq`;
  } else if (!bothPositive) {
    // 300 000 + 0 — spec bo'yicha NOTO'G'RI; oddiy naqd/kartaga yo'naltiramiz
    message = "Aralash to'lovda ikkala summa ham noldan katta bo'lishi kerak — bitta usul bo'lsa «Naqd» yoki «Karta»ni tanlang.";
  }
  return { cash, card, sum, diff, balanced, bothPositive, ok: balanced && bothPositive, message };
}

/**
 * Sotuv payload'ining ARALASH qismi.
 * ⚠️ `cash_amount`/`card_amount` FAQAT `mixed` rejimida yuboriladi — boshqa
 * rejimlarda kalitlar UMUMAN qo'shilmaydi. Yaroqsiz bo'lsa `null` (submit bloklanadi).
 */
export function mixedSellPayload(
  isMixed: boolean, state: MixedState, total: number,
): Record<string, string> | null {
  if (!isMixed) return {};
  const v = validateMixed(state, total);
  if (!v.ok) return null;
  return { cash_amount: String(v.cash), card_amount: String(v.card) };
}

/**
 * DASTAFKA payload qoidasi: BO'SH bo'lsa kalit UMUMAN yuborilmaydi ("0" ham emas).
 * Operator ATAYLAB "0" yozsa — yuboriladi (u ongli tanlov).
 */
export function deliveryPayload(raw: string): Record<string, string> {
  const t = (raw ?? "").trim();
  if (t === "") return {};
  const n = parseMoney(t);
  return { delivery_amount: String(Math.max(n, 0)) };
}

/**
 * ⚠️ ARALASH TAQQOSLASH SUMMASI = TOVAR (chegirmadan keyin) + DASTAFKA.
 * Dastafka chegirmadan KEYIN qo'shiladi va HECH QACHON chegirmaga tushmaydi.
 */
export const mixedTarget = (goodsTotal: number, deliveryRaw: string): number =>
  Math.max(goodsTotal, 0) + Math.max(parseMoney(deliveryRaw), 0);

/** Sotuv tarixidagi ko'rinish: «Aralash (150 000 naqd · 150 000 karta)».
    ⚠️ Oddiy to'lovda `payment_breakdown` NULL — bo'sh qavs CHIZILMAYDI. */
export function paymentBreakdownLabel(
  label: string | undefined,
  breakdown: { cash?: string | number; card?: string | number } | null | undefined,
): string {
  const base = label || "—";
  if (!breakdown) return base;
  const cash = parseMoney(breakdown.cash);
  const card = parseMoney(breakdown.card);
  if (cash <= 0 && card <= 0) return base; // bo'sh obyekt — qavs ochmaymiz
  const parts: string[] = [];
  if (cash > 0) parts.push(`${formatMoneyInput(cash)} naqd`);
  if (card > 0) parts.push(`${formatMoneyInput(card)} karta`);
  return `${base} (${parts.join(" · ")})`;
}
