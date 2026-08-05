import { describe, it, expect } from "vitest";
import {
  readRange, rangeToParams, createdAtQuery, inDateRange, rangeLabel, hasRange, EMPTY_RANGE,
} from "./supplierRange";

describe("readRange — URL o'qish", () => {
  it("bo'sh URL → filtrsiz", () => {
    expect(readRange("")).toEqual({ from: "", to: "" });
    expect(hasRange(readRange(""))).toBe(false);
  });
  it("ikkala kalitni o'qiydi", () => {
    expect(readRange("?date_from=2026-08-02&date_to=2026-08-05")).toEqual({ from: "2026-08-02", to: "2026-08-05" });
  });
  it("faqat bittasi ham yetarli", () => {
    expect(readRange("?date_from=2026-08-02")).toEqual({ from: "2026-08-02", to: "" });
    expect(readRange("?date_to=2026-08-05")).toEqual({ from: "", to: "2026-08-05" });
  });
  it("buzuq sana E'TIBORGA OLINMAYDI (bo'sh ro'yxat o'rniga filtrsiz)", () => {
    expect(readRange("?date_from=kecha&date_to=2026-13-99")).toEqual({ from: "", to: "" });
    expect(readRange("?date_from=2026-8-2")).toEqual({ from: "", to: "" });
  });
  it("teskari oraliq ALMASHTIRILADI — jimgina bo'sh natija bermaydi", () => {
    expect(readRange("?date_from=2026-08-05&date_to=2026-08-02")).toEqual({ from: "2026-08-02", to: "2026-08-05" });
  });
  it("boshqa kalitlarga tegmaydi", () => {
    expect(readRange("?supplier=22&date_from=2026-08-02&tab=x")).toEqual({ from: "2026-08-02", to: "" });
  });
});

describe("rangeToParams — URL yozish", () => {
  it("bo'sh oraliq HECH NARSA yozmaydi (sukut = butun tarix)", () => {
    expect(rangeToParams(EMPTY_RANGE)).toEqual({});
  });
  it("to'ldirilgani yoziladi", () => {
    expect(rangeToParams({ from: "2026-08-02", to: "2026-08-05" }))
      .toEqual({ date_from: "2026-08-02", date_to: "2026-08-05" });
    expect(rangeToParams({ from: "", to: "2026-08-05" })).toEqual({ date_to: "2026-08-05" });
  });
  it("aylanma: yozilgan URL qayta o'qilganda AYNAN o'zi", () => {
    const r = { from: "2026-07-01", to: "2026-07-31" };
    expect(readRange("?" + new URLSearchParams(rangeToParams(r)).toString())).toEqual(r);
  });
});

describe("createdAtQuery — SERVER filtri (stock-movements)", () => {
  it("bo'sh oraliq → parametr yuborilmaydi", () => {
    expect(createdAtQuery(EMPTY_RANGE)).toEqual({});
  });
  it("`after` XOM yuboriladi (server kun boshidan oladi)", () => {
    expect(createdAtQuery({ from: "2026-08-02", to: "" })).toEqual({ created_at_after: "2026-08-02" });
  });
  it("⚠️ `before` EKSKLYUZIV — tanlangan kun qamralishi uchun KEYINGI kun", () => {
    // jonli tekshiruv: created_at_before=2026-08-05 → 08-05 dagi 27 partiya CHIQIB KETGAN edi
    expect(createdAtQuery({ from: "", to: "2026-08-05" })).toEqual({ created_at_before: "2026-08-06" });
  });
  it("oy/yil chegarasida ham to'g'ri suriladi", () => {
    expect(createdAtQuery({ from: "", to: "2026-08-31" }).created_at_before).toBe("2026-09-01");
    expect(createdAtQuery({ from: "", to: "2026-12-31" }).created_at_before).toBe("2027-01-01");
    expect(createdAtQuery({ from: "", to: "2028-02-29" }).created_at_before).toBe("2028-03-01");
  });
  it("bitta kun tanlansa — o'sha kun to'liq qamraladi", () => {
    expect(createdAtQuery({ from: "2026-08-04", to: "2026-08-04" }))
      .toEqual({ created_at_after: "2026-08-04", created_at_before: "2026-08-05" });
  });
  it("⚠️ server TANIMAYDIGAN kalitlar YUBORILMAYDI (received_at_after/date_from — jimgina no-op)", () => {
    const q = createdAtQuery({ from: "2026-08-02", to: "2026-08-05" });
    expect(Object.keys(q).sort()).toEqual(["created_at_after", "created_at_before"]);
  });
});

describe("inDateRange — KLIENT filtri (received_at / paid_at)", () => {
  const r = { from: "2026-08-02", to: "2026-08-04" };
  it("filtrsiz — hamma yozuv o'tadi", () => {
    expect(inDateRange("2020-01-01", EMPTY_RANGE)).toBe(true);
  });
  it("ikkala chek ham INKLYUZIV", () => {
    expect(inDateRange("2026-08-02", r)).toBe(true);
    expect(inDateRange("2026-08-04", r)).toBe(true);
  });
  it("chegaradan tashqari", () => {
    expect(inDateRange("2026-08-01", r)).toBe(false);
    expect(inDateRange("2026-08-05", r)).toBe(false);
  });
  it("ochiq uchlar", () => {
    expect(inDateRange("2029-01-01", { from: "2026-08-02", to: "" })).toBe(true);
    expect(inDateRange("2026-08-01", { from: "2026-08-02", to: "" })).toBe(false);
    expect(inDateRange("2000-01-01", { from: "", to: "2026-08-04" })).toBe(true);
  });
  it("⚠️ datetime satridan KUN qismi olinadi — mintaqa o'girilmaydi", () => {
    // +05:00 li satr `new Date()` orqali o'tsa UTC'da 03.08 ga tushib ketardi
    expect(inDateRange("2026-08-04T02:10:39.551452+05:00", { from: "2026-08-04", to: "2026-08-04" })).toBe(true);
    expect(inDateRange("2026-08-04T23:50:00+05:00", { from: "2026-08-04", to: "2026-08-04" })).toBe(true);
  });
  it("sanasiz yozuv YASHIRILMAYDI — jimgina yo'qolishdan ko'ra ko'rinib tursin", () => {
    expect(inDateRange(null, r)).toBe(true);
    expect(inDateRange("", r)).toBe(true);
    expect(inDateRange("noma'lum", r)).toBe(true);
  });
  it("satr solishtiruvi yil/oy chegarasida to'g'ri", () => {
    expect(inDateRange("2026-09-01", { from: "2026-08-31", to: "2026-09-02" })).toBe(true);
    expect(inDateRange("2027-01-01", { from: "2026-12-30", to: "2026-12-31" })).toBe(false);
  });
});

describe("rangeLabel", () => {
  it("sarlavhalar — «Butun davr» bilan chalkashmaydi", () => {
    expect(rangeLabel(EMPTY_RANGE)).toBe("Butun davr");
    expect(rangeLabel({ from: "2026-08-02", to: "2026-08-05" })).toBe("02.08.2026 — 05.08.2026");
    expect(rangeLabel({ from: "2026-08-02", to: "" })).toBe("02.08.2026 dan");
    expect(rangeLabel({ from: "", to: "2026-08-05" })).toBe("05.08.2026 gacha");
  });
});
