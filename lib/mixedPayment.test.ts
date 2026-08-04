import { describe, it, expect } from "vitest";
import {
  parseMoney, formatMoneyInput, applyMixedEdit, recalcOnTotalChange,
  validateMixed, mixedSellPayload, paymentBreakdownLabel, emptyMixed, type MixedState,
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
