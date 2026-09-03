import { describe, expect, it } from "vitest";
import {
  canReturnCustom, customReturnMessage, customReturnPayload,
  RETURN_CUSTOM_CONFIRM, RETURN_CUSTOM_LABEL, RETURN_CUSTOM_REASON_PLACEHOLDER,
} from "./customReturn";
import type { CatalogItem } from "./types";

const item = (over: Partial<CatalogItem> = {}): CatalogItem =>
  ({ catalog_kind: "custom", quantity_sold: 0, quantity_wasted: 0, quantity_reworked: 0, ...over } as CatalogItem);

describe("canReturnCustom — spec'dagi shart", () => {
  it("toza maxsus katalog → tugma CHIQADI", () => {
    expect(canReturnCustom(item())).toBe(true);
  });
  it("standart katalogda CHIQMAYDI", () => {
    expect(canReturnCustom(item({ catalog_kind: "standard" }))).toBe(false);
  });
  it("sotilgan / chiqit / restavratsiya bo'lsa CHIQMAYDI", () => {
    expect(canReturnCustom(item({ quantity_sold: 1 }))).toBe(false);
    expect(canReturnCustom(item({ quantity_wasted: 1 }))).toBe(false);
    expect(canReturnCustom(item({ quantity_reworked: 1 }))).toBe(false);
  });
  it("maydon kelmasa 0 deb olinadi (eski javob)", () => {
    expect(canReturnCustom({ catalog_kind: "custom" } as CatalogItem)).toBe(true);
  });
  it("yozuv yo'q → false", () => {
    expect(canReturnCustom(null)).toBe(false);
    expect(canReturnCustom(undefined)).toBe(false);
  });
});

describe("customReturnPayload", () => {
  it("sabab yozilsa yuboriladi", () => {
    expect(customReturnPayload("  Mijoz buyurtmani bekor qildi  ")).toEqual({ reason: "Mijoz buyurtmani bekor qildi" });
  });
  it("sabab IXTIYORIY — bo'sh bo'lsa kalit umuman yo'q", () => {
    expect(customReturnPayload("")).toEqual({});
    expect(customReturnPayload("   ")).toEqual({});
    expect(customReturnPayload(null)).toEqual({});
    expect(customReturnPayload(undefined)).toEqual({});
  });
});

describe("customReturnMessage", () => {
  it("server matni ustun", () => {
    expect(customReturnMessage({ detail: "Mahsus katalog qaytarildi" })).toBe("Mahsus katalog qaytarildi");
  });
  it("bo'sh bo'lsa spec'dagi ibora", () => {
    expect(customReturnMessage({ detail: "  " })).toBe("Mahsus katalog qaytarildi");
    expect(customReturnMessage(null)).toBe("Mahsus katalog qaytarildi");
  });
});

describe("spec matnlari AYNAN", () => {
  it("tugma va oyna matnlari", () => {
    expect(RETURN_CUSTOM_LABEL).toBe("Mahsus katalogni qaytarish");
    expect(RETURN_CUSTOM_REASON_PLACEHOLDER).toBe("Sababini yozing");
    expect(RETURN_CUSTOM_CONFIRM).toContain("Yechilgan gullar va materiallar skladga qaytadi");
    expect(RETURN_CUSTOM_CONFIRM).toContain("Davom etasizmi?");
  });
});
