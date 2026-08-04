import { describe, it, expect } from "vitest";
import {
  buildSalesQuery, salesFiltersToParams, salesPageCount, totalsView,
  discountView, isDiscounted, saleNum, SALES_PAGE_SIZE_MAX,
} from "./catalogSales";
import { fmtLocalTime, fmtLocalDate, readIsoParts } from "./format";
import type { CatalogSaleRow } from "./types";

// jonli serverdan olingan HAQIQIY qator (chegirmali)
const ROW: CatalogSaleRow = {
  id: 238, catalog_item: 165, catalog_name: "savat",
  image_url: "https://…/photo.jpg", arrangement_type: "basket",
  volume: "small", volume_label: "Kichik", catalog_kind: "standard",
  branch_name: "Toshkent (asosiy filial)", florist_name: "Abror",
  quantity: 1,
  listed_unit_price: "250000.00", sold_unit_price: "150000.00",
  listed_total: 250000.0, sale_total: 150000.0,          // ⚠️ jonli: NUMBER
  discount_amount: "100000.00", discount_percent: "40.00", discount_reason: "mijoz",
  payment_type: "card", payment_label: "Karta",
  sale_image_url: "", sold_by: "Admin EuroFlowers",
  created_at: "2026-08-03T22:10:39.551452+05:00",
};

describe("saleNum — jonli javob turi ARALASH (string ham, number ham)", () => {
  it("string decimal", () => expect(saleNum("250000.00")).toBe(250000));
  it("⚠️ number (listed_total/sale_total shunday keladi)", () => expect(saleNum(250000.0)).toBe(250000));
  it("null/undefined → 0", () => {
    expect(saleNum(null)).toBe(0);
    expect(saleNum(undefined)).toBe(0);
  });
});

describe("buildSalesQuery — hamma filtr SERVERDA, bo'shlari yuborilmaydi", () => {
  it("filtrsiz → faqat page_size", () => {
    expect(buildSalesQuery({})).toEqual({ page_size: 25 });
  });
  it("hamma filtr birga — bir-birini o'chirmaydi", () => {
    expect(buildSalesQuery({ dateFrom: "2026-08-01", dateTo: "2026-08-03", payment: "cash", search: "buket", page: 2 }))
      .toEqual({ date_from: "2026-08-01", date_to: "2026-08-03", payment_type: "cash", search: "buket", page: 2, page_size: 25 });
  });
  it("bo'sh qidiruv / bo'shliq → search kaliti YO'Q", () => {
    expect("search" in buildSalesQuery({ search: "   " })).toBe(false);
  });
  it("«hammasi» to'lov turi → payment_type YO'Q", () => {
    expect("payment_type" in buildSalesQuery({ payment: "" })).toBe(false);
  });
  it("1-sahifa → page kaliti YO'Q (ortiqcha parametr)", () => {
    expect("page" in buildSalesQuery({ page: 1 })).toBe(false);
  });
  it("⚠️ page_size 100 dan oshmaydi (spec chegarasi)", () => {
    expect(buildSalesQuery({ pageSize: 500 }).page_size).toBe(SALES_PAGE_SIZE_MAX);
    expect(buildSalesQuery({ pageSize: 0 }).page_size).toBe(1);
  });
});

describe("salesFiltersToParams — URL'da saqlanadi", () => {
  it("bo'shlari tushiriladi", () => expect(salesFiltersToParams({})).toEqual({}));
  it("hammasi birga", () => {
    expect(salesFiltersToParams({ dateFrom: "2026-08-01", payment: "debt", search: "gul", page: 3 }))
      .toEqual({ date_from: "2026-08-01", payment: "debt", q: "gul", page: "3" });
  });
});

describe("salesPageCount", () => {
  it("20 ta / 25 → 1 sahifa", () => expect(salesPageCount(20, 25)).toBe(1));
  it("51 ta / 25 → 3 sahifa", () => expect(salesPageCount(51, 25)).toBe(3));
  it("0 ta → 1 sahifa (bo'sh holat)", () => expect(salesPageCount(0, 25)).toBe(1));
});

describe("totalsView — server bergani AYNAN, qayta hisoblanmaydi", () => {
  it("jonli jamilar", () => {
    expect(totalsView({
      sales_count: 20, quantity: 21, revenue: 7430000.0, discount_total: 200000.0,
      cash_total: 3480000.0, card_total: 3950000.0, debt_total: 0.0,
    })).toEqual({ count: 20, quantity: 21, revenue: 7430000, discount: 200000, cash: 3480000, card: 3950000, debt: 0 });
  });
  it("jamilar yo'q → nollar (yiqilmaydi)", () => {
    expect(totalsView(null)).toEqual({ count: 0, quantity: 0, revenue: 0, discount: 0, cash: 0, card: 0, debt: 0 });
  });
});

describe("discountView — FAQAT discount_amount > 0 bo'lganda chizilgan narx", () => {
  it("chegirmali qator: asl 250 000 chizilgan, haqiqiy 150 000, sabab bor", () => {
    expect(discountView(ROW)).toEqual({ listed: 250000, sold: 150000, reason: "mijoz" });
    expect(isDiscounted(ROW)).toBe(true);
  });
  it("chegirmasiz → listed null (chizilgan narx UMUMAN chiqmaydi)", () => {
    const plain = { ...ROW, discount_amount: "0.00", discount_reason: "", listed_total: 150000, sale_total: 150000 };
    expect(discountView(plain)).toEqual({ listed: null, sold: 150000, reason: "" });
    expect(isDiscounted(plain)).toBe(false);
  });
  it("chegirma bor, sabab bo'sh → sabab qatori chizilmaydi", () => {
    expect(discountView({ ...ROW, discount_reason: "  " }).reason).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ MINTAQA — eng muhim tekshiruv
// ─────────────────────────────────────────────────────────────────────────────
describe("fmtLocalTime — server yozgan vaqt AYNAN, brauzer mintaqasi TA'SIR QILMAYDI", () => {
  it("⚠️ 22:10 sotuvi ERTANGI kunga o'tmaydi (spec misoli)", () => {
    expect(fmtLocalTime("2026-08-03T22:10:39.551452+05:00")).toBe("03.08 · 22:10");
  });
  it("⚠️ tunning yarmi — 00:30 KECHAGI kunga tushmaydi", () => {
    expect(fmtLocalTime("2026-08-04T00:30:00+05:00")).toBe("04.08 · 00:30");
  });
  it("23:59 chegarasi", () => {
    expect(fmtLocalTime("2026-08-03T23:59:00+05:00")).toBe("03.08 · 23:59");
  });
  it("offset boshqacha bo'lsa ham SATRDAGI vaqt olinadi (o'girilmaydi)", () => {
    expect(fmtLocalTime("2026-08-03T22:10:00Z")).toBe("03.08 · 22:10");
  });
  it("fmtLocalDate ham xuddi shunday", () => {
    expect(fmtLocalDate("2026-08-03T22:10:39.551452+05:00")).toBe("03.08.2026");
  });
  it("bo'sh → «—»", () => {
    expect(fmtLocalTime(null)).toBe("—");
    expect(fmtLocalDate(undefined)).toBe("—");
  });
  it("readIsoParts buzuq satrda null (chaqiruvchi eski yo'lga tushadi)", () => {
    expect(readIsoParts("salom")).toBeNull();
    expect(readIsoParts("")).toBeNull();
  });
  it("⚠️ BARQARORLIK: xohlagan mintaqada bir xil natija", () => {
    // Node TZ ni jarayon boshida o'qiydi, shuning uchun mantiqni to'g'ridan-to'g'ri
    // tekshiramiz: satr komponentlari Date obyektiga UMUMAN bog'liq emas.
    const p = readIsoParts("2026-08-03T22:10:39.551452+05:00")!;
    expect([p.y, p.mo, p.d, p.h, p.mi]).toEqual([2026, 8, 3, 22, 10]);
  });
});
