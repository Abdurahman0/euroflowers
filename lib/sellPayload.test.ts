import { describe, it, expect } from "vitest";
import { buildSellFormData, buildSellPayload } from "./api";

/**
 * ⚠️ ASL NOSOZLIK SHU YERDA EDI: tana oq ro'yxat bo'yicha qurilib, ro'yxatda yo'q
 * kalitlar JIMGINA tashlanardi. Serverga faqat {"payment_type":"mixed"} ketardi.
 * Quyidagi testlar har bir hujjatlashtirilgan maydonning YETIB BORISHINI qulflaydi.
 */
describe("buildSellPayload — ARALASH (asl nosozlik)", () => {
  it("⚠️ naqd va karta YETIB BORADI (ilgari yo'qolardi)", () => {
    expect(buildSellPayload({ payment_type: "mixed", cash_amount: "75000", card_amount: "75000" }))
      .toEqual({ payment_type: "mixed", cash_amount: "75000", card_amount: "75000" });
  });
  it("dastafka ham yetib boradi va sotuv summasiga QO'SHILMAYDI (u shunchaki uzatiladi)", () => {
    const p = buildSellPayload({ payment_type: "mixed", cash_amount: "300000", card_amount: "500000", delivery_amount: "50000" });
    expect(p).toEqual({ payment_type: "mixed", cash_amount: "300000", card_amount: "500000", delivery_amount: "50000" });
    // spec 2-misoli: cash + card = 800 000, dastafka ICHIDA
    expect(Number(p.cash_amount) + Number(p.card_amount)).toBe(800_000);
  });
  it("aralash BO'LMASA kalitlar UMUMAN yuborilmaydi", () => {
    expect(buildSellPayload({ payment_type: "cash" })).toEqual({ payment_type: "cash" });
  });
});

describe("buildSellPayload — QARZ (xuddi shunday buzilgan edi)", () => {
  it("⚠️ walk-in mijoz maydonlari YETIB BORADI", () => {
    expect(buildSellPayload({ payment_type: "debt", customer_name: "Aziz", customer_phone: "901112233", debt_note: "Juma kuni" }))
      .toEqual({ payment_type: "debt", customer_name: "Aziz", customer_phone: "901112233", debt_note: "Juma kuni" });
  });
  it("mavjud mijoz — `customer` id", () => {
    expect(buildSellPayload({ payment_type: "debt", customer: 42 })).toEqual({ payment_type: "debt", customer: 42 });
  });
});

describe("buildSellPayload — spec'dagi qolgan maydonlar (§3)", () => {
  it("hammasi bir vaqtda", () => {
    expect(buildSellPayload({
      quantity: 3, sale_price: "300000.00", payment_type: "mixed",
      cash_amount: "400000", card_amount: "500000", delivery_amount: "50000",
      discount_reason: "Doimiy mijoz", sold_at: "2026-08-05T15:30:00+05:00",
      decoration_florist: 4, materials: [{ packaging: 7, quantity: 1 }],
      sale_image_url: "https://x/y.jpg", reservation: 9,
    })).toEqual({
      quantity: 3, sale_price: "300000.00", payment_type: "mixed",
      cash_amount: "400000", card_amount: "500000", delivery_amount: "50000",
      discount_reason: "Doimiy mijoz", sold_at: "2026-08-05T15:30:00+05:00",
      decoration_florist: 4, materials: [{ packaging: 7, quantity: 1 }],
      sale_image_url: "https://x/y.jpg", reservation: 9,
    });
  });
  it("⚠️ `sale_price` BIR DONA narxi — jami EMAS (spec 3-misoli)", () => {
    // 3 ta × 300 000 = 900 000; payload'da 300 000 turishi SHART
    const p = buildSellPayload({ quantity: 3, sale_price: "300000" });
    expect(p.sale_price).toBe("300000");
    expect(p.quantity).toBe(3);
  });
  it("`sale_price` berilmasa — kalit yo'q (katalog narxi olinadi)", () => {
    expect(buildSellPayload({ quantity: 2 })).toEqual({ quantity: 2 });
  });
  it("quantity 1 — sukut, yuborilmaydi", () => {
    expect(buildSellPayload({ quantity: 1, payment_type: "cash" })).toEqual({ payment_type: "cash" });
  });
});

describe("buildSellPayload — BO'SH qiymat yuborilmaydi", () => {
  it("bo'sh/undefined kalitlar UMUMAN tushmaydi", () => {
    expect(buildSellPayload({})).toEqual({});
    expect(buildSellPayload()).toEqual({});
    expect(buildSellPayload({ discount_reason: "", sale_image_url: "", customer_name: "" })).toEqual({});
  });
  it("⚠️ dastafka «0» — ATAYLAB yozilgan bo'lsa YUBORILADI", () => {
    expect(buildSellPayload({ delivery_amount: "0" })).toEqual({ delivery_amount: "0" });
    expect(buildSellPayload({ delivery_amount: "" })).toEqual({});
  });
  it("bo'sh material massivi yuborilmaydi", () => {
    expect(buildSellPayload({ materials: [] })).toEqual({});
  });
});

/* ===== TERMINAL — backend 28.08.2026 ===== */

describe("terminal to'lov", () => {
  it("faqat payment_type ketadi — cash_amount/card_amount YUBORILMAYDI", () => {
    const body = buildSellPayload({ quantity: 1, sale_price: "250000", payment_type: "terminal" });
    expect(body).toEqual({ sale_price: "250000", payment_type: "terminal" });
    expect(body).not.toHaveProperty("cash_amount");
    expect(body).not.toHaveProperty("card_amount");
  });
  it("aralash avvalgidek ikkala summani olib ketadi", () => {
    expect(buildSellPayload({ sale_price: "250000", payment_type: "mixed", cash_amount: "100000", card_amount: "150000" })).toEqual({
      sale_price: "250000", payment_type: "mixed", cash_amount: "100000", card_amount: "150000",
    });
  });
});

/* ===== MULTIPART — sotuv rasmi FAYL sifatida (operator roli uchun) ===== */

describe("buildSellFormData", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "sotuv.jpg", { type: "image/jpeg" });
  const entries = (fd: FormData) => Array.from(fd.entries()).map(([k, v]) => [k, v instanceof File ? `FILE:${v.name}` : v]);

  it("oddiy maydonlar + fayl", () => {
    const fd = buildSellFormData({ quantity: 2, sale_price: "250000", payment_type: "terminal" }, file);
    expect(entries(fd)).toEqual([
      ["quantity", "2"], ["sale_price", "250000"], ["payment_type", "terminal"], ["sale_image", "FILE:sotuv.jpg"],
    ]);
  });
  it("⚠️ materials DRF'ning HTML-ro'yxat ko'rinishida ketadi (jonli tekshirilgan)", () => {
    const fd = buildSellFormData({ materials: [{ packaging: 79, quantity: 2 }, { packaging: 80, quantity: 1 }] }, file);
    expect(entries(fd)).toEqual([
      ["materials[0]packaging", "79"], ["materials[0]quantity", "2"],
      ["materials[1]packaging", "80"], ["materials[1]quantity", "1"],
      ["sale_image", "FILE:sotuv.jpg"],
    ]);
  });
  it("aralash to'lov va qarz maydonlari ham yetib boradi", () => {
    const fd = buildSellFormData({ payment_type: "mixed", cash_amount: "100000", card_amount: "150000", customer_name: "Ali", debt_note: "juma" }, file);
    const o = Object.fromEntries(entries(fd));
    expect(o).toMatchObject({ payment_type: "mixed", cash_amount: "100000", card_amount: "150000", customer_name: "Ali", debt_note: "juma" });
  });
  it("bo'sh maydonlar multipart'ga ham tushmaydi", () => {
    const fd = buildSellFormData({ quantity: 1 }, file);
    expect(entries(fd)).toEqual([["sale_image", "FILE:sotuv.jpg"]]); // quantity 1 — sukut, yuborilmaydi
  });
});
