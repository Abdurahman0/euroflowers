import { describe, it, expect } from "vitest";
import {
  applyMixedEdit, blurMixedField, deliveryGoods, deliveryPayload, emptyMixed, focusMixedField, formatMoneyInput, mixedSellPayload, parseMoney, paymentBreakdownLabel, recalcOnTotalChange, validateMixed,
  type MixedState,
} from "./mixedPayment";

const S = (over: Partial<MixedState> = {}): MixedState => ({ ...emptyMixed, ...over });

describe("parseMoney / formatMoneyInput — TAQQOSLASH raqam bo'yicha, satr emas", () => {
  it("formatlangan satrdan raqam", () => expect(parseMoney("1 500 000")).toBe(1500000));
  it("bo'sh → 0", () => expect(parseMoney("")).toBe(0));
  it("harflar tashlanadi", () => expect(parseMoney("150 000 so'm")).toBe(150000));
  it("⚠️ SERVER decimal satri — nuqta SAQLANADI (150000.00 ≠ 15 000 000)", () => {
    expect(parseMoney("150000.00")).toBe(150000);
    expect(parseMoney("1234.56")).toBe(1235); // yaxlitlanadi
  });
  it("mingliklar ajratiladi", () => expect(formatMoneyInput("1500000")).toBe("1 500 000"));
  it("bo'sh kirish → bo'sh chiqish (0 yozilmaydi)", () => expect(formatMoneyInput("")).toBe(""));
});

describe("⚠️ AVTOMATIK TO'LDIRISH — operatorga qarshi ishlamasligi kerak", () => {
  it("naqd yozilsa — karta QOLDIQ bilan to'ladi", () => {
    const r = applyMixedEdit(emptyMixed, "cash", "150000", 300000);
    expect(r.cash).toBe("150 000");
    expect(r.card).toBe("150 000");
    expect(r.cashTouched).toBe(true);
    expect(r.cardTouched).toBe(false); // avtomatik to'lgan — QO'LDA tegilgan emas
  });
  it("karta yozilsa — naqd qoldiq bilan to'ladi", () => {
    const r = applyMixedEdit(emptyMixed, "card", "200000", 500000);
    expect(r.cash).toBe("300 000");
  });
  it("⚠️ ikkinchi maydon QO'LDA tegilgan bo'lsa — QAYTA YOZILMAYDI", () => {
    const touched = S({ card: "100 000", cardTouched: true });
    const r = applyMixedEdit(touched, "cash", "150000", 300000);
    expect(r.card).toBe("100 000"); // tegilmaydi, garchi qoldiq 150 000 bo'lsa ham
    expect(r.cash).toBe("150 000");
  });
  it("⚠️ MANFIY qoldiq HECH QACHON yozilmaydi — bo'sh qoladi", () => {
    const r = applyMixedEdit(emptyMixed, "cash", "400000", 300000);
    expect(r.cash).toBe("400 000");
    expect(r.card).toBe(""); // −100 000 emas
  });
  it("aniq jamiga teng yozilsa — ikkinchisi bo'sh (0 yozilmaydi)", () => {
    const r = applyMixedEdit(emptyMixed, "cash", "300000", 300000);
    expect(r.card).toBe("");
  });
  it("tahrirlangan maydonning O'ZI qayta yozilmaydi", () => {
    const r = applyMixedEdit(S({ cash: "50 000", cashTouched: true }), "cash", "70000", 300000);
    expect(r.cash).toBe("70 000");
  });
});

describe("⚠️ JAMI o'zgarganda — FAQAT tegilmagan maydon qayta hisoblanadi", () => {
  it("naqd qo'lda, karta avtomatik → jami oshsa FAQAT karta o'zgaradi", () => {
    const st = S({ cash: "150 000", card: "150 000", cashTouched: true });
    const r = recalcOnTotalChange(st, 500000);
    expect(r.cash).toBe("150 000");   // tegilmagan
    expect(r.card).toBe("350 000");   // qayta hisoblandi
  });
  it("⚠️ IKKALASI ham qo'lda tegilgan → HECH NARSA o'zgarmaydi (nomuvofiqlik ko'rsatiladi)", () => {
    const st = S({ cash: "150 000", card: "150 000", cashTouched: true, cardTouched: true });
    expect(recalcOnTotalChange(st, 500000)).toEqual(st);
  });
  it("karta qo'lda, naqd avtomatik → naqd qayta hisoblanadi", () => {
    const st = S({ cash: "150 000", card: "150 000", cardTouched: true });
    expect(recalcOnTotalChange(st, 400000).cash).toBe("250 000");
  });
  it("jami kamaysa va qoldiq manfiy bo'lsa → bo'sh (manfiy yozilmaydi)", () => {
    const st = S({ cash: "400 000", card: "100 000", cashTouched: true });
    expect(recalcOnTotalChange(st, 300000).card).toBe("");
  });
  it("ikkalasi ham tegilmagan (bo'sh) → to'ldirilmaydi", () => {
    expect(recalcOnTotalChange(emptyMixed, 300000)).toEqual(emptyMixed);
  });
});

describe("validateMixed — yig'indi AYNAN teng va ikkalasi > 0", () => {
  it("150 000 + 150 000 = 300 000 → ✓", () => {
    const v = validateMixed(S({ cash: "150 000", card: "150 000" }), 300000);
    expect(v.ok).toBe(true); expect(v.balanced).toBe(true); expect(v.bothPositive).toBe(true);
    expect(v.message).toBe("");
  });
  it("KAM kiritilgan → farq ko'rsatiladi", () => {
    const v = validateMixed(S({ cash: "100 000", card: "100 000" }), 300000);
    expect(v.ok).toBe(false);
    expect(v.message).toBe("Farq: 100 000 so'm kam");
  });
  it("ORTIQ kiritilgan → farq ko'rsatiladi", () => {
    const v = validateMixed(S({ cash: "200 000", card: "200 000" }), 300000);
    expect(v.message).toBe("Farq: 100 000 so'm ortiq");
  });
  it("⚠️ 300 000 + 0 — yig'indi TO'G'RI, lekin NOTO'G'RI (ikkalasi > 0 bo'lishi shart)", () => {
    const v = validateMixed(S({ cash: "300 000", card: "" }), 300000);
    expect(v.balanced).toBe(true);
    expect(v.bothPositive).toBe(false);
    expect(v.ok).toBe(false);
    expect(v.message).toContain("«Naqd» yoki «Karta»");
  });
  it("chegirmali, dona > 1: 2 × 250 000 = 500 000 = 200 000 + 300 000 (spec misoli)", () => {
    expect(validateMixed(S({ cash: "200 000", card: "300 000" }), 500000).ok).toBe(true);
  });
  it("jami 0 bo'lsa hech qachon ok emas", () => {
    expect(validateMixed(S({ cash: "", card: "" }), 0).ok).toBe(false);
  });
});

describe("mixedSellPayload — kalitlar FAQAT aralash rejimda", () => {
  it("naqd rejimi → BO'SH obyekt (cash_amount kaliti YO'Q)", () => {
    expect(mixedSellPayload(false, S({ cash: "150 000", card: "150 000" }), 300000)).toEqual({});
  });
  it("karta rejimi → BO'SH", () => expect(mixedSellPayload(false, emptyMixed, 300000)).toEqual({}));
  it("qarz rejimi → BO'SH (mixed va debt BIRGA BO'LMAYDI)", () => {
    expect(mixedSellPayload(false, emptyMixed, 300000)).toEqual({});
  });
  it("aralash + to'g'ri → ikkala summa yuboriladi (raqam satr sifatida)", () => {
    expect(mixedSellPayload(true, S({ cash: "150 000", card: "150 000" }), 300000))
      .toEqual({ cash_amount: "150000", card_amount: "150000" });
  });
  it("aralash + yig'indi noto'g'ri → null (submit BLOKLANADI)", () => {
    expect(mixedSellPayload(true, S({ cash: "100 000", card: "100 000" }), 300000)).toBeNull();
  });
  it("aralash + bittasi nol → null", () => {
    expect(mixedSellPayload(true, S({ cash: "300 000", card: "" }), 300000)).toBeNull();
  });
});

describe("paymentBreakdownLabel — oddiy to'lovda BO'SH QAVS chizilmaydi", () => {
  it("aralash → «Aralash (150 000 naqd · 150 000 karta)»", () => {
    expect(paymentBreakdownLabel("Aralash", { cash: "150000.00", card: "150000.00" }))
      .toBe("Aralash (150 000 naqd · 150 000 karta)");
  });
  it("⚠️ null ajratma → faqat yorliq (qavs YO'Q)", () => {
    expect(paymentBreakdownLabel("Naqd", null)).toBe("Naqd");
    expect(paymentBreakdownLabel("Karta", undefined)).toBe("Karta");
    expect(paymentBreakdownLabel("Qarz", null)).toBe("Qarz");
  });
  it("bo'sh obyekt → qavs ochilmaydi", () => {
    expect(paymentBreakdownLabel("Aralash", {})).toBe("Aralash");
    expect(paymentBreakdownLabel("Aralash", { cash: "0", card: "0" })).toBe("Aralash");
  });
  it("faqat bittasi > 0 → faqat o'sha ko'rsatiladi", () => {
    expect(paymentBreakdownLabel("Aralash", { cash: "150000", card: 0 })).toBe("Aralash (150 000 naqd)");
  });
  it("yorliq yo'q → «—»", () => expect(paymentBreakdownLabel(undefined, null)).toBe("—"));
});

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ DASTAFKA QOIDASI O'ZGARDI (DASTAFKA_QOIDASI_OZGARDI.md, 2026-08-04)
// ESKI: sale_price = tovar, dastafka USTIGA qo'shilardi.
// YANGI: sale_price = mijozdan olinadigan TO'LIQ pul, dastafka uning ICHIDA.
// Eski qoidani kodlagan testlar O'CHIRILDI — ikkalasi qoldirilmadi.
// ─────────────────────────────────────────────────────────────────────────────
import { deliveryTooLarge, deliveryTooLargeMessage } from "./mixedPayment";

describe("deliveryPayload — bo'sh bo'lsa kalit YUBORILMAYDI", () => {
  it("⚠️ BO'SH → kalit UMUMAN yo'q («0» ham yuborilmaydi)", () => {
    expect(deliveryPayload("")).toEqual({});
    expect(deliveryPayload("   ")).toEqual({});
  });
  it("operator ATAYLAB «0» yozsa → yuboriladi", () => {
    expect(deliveryPayload("0")).toEqual({ delivery_amount: "0" });
  });
  it("qiymat → yuboriladi", () => expect(deliveryPayload("50 000")).toEqual({ delivery_amount: "50000" }));
});

describe("deliveryGoods — TOVAR SAVDOSI = sotuv summasi − dastafka", () => {
  it("⚠️ SPEC MISOLI: 500 000 sotildi, 50 000 dastafka → tovar 450 000", () => {
    expect(deliveryGoods(500000, "50000")).toBe(450000);
  });
  it("dastafkasiz → tovar = sotuv summasining O'ZI", () => {
    expect(deliveryGoods(500000, "")).toBe(500000);
    expect(deliveryGoods(500000, "0")).toBe(500000);
  });
  it("⚠️ ESKI qoida bo'lganda 550 000 chiqardi — endi 450 000 (QO'SHILMAYDI)", () => {
    expect(deliveryGoods(500000, "50000")).not.toBe(550000);
  });
  it("dastafka summadan katta bo'lsa 0 dan pastga tushmaydi", () => {
    expect(deliveryGoods(100000, "150000")).toBe(0);
  });
});

describe("deliveryTooLarge — dastafka sotuv summasidan QAT'IY kichik", () => {
  it("kichik → to'g'ri", () => expect(deliveryTooLarge(500000, "50000")).toBe(false));
  it("⚠️ TENG → NOTO'G'RI (tovar savdosi 0 bo'lib qolardi)", () => {
    expect(deliveryTooLarge(300000, "300000")).toBe(true);
  });
  it("⚠️ KATTA → NOTO'G'RI", () => expect(deliveryTooLarge(300000, "400000")).toBe(true));
  it("dastafkasiz → tekshiruv qo'zg'atilmaydi", () => {
    expect(deliveryTooLarge(300000, "")).toBe(false);
    expect(deliveryTooLarge(300000, "0")).toBe(false);
  });
  it("xabar serverning 400 matni bilan bir xil shaklda", () => {
    expect(deliveryTooLargeMessage(300000, "300000"))
      .toBe("Dastafka summasi sotuv summasidan kam bo'lishi kerak. Sotuv: 300 000, dastafka: 300 000");
  });
});

describe("⚠️ ARALASH — jami SOTUV SUMMASINING O'ZI (dastafka QO'SHILMAYDI)", () => {
  // spec: 300 000 olinadi, shundan 20 000 dastafka → naqd + karta = 300 000
  const target = 300000;
  it("SPEC MISOLI: 150 000 + 150 000 = 300 000 → ✓ (dastafka 20 000 ichida)", () => {
    expect(validateMixed(S({ cash: "150 000", card: "150 000" }), target).ok).toBe(true);
  });
  it("⚠️ ESKI qoida bo'yicha to'g'ri bo'lgan 320 000 endi NOTO'G'RI", () => {
    const v = validateMixed(S({ cash: "150 000", card: "170 000" }), target);
    expect(v.ok).toBe(false);
    expect(v.message).toBe("Farq: 20 000 so'm ortiq");
  });
  it("payload sotuv summasiga qarab quriladi", () => {
    expect(mixedSellPayload(true, S({ cash: "150 000", card: "150 000" }), target))
      .toEqual({ cash_amount: "150000", card_amount: "150000" });
  });
  it("avtomatik to'ldirish ham sotuv summasidan (dastafkasiz)", () => {
    expect(applyMixedEdit(emptyMixed, "cash", "100000", target).card).toBe("200 000");
  });
  it("⚠️ dastafka o'zgarsa aralash jami O'ZGARMAYDI (u summaning ichida)", () => {
    // jami faqat sotuv summasi va donadan kelib chiqadi
    expect(validateMixed(S({ cash: "150 000", card: "150 000" }), 300000).ok).toBe(true);
    expect(deliveryGoods(300000, "20000")).toBe(280000); // faqat TOVAR o'zgaradi
  });
});

/* ═══════════════════════════════════════════════════════════════════
   NOSOZLIK: avtomatik to'ldirilgan maydonga yozilgani QO'SHILIB ketardi.
   Jonli takrorlangan (brauzer): naqd 400 000 → karta avtomatik "500 000" →
   operator "500000" yozadi → "500 000 500 000" = 500 000 500 000 → tugma bloklanadi.
   ═══════════════════════════════════════════════════════════════════ */
describe("⚠️ avtomatik qoldiq ustiga yozish (asl nosozlik)", () => {
  const TOTAL = 900_000;

  /** brauzerdagidek: maydon oxiriga belgilar qo'shiladi */
  const typeAppend = (st: MixedState, field: "cash" | "card", text: string, total: number): MixedState => {
    let s = st;
    for (const ch of text) s = applyMixedEdit(s, field, s[field] + ch, total);
    return s;
  };

  it("NOSOZLIK QAYTA HOSIL QILINADI — fokus tozalanmasa qo'shilib ketadi", () => {
    let s = typeAppend(emptyMixed, "cash", "400000", TOTAL);
    expect(s.cash).toBe("400 000");
    expect(s.card).toBe("500 000");              // avtomatik qoldiq
    // fokus ishlovisiz to'g'ridan-to'g'ri yozish:
    s = typeAppend(s, "card", "500000", TOTAL);
    expect(parseMoney(s.card)).toBe(500_000_500_000);   // ← aynan shu buzardi
    expect(validateMixed(s, TOTAL).ok).toBe(false);
  });

  it("TUZATILDI — fokus maydonni tozalaydi, yozilgani YANGI qiymat bo'ladi", () => {
    let s = typeAppend(emptyMixed, "cash", "400000", TOTAL);
    s = focusMixedField(s, "card");              // ⬅ tuzatish
    expect(s.card).toBe("");
    s = typeAppend(s, "card", "500000", TOTAL);
    expect(s.card).toBe("500 000");
    const v = validateMixed(s, TOTAL);
    expect([v.cash, v.card, v.sum, v.ok]).toEqual([400_000, 500_000, 900_000, true]);
    expect(mixedSellPayload(true, s, TOTAL)).toEqual({ cash_amount: "400000", card_amount: "500000" });
  });

  it("TESKARI TARTIB — avval karta, keyin naqd", () => {
    let s = typeAppend(emptyMixed, "card", "300000", TOTAL);
    expect(s.cash).toBe("600 000");
    s = typeAppend(focusMixedField(s, "cash"), "cash", "600000", TOTAL);
    expect(validateMixed(s, TOTAL).ok).toBe(true);
  });

  it("QO'LDA tegilgan maydon fokusda TOZALANMAYDI (operator o'z sonini tahrirlaydi)", () => {
    const s = typeAppend(emptyMixed, "cash", "400000", TOTAL);
    expect(focusMixedField(s, "cash").cash).toBe("400 000");
  });

  it("fokus → hech narsa yozilmadi → blur QOLDIQNI QAYTARADI", () => {
    let s = typeAppend(emptyMixed, "cash", "400000", TOTAL);
    s = focusMixedField(s, "card");
    expect(s.card).toBe("");
    s = blurMixedField(s, "card", TOTAL);
    expect(s.card).toBe("500 000");
    expect(validateMixed(s, TOTAL).ok).toBe(true);
  });

  it("blur QO'LDA yozilgan qiymatni HECH QACHON bosib o'tmaydi", () => {
    let s = typeAppend(emptyMixed, "cash", "400000", TOTAL);
    s = typeAppend(focusMixedField(s, "card"), "card", "100000", TOTAL);
    expect(blurMixedField(s, "card", TOTAL).card).toBe("100 000");   // 500 000 ga qaytmaydi
  });

  it("blur QO'LDA bo'shatilgan maydonni ham qaytarmaydi", () => {
    let s = typeAppend(emptyMixed, "cash", "400000", TOTAL);
    s = applyMixedEdit(s, "card", "", TOTAL);      // operator ATAYLAB tozaladi
    expect(blurMixedField(s, "card", TOTAL).card).toBe("");
  });
});

describe("validateMixed — operator HAQIQATDA hosil qiladigan qiymatlar", () => {
  const T = 300_000;
  const st = (cash: string, card: string): MixedState => ({ cash, card, cashTouched: true, cardTouched: true });

  it("formatlangan satrlar (bo'sh joy bilan) — TO'G'RI o'qiladi", () => {
    const v = validateMixed(st("150 000", "150 000"), T);
    expect([v.cash, v.card, v.sum, v.ok]).toEqual([150_000, 150_000, 300_000, true]);
  });
  it("uzilmas bo'sh joy (NBSP) ham o'qiladi", () => {
    expect(validateMixed(st("150 000", "150 000"), T).ok).toBe(true);
  });
  it("aynan mos", () => expect(validateMixed(st("100 000", "200 000"), T).ok).toBe(true));
  it("kam", () => {
    const v = validateMixed(st("100 000", "150 000"), T);
    expect([v.diff, v.ok]).toEqual([50_000, false]);
    expect(v.message).toBe("Farq: 50 000 so'm kam");
  });
  it("ortiq", () => {
    const v = validateMixed(st("200 000", "200 000"), T);
    expect([v.diff, v.ok]).toEqual([-100_000, false]);
    expect(v.message).toBe("Farq: 100 000 so'm ortiq");
  });
  it("bittasi NOL — yig'indi to'g'ri bo'lsa ham RAD ETILADI", () => {
    const v = validateMixed(st("300 000", "0"), T);
    expect([v.balanced, v.bothPositive, v.ok]).toEqual([true, false, false]);
    expect(v.message).toContain("ikkala summa ham noldan katta");
  });
  it("ikkalasi ham bo'sh", () => {
    const v = validateMixed(st("", ""), T);
    expect([v.sum, v.ok]).toEqual([0, false]);
    expect(v.message).toBe("Farq: 300 000 so'm kam");
  });
  it("jami 0 — hech qachon ok bo'lmaydi (0 = 0 tuzoq'i)", () => {
    expect(validateMixed(st("", ""), 0).ok).toBe(false);
  });
});

describe("⚠️ DASTAFKA taqqoslash summasini O'ZGARTIRMAYDI (qoida 2026-08-04 da teskari bo'lgan)", () => {
  const T = 500_000;                    // sotuv summasi — dastafka UNING ICHIDA
  const st = (cash: string, card: string): MixedState => ({ cash, card, cashTouched: true, cardTouched: true });

  it("dastafkasiz: 200 000 + 300 000 = 500 000 ✓", () => {
    expect(validateMixed(st("200 000", "300 000"), T).ok).toBe(true);
  });
  it("dastafka BOR: taqqoslash summasi O'SHA-O'SHA 500 000 (50 000 qo'shilmaydi)", () => {
    // eski qoida bo'lsa 550 000 kutilardi va naqd+karta HECH QACHON to'g'ri bo'lmasdi
    expect(validateMixed(st("200 000", "300 000"), T).ok).toBe(true);
    expect(deliveryGoods(T, "50 000")).toBe(450_000);       // tovar savdosi — HOSILA
    expect(deliveryPayload("50 000")).toEqual({ delivery_amount: "50000" });
  });
  it("avtomatik qoldiq ham SOTUV summasidan hisoblanadi", () => {
    const s = applyMixedEdit(emptyMixed, "cash", "200000", T);
    expect(s.card).toBe("300 000");                          // 550 000 − 200 000 EMAS
  });
});
