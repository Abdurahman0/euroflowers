import { describe, it, expect, vi, beforeEach } from "vitest";
import { enumLabel, humanizeEnum, warnUnknownEnum } from "./enumLabel";
import { SALARY_SOURCE_LABEL, salarySourceLabel, salarySourceHue } from "./inventory";
import { MOVEMENT_REF_LABEL, movementRefLabel } from "./format";

describe("humanizeEnum", () => {
  it("snake_case → o'qiladigan matn", () => {
    expect(humanizeEnum("catalog_rework")).toBe("Catalog rework");
    expect(humanizeEnum("rework")).toBe("Rework");
    expect(humanizeEnum("")).toBe("");
  });
});

describe("enumLabel — noma'lum qiymat JIMGINA o'tmaydi", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("ma'lum qiymat — yorliq, ogohlantirish YO'Q", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(enumLabel({ a: "Aaa" }, "a", "test1")).toBe("Aaa");
    expect(warn).not.toHaveBeenCalled();
  });
  it("noma'lum qiymat — o'qiladigan zaxira + konsol ogohlantirishi", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(enumLabel({ a: "Aaa" }, "yangi_tur", "test2")).toBe("Yangi tur");
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it("bir xil noma'lum qiymat — ogohlantirish BIR MARTA (spam bo'lmasin)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    enumLabel({}, "takror_tur", "test3");
    enumLabel({}, "takror_tur", "test3");
    enumLabel({}, "takror_tur", "test3");
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it("bo'sh/undefined — «—», ogohlantirish YO'Q (bu «yo'q», «noma'lum» emas)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(enumLabel({}, undefined, "test4")).toBe("—");
    expect(enumLabel({}, "", "test4")).toBe("—");
    expect(warn).not.toHaveBeenCalled();
  });
  it("warnUnknownEnum to'g'ridan-to'g'ri ham bir marta ishlaydi", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnUnknownEnum("test5", "x"); warnUnknownEnum("test5", "x");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("§0c — florist oyligining `rework` manbasi", () => {
  it("yorliq va rang bor (filtr Object.keys'dan quriladi — avtomatik chiqadi)", () => {
    expect(SALARY_SOURCE_LABEL.rework).toBe("Restavratsiya");
    expect(salarySourceLabel("rework")).toBe("Restavratsiya");
    expect(salarySourceHue("rework")).toBeTruthy();
  });
  it("noma'lum manba XOM satr sifatida chiqmaydi", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(salarySourceLabel("kelajak_manba")).toBe("Kelajak manba");
    expect(salarySourceHue("kelajak_manba")).toBe("var(--muted)");
  });
});

describe("§0d — sklad harakati `catalog_rework`", () => {
  it("yorliq bor", () => {
    expect(MOVEMENT_REF_LABEL.catalog_rework).toBe("Restavratsiya");
    expect(movementRefLabel("catalog_rework")).toBe("Restavratsiya");
  });
  it("noma'lum tur — endi `null` EMAS, ko'rinadi va ogohlantiradi", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(movementRefLabel("yangi_manba_turi")).toBe("Yangi manba turi");
    expect(warn).toHaveBeenCalled();
  });
  it("bo'sh qiymat — null (satr chizilmaydi)", () => {
    expect(movementRefLabel(null)).toBeNull();
    expect(movementRefLabel(undefined)).toBeNull();
  });
});
