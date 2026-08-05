import { describe, it, expect } from "vitest";
import { ApiError } from "./api";

/**
 * ⚠️ SERVER XATOSINING IKKI SHAKLI.
 *
 * FRONTEND_CATALOG_MIXED_SALE_API.md maydon xatolarini YALANG'OCH SATR bilan
 * ko'rsatadi: {"cash_amount": "Aralash to'lovda naqd va karta summasini kiriting"}.
 * DRF esa odatda MASSIV beradi: {"cash_amount": ["..."]}.
 *
 * Ikkalasi ham AYNAN bir xil o'qilishi shart — aks holda operator `[object Object]`
 * yoki harflarga bo'linib ketgan matn ko'rardi (yoki umuman hech narsa).
 */
describe("ApiError.fieldErrors — SATR ham, MASSIV ham", () => {
  const fe = (body: unknown) => new ApiError(400, body).fieldErrors;

  it("spec shakli — YALANG'OCH SATR", () => {
    expect(fe({ cash_amount: "Aralash to'lovda naqd va karta summasini kiriting" }))
      .toEqual({ cash_amount: "Aralash to'lovda naqd va karta summasini kiriting" });
  });
  it("DRF shakli — MASSIV: AYNAN o'sha natija", () => {
    expect(fe({ cash_amount: ["Aralash to'lovda naqd va karta summasini kiriting"] }))
      .toEqual({ cash_amount: "Aralash to'lovda naqd va karta summasini kiriting" });
  });
  it("⚠️ harflarga bo'linib ketmaydi (satr massiv deb o'qilsa shunday bo'lardi)", () => {
    const f = fe({ cash_amount: "abc" })!;
    expect(f.cash_amount).toBe("abc");
    expect(Object.keys(f)).toEqual(["cash_amount"]);        // "0","1","2" EMAS
    expect(JSON.stringify(f)).not.toContain("object Object");
  });
  it("spec'dagi qolgan MAYDON xatolari — ular ham satr", () => {
    expect(fe({ delivery_amount: "Dastafka summasi sotuv summasidan kam bo'lishi kerak. Sotuv: 800000.00, dastafka: 900000" }))
      .toEqual({ delivery_amount: "Dastafka summasi sotuv summasidan kam bo'lishi kerak. Sotuv: 800000.00, dastafka: 900000" });
    expect(fe({ customer: "Qarzga sotishda mijozni tanlang yoki ism va telefon kiriting" }))
      .toEqual({ customer: "Qarzga sotishda mijozni tanlang yoki ism va telefon kiriting" });
  });
  it("`detail` MAYDON emas — fieldErrors'ga tushmaydi, xabarga chiqadi", () => {
    const e = new ApiError(400, { detail: "Naqd va karta yig'indisi olinadigan summaga teng emas. Olinadi: 800000.00 (shundan 50000 dastafka), kiritilgan: 750000.00" });
    expect(e.fieldErrors).toBeUndefined();
    expect(e.message).toContain("Olinadi: 800000.00");
  });
  it("`detail` va maydon BIRGA kelsa — ikkalasi ham o'z joyida", () => {
    const e = new ApiError(400, { detail: "umumiy", cash_amount: "maydon xatosi" });
    expect(e.fieldErrors).toEqual({ cash_amount: "maydon xatosi" });
    expect(e.message).toBe("umumiy");
  });
  it("ko'p elementli massiv birlashtiriladi", () => {
    expect(fe({ cash_amount: ["birinchi", "ikkinchi"] })).toEqual({ cash_amount: "birinchi ikkinchi" });
  });
  it("ichma-ich (materials) — nuqtali kalit", () => {
    expect(fe({ materials: [{ quantity: "Musbat son kiriting" }] }))
      .toEqual({ "materials.0.quantity": "Musbat son kiriting" });
  });
  it("maydonsiz javob — fieldErrors YO'Q, umumiy xabar beriladi", () => {
    expect(new ApiError(500, null).fieldErrors).toBeUndefined();
    expect(new ApiError(500, null).message).toContain("Server xatosi");
  });
});
