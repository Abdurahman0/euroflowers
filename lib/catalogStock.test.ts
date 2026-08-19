import { describe, it, expect } from "vitest";
import { deductionState, shouldOfferDeduct } from "./catalogStock";

/**
 * ⚠️ NEGA SINALADI: bu hisob noto'g'ri bo'lsa ekranda «skladdan kamaytirilmagan»
 * degan YOLG'ON ogohlantirish chiqadi va operator tugmani bosib skladni IKKINCHI
 * MARTA kamaytiradi. Xato jimgina emas — u haqiqiy gulni yo'q qiladi.
 */

describe("⚠️ MAYDON YO'Q ≠ QIYMAT NOL — jonli nosozlikning o'zagi", () => {
  /**
   * GET /api/catalog/ (ro'yxat) `quantity_stock_deducted` va `stock_deducted_at`
   * maydonlarini UMUMAN yubormaydi. Ilgari `?? ` bilan o'qilgani uchun natija 0
   * chiqib, 290 katalogdan 261 tasi «yechilmagan» ko'rinardi.
   */
  const listRow = { status: "sold", quantity_total: 4, quantity_sold: 4 };  // ikkala maydon YO'Q

  it("ikkala maydon KELMAGAN → known:false va pending 0 (ogohlantirish YO'Q)", () => {
    const d = deductionState(listRow);
    expect(d.known).toBe(false);
    expect(d.pending).toBe(0);
    expect(shouldOfferDeduct(listRow)).toBe(false);
  });

  it("⚠️ ESKI XULOSA bilan solishtirish: `?? ` yo'li 4 ta «kutilmoqda» berardi", () => {
    const eskiXulosa = Math.max(
      (listRow.quantity_sold ?? 0) -
        ((listRow as { quantity_stock_deducted?: number }).quantity_stock_deducted ??
          ((listRow as { stock_deducted_at?: string }).stock_deducted_at ? listRow.quantity_sold : 0)),
      0,
    );
    expect(eskiXulosa).toBe(4);                    // eski kod shunday deb yozardi
    expect(deductionState(listRow).pending).toBe(0); // endi jim turadi
  });

  it("⚠️ `null` — HAQIQIY qiymat, «server aytmadi» EMAS", () => {
    // detal javobi: hech qachon yechilmagan
    const d = deductionState({ status: "sold", quantity_total: 3, quantity_sold: 3, stock_deducted_at: null });
    expect(d.known).toBe(true);
    expect(d.deducted).toBe(0);
    expect(d.pending).toBe(3);       // BU YERDA ogohlantirish O'RINLI
    expect(shouldOfferDeduct({ status: "sold", quantity_total: 3, quantity_sold: 3, stock_deducted_at: null })).toBe(true);
  });
});

describe("detal javobi — aniq sonlar bilan", () => {
  it("jonli #539: sotilgan 4 / yechilgan 4 → kutilmoqda 0", () => {
    const d = deductionState({ status: "sold", quantity_total: 4, quantity_sold: 4, quantity_stock_deducted: 4, stock_deducted_at: "2026-08-19T20:07:42+05:00" });
    expect(d).toEqual({ known: true, sold: 4, deducted: 4, pending: 0 });
  });

  it("jonli #537: sotilgan 3 / yechilgan 9 (butun partiya) → manfiy EMAS, 0", () => {
    const d = deductionState({ status: "available", quantity_total: 9, quantity_sold: 3, quantity_stock_deducted: 9 });
    expect(d.pending).toBe(0);
    expect(d.pending).toBeGreaterThanOrEqual(0);
  });

  it("qisman yechilgan → qolgani ko'rsatiladi", () => {
    expect(deductionState({ quantity_total: 10, quantity_sold: 10, quantity_stock_deducted: 4 }).pending).toBe(6);
  });

  it("`quantity_stock_deducted: 0` — bu ANIQ nol, bilinadi", () => {
    const d = deductionState({ status: "sold", quantity_total: 2, quantity_sold: 2, quantity_stock_deducted: 0 });
    expect(d.known).toBe(true);
    expect(d.pending).toBe(2);
  });
});

describe("eski shakl — faqat sana bor", () => {
  it("sana bor → to'liq yechilgan deb qaraladi", () => {
    expect(deductionState({ quantity_sold: 5, stock_deducted_at: "2026-08-01T10:00:00+05:00" }).pending).toBe(0);
  });
  it("sana null → yechilmagan", () => {
    expect(deductionState({ quantity_sold: 5, stock_deducted_at: null }).pending).toBe(5);
  });
});

describe("chegara holatlari — yiqilmaydi", () => {
  it("item yo'q", () => {
    expect(deductionState(null)).toEqual({ known: false, sold: 0, deducted: 0, pending: 0 });
    expect(deductionState(undefined).known).toBe(false);
    expect(shouldOfferDeduct(null)).toBe(false);
  });
  it("sotilmagan yozuv — sotilgan 0, kutilmoqda 0", () => {
    expect(deductionState({ status: "available", quantity_total: 5, quantity_sold: 0, stock_deducted_at: null }).pending).toBe(0);
  });
  it("eski yozuv: `quantity_sold` yo'q, status `sold` → jami sotilgan deb olinadi", () => {
    expect(deductionState({ status: "sold", quantity_total: 3, stock_deducted_at: null }).sold).toBe(3);
  });
});
