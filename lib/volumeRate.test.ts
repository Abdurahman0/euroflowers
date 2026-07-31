import { describe, it, expect } from "vitest";
import { volumeArrangementMatch, rateSalaryForCatalog, rateToCatalogSalary, catalogSalaryPayload, VOLUMES } from "./inventory";
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

describe("catalogSalaryPayload — zero is a value, empty is omission (override rule)", () => {
  it("empty string → key omitted (backend auto-fills from rate)", () => {
    expect(catalogSalaryPayload("")).toEqual({});
  });
  it("null/undefined → key omitted", () => {
    expect(catalogSalaryPayload(null)).toEqual({});
    expect(catalogSalaryPayload(undefined)).toEqual({});
  });
  it('operator-typed "0" → sent as "0" (never treated as empty)', () => {
    expect(catalogSalaryPayload("0")).toEqual({ florist_salary_amount: "0" });
  });
  it("rate-resolved / operator-edited value → sent", () => {
    expect(catalogSalaryPayload("60000")).toEqual({ florist_salary_amount: "60000" });
    expect(catalogSalaryPayload("60000.00")).toEqual({ florist_salary_amount: "60000" });
  });
});

describe("VOLUMES is the single source of truth", () => {
  it("is exactly the three API values in order", () => {
    expect(VOLUMES).toEqual(["small", "medium", "large"]);
  });
});
