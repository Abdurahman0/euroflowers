import { describe, it, expect } from "vitest";
import { todayTashkent, isBackdated, isFutureDate, backdateIso, backdatePayload, backdateEditPayload, withTashkentOffset } from "./backdate";

// 2026-08-03 09:30 Toshkent = 2026-08-03T04:30:00Z
const NOW = Date.parse("2026-08-03T04:30:00Z");
// 2026-08-03 23:50 Toshkent = 2026-08-03T18:50:00Z — «kun chegarasi» tekshiruvi uchun
const LATE = Date.parse("2026-08-03T18:50:00Z");

describe("todayTashkent — brauzer mintaqasidan QAT'I NAZAR Toshkent kuni", () => {
  it("UTC 04:30 → Toshkent 09:30, kun 03", () => expect(todayTashkent(NOW)).toBe("2026-08-03"));
  it("⚠️ UTC 19:30 (= Toshkent 00:30 ertasi) → KEYINGI kun", () => {
    expect(todayTashkent(Date.parse("2026-08-03T19:30:00Z"))).toBe("2026-08-04");
  });
  it("⚠️ UTC 23:00 (= Toshkent 04:00 ertasi) → keyingi kun", () => {
    expect(todayTashkent(Date.parse("2026-08-03T23:00:00Z"))).toBe("2026-08-04");
  });
});

describe("isBackdated / isFutureDate", () => {
  it("o'tgan kun → backdated", () => expect(isBackdated("2026-07-28", NOW)).toBe(true));
  it("bugun → backdated EMAS", () => expect(isBackdated("2026-08-03", NOW)).toBe(false));
  it("kelajak → future", () => expect(isFutureDate("2026-08-04", NOW)).toBe(true));
  it("bugun → future emas", () => expect(isFutureDate("2026-08-03", NOW)).toBe(false));
});

describe("backdateIso — DOIM +05:00, hech qachon UTC-normallashtirilgan satr", () => {
  it("O'TGAN kun → 12:00 +05:00 (sutkaning o'rtasi, siljish kunni buzmaydi)", () => {
    expect(backdateIso("2026-07-28", NOW)).toBe("2026-07-28T12:00:00+05:00");
  });
  it("BUGUN → hozirgi Toshkent soati +05:00 (kun ichidagi tartib saqlanadi)", () => {
    expect(backdateIso("2026-08-03", NOW)).toBe("2026-08-03T09:30:00+05:00");
  });
  it("⚠️ kech kirsa ham BUGUN uchun hozirgi vaqt (23:50), 12:00 EMAS", () => {
    expect(backdateIso("2026-08-03", LATE)).toBe("2026-08-03T23:50:00+05:00");
  });
  it("KELAJAK → null (hech qachon yuborilmaydi)", () => {
    expect(backdateIso("2026-08-04", NOW)).toBeNull();
    expect(backdateIso("2027-01-01", NOW)).toBeNull();
  });
  it("buzuq kirish → null", () => {
    expect(backdateIso("", NOW)).toBeNull();
    expect(backdateIso("2026-8-3", NOW)).toBeNull();
    expect(backdateIso("salom", NOW)).toBeNull();
  });
  it("natija HAR DOIM +05:00 bilan tugaydi va 'Z' ni O'Z ICHIGA OLMAYDI", () => {
    const iso = backdateIso("2026-07-28", NOW)!;
    expect(iso.endsWith("+05:00")).toBe(true);
    expect(iso).not.toContain("Z");
  });
});

describe("backdatePayload — tegilmagan bo'lsa KALIT YO'Q (buzilmas qoida)", () => {
  it("BUGUN tanlangan (= sukut) → BO'SH obyekt", () => {
    expect(backdatePayload("2026-08-03", NOW)).toEqual({});
  });
  it("tanlanmagan / bo'sh → BO'SH obyekt", () => {
    expect(backdatePayload("", NOW)).toEqual({});
    expect(backdatePayload(null, NOW)).toEqual({});
    expect(backdatePayload(undefined, NOW)).toEqual({});
  });
  it("O'TGAN kun → created_at yuboriladi", () => {
    expect(backdatePayload("2026-07-28", NOW)).toEqual({ created_at: "2026-07-28T12:00:00+05:00" });
  });
  it("KELAJAK → BO'SH (klient ikkinchi himoya qatlami)", () => {
    expect(backdatePayload("2026-12-31", NOW)).toEqual({});
  });
  it("kalit nomi almashtiriladi (sold_at kabi boshqa maydonlar uchun)", () => {
    expect(backdatePayload("2026-07-28", NOW, "sold_at")).toEqual({ sold_at: "2026-07-28T12:00:00+05:00" });
  });
});

describe("backdateEditPayload — FAQAT o'zgarganda (PATCH intizomi)", () => {
  const orig = "2026-07-30T12:00:00+05:00";
  it("tegilmagan (bir xil kun) → BO'SH", () => {
    expect(backdateEditPayload(orig, "2026-07-30", NOW)).toEqual({});
  });
  it("boshqa kunga o'zgartirildi → yuboriladi", () => {
    expect(backdateEditPayload(orig, "2026-07-26", NOW)).toEqual({ created_at: "2026-07-26T12:00:00+05:00" });
  });
  it("bugunga qaytarildi → yuboriladi (create'dan farqli: bu HAQIQIY o'zgarish)", () => {
    expect(backdateEditPayload(orig, "2026-08-03", NOW)).toEqual({ created_at: "2026-08-03T09:30:00+05:00" });
  });
  it("bo'sh qiymat → BO'SH (tozalash emas, tegilmagan deb qaraladi)", () => {
    expect(backdateEditPayload(orig, "", NOW)).toEqual({});
  });
  it("kelajakka o'zgartirishga urinish → BO'SH", () => {
    expect(backdateEditPayload(orig, "2026-09-01", NOW)).toEqual({});
  });
});

describe("withTashkentOffset — mavjud offsetsiz satrlarni tuzatish (sold_at, harakat sanasi)", () => {
  it("⚠️ 23:30 offsetsiz → +05:00 qo'shiladi (aks holda server UTC deb o'qib ERTANGI kunga tashlaydi)", () => {
    expect(withTashkentOffset("2026-08-03T23:30")).toBe("2026-08-03T23:30:00+05:00");
  });
  it("00:30 ham xuddi shunday", () => {
    expect(withTashkentOffset("2026-08-04T00:30")).toBe("2026-08-04T00:30:00+05:00");
  });
  it("sekundli satr ham qo'llab-quvvatlanadi", () => {
    expect(withTashkentOffset("2026-08-03T10:15:42")).toBe("2026-08-03T10:15:42+05:00");
  });
  it("allaqachon offsetli → TEGILMAYDI (ikki marta qo'shilmaydi)", () => {
    expect(withTashkentOffset("2026-08-03T10:00:00+05:00")).toBe("2026-08-03T10:00:00+05:00");
    expect(withTashkentOffset("2026-08-03T10:00:00Z")).toBe("2026-08-03T10:00:00Z");
  });
  it("bo'sh → bo'sh (kalit baribir yuborilmaydi)", () => expect(withTashkentOffset("")).toBe(""));
});
