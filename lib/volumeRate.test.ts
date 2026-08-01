import { describe, it, expect } from "vitest";
import { volumeArrangementMatch, rateSalaryForCatalog, rateToCatalogSalary, catalogSalaryPayload, buildVolumeRatesPayload, VOLUMES, type RateCell } from "./inventory";
import type { FloristVolumeRate } from "./types";

const rate = (o: Partial<FloristVolumeRate>): FloristVolumeRate => ({
  id: 1, florist: 4, arrangement_type: "bouquet", volume: "medium",
  default_stems: 25, florist_fee: "60000", is_active: true, ...o,
});

describe("volume ↔ arrangement match (exact string equality)", () => {
  it("matches identical volume + arrangement", () => {
    expect(volumeArrangementMatch(rate({}), "medium", "bouquet")).toBe(true);
  });
  it("does NOT match the S/M/L trap against small/medium/large", () => {
    // if a rate were ever saved as "M", it must NOT match a "medium" catalog
    expect(volumeArrangementMatch(rate({ volume: "M" as never }), "medium", "bouquet")).toBe(false);
    expect(volumeArrangementMatch(rate({ volume: "medium" }), "M" as never, "bouquet")).toBe(false);
  });
  it("does not match on arrangement mismatch", () => {
    expect(volumeArrangementMatch(rate({}), "medium", "basket")).toBe(false);
  });
  it("ignores inactive rates", () => {
    expect(volumeArrangementMatch(rate({ is_active: false }), "medium", "bouquet")).toBe(false);
  });
  it("no match when volume/arrangement is empty", () => {
    expect(volumeArrangementMatch(rate({}), "", "bouquet")).toBe(false);
    expect(volumeArrangementMatch(rate({}), "medium", "")).toBe(false);
  });
});

describe("rateSalaryForCatalog — per-florist lookup", () => {
  const rates = [
    rate({ id: 1, florist: 4, volume: "medium", arrangement_type: "bouquet", florist_fee: "60000" }),
    rate({ id: 2, florist: 6, volume: "medium", arrangement_type: "bouquet", florist_fee: "75000" }),
  ];
  it("finds the selected florist's rate only", () => {
    expect(rateSalaryForCatalog(rates, 4, "medium", "bouquet")?.id).toBe(1);
    expect(rateSalaryForCatalog(rates, 6, "medium", "bouquet")?.id).toBe(2);
  });
  it("returns undefined without a florist (never cross-florist match)", () => {
    expect(rateSalaryForCatalog(rates, null, "medium", "bouquet")).toBeUndefined();
  });
  it("returns undefined when no rate matches", () => {
    expect(rateSalaryForCatalog(rates, 4, "large", "bouquet")).toBeUndefined();
  });
});

describe("rateToCatalogSalary — the naming-trap mapper", () => {
  it("maps rate.florist_fee → catalog salary value", () => {
    expect(rateToCatalogSalary(rate({ florist_fee: "60000.00" }))).toBe("60000");
  });
});

describe("catalogSalaryPayload — mode-aware (STANDART omits; CUSTOM keeps zero-is-a-value rule)", () => {
  // ⚠️ STANDART: haq faqat hajm tarifidan → forma HECH QACHON florist_salary_amount yubormaydi.
  it("standard → key ALWAYS omitted, whatever the value", () => {
    expect(catalogSalaryPayload("", "standard")).toEqual({});
    expect(catalogSalaryPayload("0", "standard")).toEqual({});
    expect(catalogSalaryPayload("60000", "standard")).toEqual({});
    expect(catalogSalaryPayload(null, "standard")).toEqual({});
  });
  // CUSTOM: ish hajmi noma'lum → operator kiritadi; "0"≠bo'sh (override qoidasi saqlanadi).
  it("custom + empty/null/undefined → key omitted", () => {
    expect(catalogSalaryPayload("", "custom")).toEqual({});
    expect(catalogSalaryPayload(null, "custom")).toEqual({});
    expect(catalogSalaryPayload(undefined, "custom")).toEqual({});
  });
  it('custom + operator-typed "0" → sent as "0" (never treated as empty)', () => {
    expect(catalogSalaryPayload("0", "custom")).toEqual({ florist_salary_amount: "0" });
  });
  it("custom + value → sent", () => {
    expect(catalogSalaryPayload("60000", "custom")).toEqual({ florist_salary_amount: "60000" });
    expect(catalogSalaryPayload("60000.00", "custom")).toEqual({ florist_salary_amount: "60000" });
  });
});

describe("buildVolumeRatesPayload — full-replace safety (only filled cells sent)", () => {
  const cell = (o: Partial<RateCell>): RateCell => ({ arrangement_type: "bouquet", volume: "medium", fee: "", stems: "", ...o });
  it("includes filled cells (fee present), with default_stems when given", () => {
    const out = buildVolumeRatesPayload([cell({ fee: "60000", stems: "25" })]);
    expect(out).toEqual([{ arrangement_type: "bouquet", volume: "medium", florist_fee: "60000", default_stems: 25 }]);
  });
  it("omits empty cells entirely (they deactivate server-side)", () => {
    const out = buildVolumeRatesPayload([cell({ fee: "60000" }), cell({ volume: "large", fee: "" })]);
    expect(out).toHaveLength(1);
    expect(out[0].volume).toBe("medium");
  });
  it("a cell with stems but no fee is treated as empty (fee is what defines a rate)", () => {
    expect(buildVolumeRatesPayload([cell({ fee: "", stems: "40" })])).toEqual([]);
  });
  it("filled cell without stems omits default_stems", () => {
    expect(buildVolumeRatesPayload([cell({ fee: "50000" })])).toEqual([{ arrangement_type: "bouquet", volume: "medium", florist_fee: "50000" }]);
  });
  it("all-empty grid → [] (the dangerous case the UI guards with a confirm)", () => {
    expect(buildVolumeRatesPayload([cell({}), cell({ volume: "small" }), cell({ arrangement_type: "basket" })])).toEqual([]);
  });
  it("partial grid → only the filled subset", () => {
    const cells = [cell({ volume: "small", fee: "40000", stems: "15" }), cell({ volume: "medium" }), cell({ volume: "large", fee: "85000" })];
    expect(buildVolumeRatesPayload(cells).map((r) => r.volume)).toEqual(["small", "large"]);
  });
});

describe("VOLUMES is the single source of truth", () => {
  it("is exactly the three API values in order", () => {
    expect(VOLUMES).toEqual(["small", "medium", "large"]);
  });
});
