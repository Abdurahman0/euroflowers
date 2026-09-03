import { describe, expect, it } from "vitest";
import { customSalePayload } from "./customCatalog";
import { buildSellPayload } from "./api";

describe("customSalePayload — maxsus katalog sotuvi", () => {
  it("eng oddiy holat: dona narxi + to'lov turi", () => {
    expect(customSalePayload({ quantity: 1, unitPrice: "1500000", payment: "cash" })).toEqual({
      quantity: 1, sale_price: "1500000.00", payment_type: "cash",
    });
  });
  it("⚠️ DONA narxi yuboriladi, jami EMAS (backend quantity ga ko'paytiradi)", () => {
    const p = customSalePayload({ quantity: 3, unitPrice: 500000, payment: "card" });
    expect(p.sale_price).toBe("500000.00");
    expect(p.quantity).toBe(3);
  });
  it("chegirma sababi faqat yozilgan bo'lsa ketadi", () => {
    expect(customSalePayload({ quantity: 1, unitPrice: 1, payment: "cash", discountReason: "  " }))
      .not.toHaveProperty("discount_reason");
    expect(customSalePayload({ quantity: 1, unitPrice: 1, payment: "cash", discountReason: " Doimiy mijoz " }).discount_reason)
      .toBe("Doimiy mijoz");
  });
  it("mijoz FAQAT id bo'yicha — yangi mijoz ikki marta yaratilmasin", () => {
    expect(customSalePayload({ quantity: 1, unitPrice: 1, payment: "cash", customerId: 42 }).customer).toBe(42);
    for (const bad of [null, undefined, 0, NaN]) {
      expect(customSalePayload({ quantity: 1, unitPrice: 1, payment: "cash", customerId: bad as number }))
        .not.toHaveProperty("customer");
    }
  });
  it("buzuq soni — kamida 1", () => {
    expect(customSalePayload({ quantity: 0, unitPrice: 1, payment: "cash" }).quantity).toBe(1);
    expect(customSalePayload({ quantity: -5, unitPrice: 1, payment: "cash" }).quantity).toBe(1);
    expect(customSalePayload({ quantity: 2.7, unitPrice: 1, payment: "cash" }).quantity).toBe(2);
  });
  it("narx bo'sh bo'lsa 0.00 (server 400 beradi — jimgina 'sotildi' bo'lib qolmaydi)", () => {
    expect(customSalePayload({ quantity: 1, unitPrice: "", payment: "cash" }).sale_price).toBe("0.00");
  });

  it("⚠️ tana `buildSellPayload` dan o'tganda MAYDONLAR YO'QOLMAYDI", () => {
    // buildSellPayload OQ RO'YXAT bo'yicha quradi — yangi maydon unutilsa jimgina tushib qolardi
    const body = buildSellPayload(customSalePayload({
      quantity: 2, unitPrice: "750000", payment: "card", discountReason: "Aksiya", customerId: 7,
    }));
    expect(body).toEqual({
      quantity: 2, sale_price: "750000.00", payment_type: "card", discount_reason: "Aksiya", customer: 7,
    });
  });
  it("1 dona — `quantity` yuborilmaydi (sukut qiymat)", () => {
    expect(buildSellPayload(customSalePayload({ quantity: 1, unitPrice: "100", payment: "cash" })))
      .toEqual({ sale_price: "100.00", payment_type: "cash" });
  });
});
