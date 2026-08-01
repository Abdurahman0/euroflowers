import { describe, it, expect } from "vitest";
import { defaultQtyMode, convertQty, qtyPayload } from "../components/DualQtyInput";

// ── §4: default unit = pochka where a bunch is meaningful; dona fallback when spb absent
describe("§4 defaultQtyMode — pochka on open, dona fallback", () => {
  it("stems_per_bunch > 1 → pochka (bunches) on open", () => {
    expect(defaultQtyMode(25)).toBe("bunches");
    expect(defaultQtyMode(2)).toBe("bunches");
  });
  it("no / trivial stems_per_bunch → dona (stems) — pochka is meaningless", () => {
    expect(defaultQtyMode(1)).toBe("stems");   // 1 stem/bunch → pochka == dona
    expect(defaultQtyMode(0)).toBe("stems");
    expect(defaultQtyMode(null)).toBe("stems");
    expect(defaultQtyMode(undefined)).toBe("stems"); // materials/no-spb → dona
  });
});

describe("§4 convertQty — switching units RE-CONVERTS, never reinterprets", () => {
  it("100 pochka → dona = 2500 (× spb), not 100", () => {
    expect(convertQty("100", "bunches", "stems", 25)).toBe("2500");
  });
  it("2500 dona → pochka = 100 (÷ spb)", () => {
    expect(convertQty("2500", "stems", "bunches", 25)).toBe("100");
  });
  it("non-integer bunches keeps 2 decimals", () => {
    expect(convertQty("30", "stems", "bunches", 25)).toBe("1.2");
  });
  it("same mode or empty → unchanged", () => {
    expect(convertQty("100", "bunches", "bunches", 25)).toBe("100");
    expect(convertQty("", "bunches", "stems", 25)).toBe("");
  });
  it("spb ≤ 0 coerces to 1 (no divide-by-zero)", () => {
    expect(convertQty("5", "bunches", "stems", 0)).toBe("5");
  });
});

describe("§4 qtyPayload — the SENT field never changes with the input unit", () => {
  it("bunches → quantity_bunches only", () => {
    expect(qtyPayload("bunches", "6")).toEqual({ quantity_bunches: "6.00" });
    expect("quantity_stems" in qtyPayload("bunches", "6")).toBe(false);
  });
  it("stems → quantity_stems only (rounded)", () => {
    expect(qtyPayload("stems", "150")).toEqual({ quantity_stems: 150 });
    expect("quantity_bunches" in qtyPayload("stems", "150")).toBe(false);
  });
});
