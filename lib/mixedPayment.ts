/**
 * ARALASH TO'LOV (naqd + karta + terminal) — sof mantiq.
 *
 * ⚠️ USULLAR RO'YXATI ENDPOINTGA BOG'LIQ:
 *   · katalog sotuvi  — naqd + karta + TERMINAL (`CatalogSellRequest.terminal_amount`,
 *     backend 29.08.2026; qoida: uchtadan KAMIDA IKKITASI noldan katta)
 *   · aksessuar/partiya sotuvi — faqat naqd + karta (ularning kontraktida
 *     `terminal_amount` YO'Q: PackagingSellRequest / StockBatchSellRequest)
 * Shu bois har funksiya `methods` oladi; sukut — IKKI usul, ya'ni eski
 * chaqiruvchilar o'zgarishsiz ishlaydi.
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

export type MixedMethod = "cash" | "card" | "terminal";
/** Aksessuar / partiya sotuvi — kontraktda terminal YO'Q. */
export const MIXED_CASH_CARD: MixedMethod[] = ["cash", "card"];
/** Katalog sotuvi — terminal ham bor (backend 29.08.2026). */
export const MIXED_WITH_TERMINAL: MixedMethod[] = ["cash", "card", "terminal"];

export const MIXED_LABEL: Record<MixedMethod, string> = { cash: "Naqd", card: "Karta", terminal: "Terminal" };

export type MixedState = {
  /** xom (formatlangan) kiritmalar */
  cash: string;
  card: string;
  terminal: string;
  /** operator maydonni QO'LDA tahrirladimi — avtomatik to'ldirish shundan keyin TO'XTAYDI */
  cashTouched: boolean;
  cardTouched: boolean;
  terminalTouched: boolean;
};

export const emptyMixed: MixedState = {
  cash: "", card: "", terminal: "",
  cashTouched: false, cardTouched: false, terminalTouched: false,
};

const touchedOf = (s: MixedState, m: MixedMethod): boolean => s[`${m}Touched`];
const sumOf = (s: MixedState, methods: MixedMethod[], except?: MixedMethod): number =>
  methods.reduce((acc, m) => (m === except ? acc : acc + parseMoney(s[m])), 0);
/** Qoldiq FAQAT bitta tegilmagan maydon qolganda taklif qilinadi — aks holda taxmin bo'lardi. */
const loneUntouched = (s: MixedState, methods: MixedMethod[], except: MixedMethod): MixedMethod | null => {
  const rest = methods.filter((m) => m !== except && !touchedOf(s, m));
  return rest.length === 1 ? rest[0] : null;
};

/**
 * BITTA maydon o'zgarganda — ikkinchisini QOLDIQ bilan to'ldirish.
 *
 * Qoidalar (spec + operatorga qarshi ishlamasligi uchun):
 *  · avtomatik to'ldirish FAQAT ikkinchi maydon hali QO'LDA tegilmagan bo'lsa;
 *  · MANFIY qoldiq hech qachon yozilmaydi — 0 ga qisiladi va nomuvofiqlik ko'rsatiladi;
 *  · tahrirlangan maydonning o'zi HECH QACHON qayta yozilmaydi.
 */
export function applyMixedEdit(
  prev: MixedState, field: MixedMethod, raw: string, total: number,
  methods: MixedMethod[] = MIXED_CASH_CARD,
): MixedState {
  const value = formatMoneyInput(raw);
  const next: MixedState = { ...prev, [field]: value, [`${field}Touched`]: true } as MixedState;
  // ⚠️ UCH USULDA: birinchi summa yozilganda qolgan IKKITASIGA taqsimlash noma'lum —
  //    hech narsa to'ldirilmaydi. Ikkinchisi yozilgach, oxirgisi qoldiq bilan to'ladi.
  const target = loneUntouched(next, methods, field);
  if (!target) return next;
  const remainder = Math.max(total - sumOf(next, methods, target), 0); // ⚠️ manfiy qoldiq YOZILMAYDI
  return { ...next, [target]: remainder > 0 ? formatMoneyInput(remainder) : "" } as MixedState;
}

/**
 * ⚠️ AVTOMATIK TO'LDIRILGAN MAYDONGA FOKUS — QIYMAT TOZALANADI.
 *
 * NOSOZLIK (jonli takrorlangan): operator naqdga 400 000 yozadi → karta maydoni
 * QOLDIQ bilan (500 000) AVTOMATIK to'ladi. Operator kartaga o'z summasini yozadi,
 * lekin maydon BO'SH EMAS — harflar mavjud qiymatga QO'SHILIB ketadi:
 *     "500 000" + "500000" → "500 000 500 000" = 500 000 500 000
 * Yig'indi portlaydi, tugma bloklanadi va xabar («✗ … ortiq») ASL sababni
 * KO'RSATMAYDI — operator «summalarni kiritdim, sotib bo'lmayapti» deb ko'radi.
 *
 * Yechim: maydon HALI QO'LDA tegilmagan bo'lsa (ya'ni ichidagi son — bizning
 * taklifimiz), fokus olinganda TOZALANADI. Shunda yozilgan har narsa YANGI qiymat
 * bo'ladi, qo'shilmaydi. Tegilgan maydon TEGILMAYDI — operator o'z sonini tahrirlaydi.
 *
 * ⚠️ `select()` bilan qilinmadi: sichqoncha bosilganda karetka `mouseup` da qayta
 * qo'yiladi va tanlov BEKOR bo'ladi — o'rtaga yozish yana buzardi.
 */
export function focusMixedField(prev: MixedState, field: MixedMethod): MixedState {
  if (touchedOf(prev, field) || prev[field] === "") return prev;   // o'z qiymati yoki allaqachon bo'sh
  return { ...prev, [field]: "" } as MixedState;
}

/**
 * FOKUSDAN CHIQQANDA — hech narsa yozilmagan bo'lsa taklif QAYTADI.
 * (Operator maydonga bosib, fikridan qaytib, boshqa joyga bossa — qoldiq yo'qolmaydi.)
 */
export function blurMixedField(
  prev: MixedState, field: MixedMethod, total: number, methods: MixedMethod[] = MIXED_CASH_CARD,
): MixedState {
  if (touchedOf(prev, field) || prev[field] !== "") return prev;
  const rem = Math.max(total - sumOf(prev, methods, field), 0);
  return { ...prev, [field]: rem > 0 ? formatMoneyInput(rem) : "" } as MixedState;
}

/**
 * JAMI o'zgarganda (dona / chegirma tahrirlandi) — FAQAT tegilmagan maydonni qayta hisoblash.
 * Ikkalasi ham tegilgan bo'lsa hech narsa o'zgarmaydi (nomuvofiqlik ko'rsatiladi).
 */
export function recalcOnTotalChange(
  prev: MixedState, total: number, methods: MixedMethod[] = MIXED_CASH_CARD,
): MixedState {
  const untouched = methods.filter((m) => !touchedOf(prev, m));
  // hech biri yoki bir nechtasi tegilmagan bo'lsa — taxmin qilmaymiz
  if (untouched.length !== 1) return prev;
  const target = untouched[0];
  const rem = Math.max(total - sumOf(prev, methods, target), 0);
  return { ...prev, [target]: rem > 0 ? formatMoneyInput(rem) : "" };
}

export type MixedValidation = {
  cash: number;
  card: number;
  terminal: number;
  sum: number;
  /** jami − yig'indi; musbat = KAM kiritilgan, manfiy = ORTIQ */
  diff: number;
  balanced: boolean;
  /** noldan katta summalar soni */
  positiveCount: number;
  /** ⚠️ KAMIDA IKKITASI noldan katta (ikki usulli rejimda — ikkalasi ham) */
  bothPositive: boolean;
  ok: boolean;
  /** operatorga ko'rsatiladigan xabar (ok bo'lsa bo'sh) */
  message: string;
};

/**
 * Yig'indi jamiga TENGmi va kamida IKKITA summa noldan kattami.
 *
 * ⚠️ QOIDA O'ZGARDI (backend 29.08.2026): ilgari «naqd ham, karta ham > 0»
 * edi; endi uch usuldan KAMIDA IKKITASI > 0 bo'lsa yetadi (naqd+terminal,
 * karta+terminal, uchalasi — hammasi to'g'ri). Ikki usulli rejimda (aksessuar,
 * partiya) bu AYNAN eski qoidaga teng: ikkitadan kamida ikkitasi = ikkalasi.
 */
export function validateMixed(
  state: MixedState, total: number, methods: MixedMethod[] = MIXED_CASH_CARD,
): MixedValidation {
  const amounts = methods.map((m) => parseMoney(state[m]));
  const sum = amounts.reduce((a, b) => a + b, 0);
  const diff = total - sum;
  const balanced = diff === 0 && total > 0;
  const positiveCount = amounts.filter((n) => n > 0).length;
  const bothPositive = positiveCount >= 2;
  let message = "";
  if (!balanced) {
    // ⚠️ SPEC (FRONTEND_CATALOG_MIXED_SALE_API.md, «Ekran») dagi AYNAN ibora:
    //   «Kiritildi 750 000        ✗ 50 000 kam»
    //   «Kiritildi 850 000        ✗ 50 000 ortiq»
    message = diff > 0
      ? `✗ ${formatMoneyInput(diff)} kam`
      : `✗ ${formatMoneyInput(-diff)} ortiq`;
  } else if (!bothPositive) {
    // bitta usul bilan to'langan bo'lsa `mixed` EMAS — o'sha usulning o'zi tanlanadi
    message = methods.length > 2
      ? "Aralash to'lovda kamida ikkita summani kiriting: naqd, karta yoki terminal. Bitta usul bo'lsa o'sha usulni tanlang."
      : "Aralash to'lovda ikkala summa ham noldan katta bo'lishi kerak — bitta usul bo'lsa «Naqd» yoki «Karta»ni tanlang.";
  }
  return {
    cash: parseMoney(state.cash), card: parseMoney(state.card), terminal: parseMoney(state.terminal),
    sum, diff, balanced, positiveCount, bothPositive, ok: balanced && bothPositive, message,
  };
}

/**
 * Sotuv payload'ining ARALASH qismi.
 * ⚠️ `*_amount` kalitlari FAQAT `mixed` rejimida yuboriladi — boshqa rejimlarda
 * UMUMAN qo'shilmaydi. Yaroqsiz bo'lsa `null` (submit bloklanadi).
 * ⚠️ NOL summa YUBORILMAYDI: spec «yuborilmagan maydon 0 deb qabul qilinadi»
 * deydi, shuning uchun tanada faqat HAQIQATDA olingan pul turadi.
 */
export function mixedSellPayload(
  isMixed: boolean, state: MixedState, total: number, methods: MixedMethod[] = MIXED_CASH_CARD,
): Record<string, string> | null {
  if (!isMixed) return {};
  const v = validateMixed(state, total, methods);
  if (!v.ok) return null;
  const out: Record<string, string> = {};
  methods.forEach((m) => {
    const n = parseMoney(state[m]);
    if (n > 0) out[`${m}_amount`] = String(n);
  });
  return out;
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

/** Sotuv tarixidagi ko'rinish: «Aralash (150 000 naqd · 150 000 terminal)».
    ⚠️ Oddiy to'lovda `payment_breakdown` NULL — bo'sh qavs CHIZILMAYDI.
    ⚠️ `terminal` — backend 29.08.2026 dan beri qaytadi; eski sotuvlarda 0. */
export function paymentBreakdownLabel(
  label: string | undefined,
  breakdown: { cash?: string | number; card?: string | number; terminal?: string | number } | null | undefined,
): string {
  const base = label || "—";
  if (!breakdown) return base;
  const parts: string[] = [];
  (["cash", "card", "terminal"] as const).forEach((m) => {
    const n = parseMoney(breakdown[m]);
    if (n > 0) parts.push(`${formatMoneyInput(n)} ${MIXED_LABEL[m].toLowerCase()}`);
  });
  if (!parts.length) return base; // bo'sh obyekt — qavs ochmaymiz
  return `${base} (${parts.join(" · ")})`;
}
