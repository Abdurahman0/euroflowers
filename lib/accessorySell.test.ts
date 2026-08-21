import { describe, it, expect } from "vitest";
import { mixedSellPayload, validateMixed, emptyMixed, type MixedState } from "./mixedPayment";

// Aksessuar sotuvi — ARALASH to'lov (backend 21.08.2026: PackagingSellRequest ichida
// `cash_amount` va `card_amount`). Yig'indi sotuv summasiga TENG bo'lishi shart.
const st = (cash: string, card: string): MixedState => ({ cash, card, cashTouched: true, cardTouched: true });

describe("AS1 — ajratma payloadi", () => {
  it("naqd 30 000 + karta 50 000 = 80 000 → ikkala summa ham yuboriladi", () => {
    expect(mixedSellPayload(true, st("30 000", "50 000"), 80000)).toEqual({ cash_amount: "30000", card_amount: "50000" });
  });

  it("bir tomoni NOL bo'lsa aralash EMAS — payload yo'q, operator «Naqd»/«Karta»ga yo'naltiriladi", () => {
    expect(mixedSellPayload(true, st("80 000", "0"), 80000)).toBeNull();
    expect(validateMixed(st("80 000", "0"), 80000).message).toContain("ikkala summa ham noldan katta");
  });

  it("yig'indi KAM bo'lsa payload YO'Q (null) — sotuv yuborilmaydi", () => {
    expect(mixedSellPayload(true, st("30 000", "40 000"), 80000)).toBeNull();
  });

  it("yig'indi ORTIQ bo'lsa ham payload YO'Q", () => {
    expect(mixedSellPayload(true, st("60 000", "40 000"), 80000)).toBeNull();
  });

  it("aralash EMAS bo'lsa ajratma kalitlari umuman qo'shilmaydi", () => {
    expect(mixedSellPayload(false, emptyMixed, 80000)).toEqual({});
  });
});

describe("AS2 — ekrandagi tekshiruv sotuv summasiga bog'langan", () => {
  it("soni × narx o'zgarsa eski ajratma endi to'g'ri kelmaydi", () => {
    const s = st("30 000", "50 000");
    expect(validateMixed(s, 80000).ok).toBe(true);
    // 2 dona × 80 000 = 160 000 — o'sha ajratma endi kam
    expect(validateMixed(s, 160000).ok).toBe(false);
    expect(validateMixed(s, 160000).message).toContain("kam");
  });
});
