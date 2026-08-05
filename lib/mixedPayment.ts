/**
 * ARALASH TO'LOV (naqd + karta) — sof mantiq.
 *
 * ⚠️ TAQQOSLASH SUMMASI = SOTUV SUMMASI (`sale_price × quantity`) — DASTAFKA BILAN BIRGA.
 * 2026-08-04 da qoida O'ZGARDI (DASTAFKA_QOIDASI_OZGARDI.md): `sale_price` endi
 * MIJOZDAN OLINADIGAN TO'LIQ pul, dastafka esa uning ICHIDA. Shu bois dastafkani
 * yana qo'shish IKKI MARTA hisoblash bo'lardi.
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
 * ⚠️ AVTOMATIK TO'LDIRILGAN MAYDONGA FOKUS — QIYMAT TOZALANADI.
 *
 * NOSOZLIK (jonli takrorlangan): operator naqdga 400 000 yozadi → karta maydoni
 * QOLDIQ bilan (500 000) AVTOMATIK to'ladi. Operator kartaga o'z summasini yozadi,
 * lekin maydon BO'SH EMAS — harflar mavjud qiymatga QO'SHILIB ketadi:
 *     "500 000" + "500000" → "500 000 500 000" = 500 000 500 000
 * Yig'indi portlaydi, tugma bloklanadi va xabar («Farq: … ortiq») ASL sababni
 * KO'RSATMAYDI — operator «summalarni kiritdim, sotib bo'lmayapti» deb ko'radi.
 *
 * Yechim: maydon HALI QO'LDA tegilmagan bo'lsa (ya'ni ichidagi son — bizning
 * taklifimiz), fokus olinganda TOZALANADI. Shunda yozilgan har narsa YANGI qiymat
 * bo'ladi, qo'shilmaydi. Tegilgan maydon TEGILMAYDI — operator o'z sonini tahrirlaydi.
 *
 * ⚠️ `select()` bilan qilinmadi: sichqoncha bosilganda karetka `mouseup` da qayta
 * qo'yiladi va tanlov BEKOR bo'ladi — o'rtaga yozish yana buzardi.
 */
export function focusMixedField(prev: MixedState, field: "cash" | "card"): MixedState {
  const touched = field === "cash" ? prev.cashTouched : prev.cardTouched;
  if (touched || prev[field] === "") return prev;   // o'z qiymati yoki allaqachon bo'sh
  return { ...prev, [field]: "" } as MixedState;
}

/**
 * FOKUSDAN CHIQQANDA — hech narsa yozilmagan bo'lsa taklif QAYTADI.
 * (Operator maydonga bosib, fikridan qaytib, boshqa joyga bossa — qoldiq yo'qolmaydi.)
 */
export function blurMixedField(prev: MixedState, field: "cash" | "card", total: number): MixedState {
  const touched = field === "cash" ? prev.cashTouched : prev.cardTouched;
  if (touched || prev[field] !== "") return prev;
  const other = field === "cash" ? "card" : "cash";
  const rem = Math.max(total - parseMoney(prev[other]), 0);
  return { ...prev, [field]: rem > 0 ? formatMoneyInput(rem) : "" } as MixedState;
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
 * ⚠️ TOVAR SAVDOSI — hosila qiymat, KIRITMA EMAS: sotuv summasi − dastafka.
 * Spec: 500 000 sotildi, 50 000 dastafka → tovar savdosi 450 000.
 */
export const deliveryGoods = (saleTotal: number, deliveryRaw: string | number): number =>
  Math.max(Math.max(saleTotal, 0) - Math.max(parseMoney(deliveryRaw), 0), 0);

/**
 * ⚠️ DASTAFKA sotuv summasidan QAT'IY KICHIK bo'lishi shart (server 400 beradi).
 * Teng bo'lsa ham NOTO'G'RI — tovar savdosi 0 bo'lib qolardi.
 */
export function deliveryTooLarge(saleTotal: number, deliveryRaw: string | number): boolean {
  const d = parseMoney(deliveryRaw);
  return d > 0 && saleTotal > 0 && d >= saleTotal;
}

/** Serverning yangi 400 matni (spec) — bizniki AYNAN shunga mos bo'lsin. */
export const deliveryTooLargeMessage = (saleTotal: number, deliveryRaw: string | number): string =>
  `Dastafka summasi sotuv summasidan kam bo'lishi kerak. Sotuv: ${formatMoneyInput(saleTotal)}, dastafka: ${formatMoneyInput(parseMoney(deliveryRaw))}`;

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
