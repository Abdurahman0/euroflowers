import { describe, it, expect } from "vitest";
import { catalogFlowRules, normalizeComposition, catalogRateMissing, catalogSalaryPayload } from "./inventory";

// euroflowers_frontend_update.md §8 (custom inventory oqimi) va §9 (standard inventory oqimi).
// ⚠️ ASOSIY QOIDA: custom katalog gulni TO'G'RIDAN-TO'G'RI stock_batch qoldig'idan yechadi —
//    florist tanlangan bo'lsa HAM florist balansiga tegilmaydi.

describe("CF1 — §8 custom: florist tanlansa ham florist-balans oqimi ISHLAMAYDI", () => {
  it("custom + florist → floristIssueMode false (gul skladdan, soni bilan)", () => {
    const r = catalogFlowRules("custom", 5, 0);
    expect(r.floristIssueMode).toBe(false);
    expect(r.stemsRequired).toBe(true);
  });

  it("custom, florist yo'q → baribir soni majburiy", () => {
    expect(catalogFlowRules("custom", 0, 0).stemsRequired).toBe(true);
  });

  it("custom + florist → hajm so'raladi (oylik hajm tarifidan olinishi mumkin)", () => {
    expect(catalogFlowRules("custom", 5, 0).volumeRequired).toBe(true);
  });

  it("custom, floristsiz → hajm majburiy emas", () => {
    expect(catalogFlowRules("custom", 0, 0).volumeRequired).toBe(false);
  });
});

describe("CF2 — §9 standard: florist balansi oqimi SAQLANADI", () => {
  it("standard + florist → floristIssueMode true, soni yozilmaydi", () => {
    const r = catalogFlowRules("standard", 5, 0);
    expect(r.floristIssueMode).toBe(true);
    expect(r.stemsRequired).toBe(false);
  });

  it("standard: hajm HAR DOIM majburiy (florist bo'lmasa ham)", () => {
    expect(catalogFlowRules("standard", 0, 0).volumeRequired).toBe(true);
    expect(catalogFlowRules("standard", 5, 0).volumeRequired).toBe(true);
  });

  it("standardda oylik QO'LDA kiritilmaydi (hajm tarifidan), custom'da kiritiladi", () => {
    expect(catalogFlowRules("standard", 5, 0).salaryEditable).toBe(false);
    expect(catalogFlowRules("custom", 5, 0).salaryEditable).toBe(true);
  });
});

describe("CF3 — filial katalogi §8 dan keyin ham o'zgarmaydi", () => {
  it("filial (branch>0) → soni majburiy, florist oqimi yo'q", () => {
    const r = catalogFlowRules("standard", 0, 3);
    expect(r.stemsRequired).toBe(true);
    expect(r.floristIssueMode).toBe(false);
  });
});

describe("CF4 — §8: bir xil stock_batch bitta rowga jamlanadi", () => {
  it("ikki marta tanlangan partiya → bitta qator, sonlar qo'shiladi", () => {
    expect(
      normalizeComposition([
        { stock_batch: 18, quantity_stems: 10 },
        { stock_batch: 22, quantity_stems: 15 },
        { stock_batch: 18, quantity_stems: 5 },
      ]),
    ).toEqual([
      { stock_batch: 18, quantity_stems: 15 },
      { stock_batch: 22, quantity_stems: 15 },
    ]);
  });
});

describe("CF5 — §8: florist_salary_amount qo'lda berilsa AYNAN ketadi, bo'sh bo'lsa kalit tushadi", () => {
  it("qo'lda 70000 → payloadda aynan shu", () => {
    expect(catalogSalaryPayload("70000")).toEqual({ florist_salary_amount: "70000" });
  });

  it("bo'sh → kalit YO'Q (backend hajm tarifidan oladi)", () => {
    expect(catalogSalaryPayload("")).toEqual({});
  });

  it("custom'da tarif yo'qligi saqlashni BLOKLAMAYDI (haq qo'lda beriladi)", () => {
    expect(catalogRateMissing("custom", 5, "large", "bouquet", [])).toBe(false);
    expect(catalogRateMissing("standard", 5, "large", "bouquet", [])).toBe(true);
  });
});
