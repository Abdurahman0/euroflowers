import { describe, it, expect } from "vitest";
import { computeIssueEditDelta, normalizeMaterials, catalogSalaryPayload } from "./inventory";

// KATALOG_TAHRIR_MATERIAL_VA_CHIQIM.md — §3 mode-aware salary, §2 material per-item, §4 issue-edit delta.

describe("CE1 — issue-edit delta formatter (Skladda: X→Y · Floristda: X→Y)", () => {
  // issue: sklad→florist. 30→50 (Δ+20): sklad −20, florist +20 (spec misoli).
  it("issue increased 30→50: sklad −20, florist +20", () => {
    expect(computeIssueEditDelta("issue", 30, 50, 300, 30)).toEqual({
      sklad: { from: 300, to: 280 },
      florist: { from: 30, to: 50 },
    });
  });
  // keyin 50→20 (Δ−30): sklad +30, florist −30 (spec ikkinchi misoli).
  it("issue decreased 50→20: sklad +30, florist −30", () => {
    expect(computeIssueEditDelta("issue", 50, 20, 280, 50)).toEqual({
      sklad: { from: 280, to: 310 },
      florist: { from: 50, to: 20 },
    });
  });
  // return: florist→sklad. Ko'paytirish → sklad +Δ, florist −Δ (teskari yo'nalish).
  it("return increased 10→25: sklad +15, florist −15", () => {
    expect(computeIssueEditDelta("return", 10, 25, 300, 40)).toEqual({
      sklad: { from: 300, to: 315 },
      florist: { from: 40, to: 25 },
    });
  });
  // waste: skladga TEGMAYDI (yo'q bo'ladi) — faqat florist −Δ.
  it("waste increased 5→12: sklad untouched (null), florist −7", () => {
    expect(computeIssueEditDelta("waste", 5, 12, 300, 20)).toEqual({
      sklad: null,
      florist: { from: 20, to: 13 },
    });
  });
  // qoldiq noma'lum (fetch bo'lmagan) → o'sha qator ko'rsatilmaydi (null).
  it("unknown current balances → that line is null", () => {
    expect(computeIssueEditDelta("issue", 30, 50, null, null)).toEqual({ sklad: null, florist: null });
  });
});

describe("CE2 — material payload: PER-ITEM quantity (server × quantity_total), dedup birlashadi", () => {
  it("preserves per-single-item quantity verbatim (no ×qty here)", () => {
    expect(normalizeMaterials([{ packaging: 12, quantity: 1 }, { packaging: 15, quantity: 2 }]))
      .toEqual([{ packaging: 12, quantity: 1 }, { packaging: 15, quantity: 2 }]);
  });
  it("same packaging twice → summed into one row", () => {
    expect(normalizeMaterials([{ packaging: 12, quantity: 1 }, { packaging: 12, quantity: 3 }]))
      .toEqual([{ packaging: 12, quantity: 4 }]);
  });
  it("packaging 0 / falsy dropped", () => {
    expect(normalizeMaterials([{ packaging: 0, quantity: 5 }, { packaging: 12, quantity: 2 }]))
      .toEqual([{ packaging: 12, quantity: 2 }]);
  });
});

describe("CE3 — salary payload is mode-aware (guards the §3 contract at the unit level)", () => {
  it("standard never sends the key", () => {
    for (const v of ["", "0", "50000", null, undefined] as const) {
      expect(catalogSalaryPayload(v, "standard")).toEqual({});
    }
  });
  it("custom keeps empty→omit, 0→\"0\", value→value", () => {
    expect(catalogSalaryPayload("", "custom")).toEqual({});
    expect(catalogSalaryPayload("0", "custom")).toEqual({ florist_salary_amount: "0" });
    expect(catalogSalaryPayload("50000", "custom")).toEqual({ florist_salary_amount: "50000" });
  });
});
