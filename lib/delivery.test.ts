import { describe, it, expect } from "vitest";
import { roundToHundred, perStemFromBunch, exactPerStem, roundingNote, buildBatchPayload, roundingHint, deliveryRoundingHint } from "./inventory";
import type { RoundingSide } from "./types";

// ── DR1: rounding parity — EVERY row of the spec table (client must equal server)
describe("DR1 — pochka→dona rounding matches the spec table exactly", () => {
  // [bunch, stemsPerBunch, exact, stored]
  const rows: [number, number, number, number][] = [
    [25000, 25, 1000, 1000],
    [24950, 25, 998, 1000],
    [24900, 25, 996, 1000],
    [25100, 25, 1004, 1000],
    [26300, 25, 1052, 1100],
    [26500, 25, 1060, 1100],
  ];
  it.each(rows)("bunch %d ÷ %d = exact %d → stored %d", (bunch, spb, exact, stored) => {
    expect(exactPerStem(bunch, spb)).toBe(exact);
    expect(perStemFromBunch(bunch, spb)).toBe(stored);
  });

  it("divides THEN rounds (not round-then-divide): 24950/25=998→1000, not round(24950)/25", () => {
    expect(perStemFromBunch(24950, 25)).toBe(1000); // divide first: 998 → 1000
  });

  it("half-up: exact .5 boundary rounds UP (yarmi va undan yuqorisi tepaga)", () => {
    expect(roundToHundred(1050)).toBe(1100); // 10.5 → 11
    expect(roundToHundred(950)).toBe(1000);  // 9.5 → 10
    expect(roundToHundred(50)).toBe(100);    // 0.5 → 1
    expect(roundToHundred(150)).toBe(200);   // 1.5 → 2
    expect(roundToHundred(250)).toBe(300);   // 2.5 → 3
  });

  it("sub-50 per-stem ZEROES the cost basis (the cliff)", () => {
    expect(perStemFromBunch(49, 1)).toBe(0);   // 49 → 0
    expect(perStemFromBunch(1225, 25)).toBe(0); // 49/stem → 0
    expect(perStemFromBunch(50, 1)).toBe(100);  // 50 → 100 (50–149 → 100)
    expect(perStemFromBunch(149, 1)).toBe(100); // 149 → 100
  });

  it("roundingNote flags changed + zeroed with the exact figure", () => {
    const a = roundingNote(24950, 25); // 998 → 1000
    expect(a).toEqual({ rounded: 1000, exact: 998, changed: true, zeroed: false });
    const b = roundingNote(25000, 25); // 1000 → 1000
    expect(b.changed).toBe(false);
    const z = roundingNote(1000, 25); // 40 → 0
    expect(z.zeroed).toBe(true);
    expect(z.rounded).toBe(0);
  });

  it("guards divide-by-zero stems", () => {
    expect(exactPerStem(25000, 0)).toBe(0);
    expect(perStemFromBunch(25000, 0)).toBe(0);
  });
});

// ── DR2: payload builder — never send both bunch+stem unless override; delivery omits 3 fields
describe("DR2 — buildBatchPayload send-rules", () => {
  const base = { variant: 31, heightCm: 50, stemsPerBunch: 25 };

  it("bunch only (default): cost/sale per-bunch sent, per-stem NOT sent", () => {
    const p = buildBatchPayload({ ...base, costPerBunch: "25000", salePerBunch: "50000" });
    expect(p.cost_per_bunch).toBe("25000");
    expect(p.sale_price_per_bunch).toBe("50000");
    expect("cost_per_stem" in p).toBe(false);
    expect("sale_price_per_stem" in p).toBe(false);
  });

  it("stem only: per-stem sent, per-bunch NOT sent (server computes bunch)", () => {
    const p = buildBatchPayload({ ...base, costPerStem: "1000", salePerStem: "2000" });
    expect(p.cost_per_stem).toBe("1000");
    expect("cost_per_bunch" in p).toBe(false);
  });

  it("explicit override: BOTH sent knowingly (server stores verbatim, computes nothing)", () => {
    const p = buildBatchPayload({ ...base, costPerBunch: "25000", costPerStem: "999" });
    expect(p.cost_per_bunch).toBe("25000");
    expect(p.cost_per_stem).toBe("999");
  });

  it("delivery-bound: delivery sent; batch_number/received_at/supplier OMITTED", () => {
    const p = buildBatchPayload({ ...base, deliveryId: 2, supplier: 22, batchNumber: "7", receivedAt: "2026-08-01", costPerBunch: "25000" });
    expect(p.delivery).toBe(2);
    expect("batch_number" in p).toBe(false);
    expect("received_at" in p).toBe(false);
    expect("supplier" in p).toBe(false);
  });

  it("no delivery: the three fields ARE sent when provided", () => {
    const p = buildBatchPayload({ ...base, supplier: 22, batchNumber: "EF-1", receivedAt: "2026-08-01T10:00", costPerBunch: "25000" });
    expect(p.supplier).toBe(22);
    expect(p.batch_number).toBe("EF-1");
    expect(p.received_at).toBe("2026-08-01"); // sliced to date
  });

  it("quantity: bunch XOR stem — bunch wins if both accidentally set", () => {
    expect(buildBatchPayload({ ...base, receivedBunches: 8 }).received_bunches).toBe("8.00");
    expect(buildBatchPayload({ ...base, receivedStems: 200 }).received_stems).toBe(200);
    const both = buildBatchPayload({ ...base, receivedBunches: 8, receivedStems: 200 });
    expect(both.received_bunches).toBe("8.00");
    expect("received_stems" in both).toBe(false);
  });
});

// ── DR3: display-only rounding hints — only surface when is_rounded, never compute
const side = (over?: Partial<RoundingSide>): RoundingSide => ({
  per_stem_exact: 998, per_stem_rounded: 1000, per_stem_diff: 2,
  total_exact: 99800, total_rounded: 100000, total_diff: 200, is_rounded: true, ...over,
});
// ru locale ajratgichi — nabel probel (U+00A0); taqqoslashda oddiy probelga keltiramiz
const nsp = (s: string | null) => (s == null ? null : s.replace(/ /g, " "));
describe("DR3 — roundingHint / deliveryRoundingHint (DISPLAY-ONLY, server numbers)", () => {
  it("roundingHint returns '(aniq …)' only when is_rounded=true", () => {
    expect(nsp(roundingHint(side()))).toBe("aniq: 998 · +2");
    expect(roundingHint(side({ is_rounded: false }))).toBeNull(); // flat split → nothing shown
    expect(roundingHint(undefined)).toBeNull();
    expect(roundingHint(null)).toBeNull();
  });
  it("roundingHint reads the server's exact/diff verbatim — does NOT recompute", () => {
    // even if per_stem_rounded/exact are internally inconsistent, we echo the server's diff
    expect(nsp(roundingHint(side({ per_stem_exact: 1060, per_stem_diff: 40 })))).toBe("aniq: 1 060 · +40");
  });
  it("deliveryRoundingHint only when rounding_diff != 0", () => {
    expect(nsp(deliveryRoundingHint({ total_cost_exact: 99800, rounding_diff: 200 }))).toBe("aniq hisob: 99 800 · yaxlitlashdan +200");
    expect(deliveryRoundingHint({ total_cost_exact: 100000, rounding_diff: 0 })).toBeNull();
    expect(deliveryRoundingHint({ total_cost_exact: 100000 })).toBeNull(); // no diff field → nothing
  });
});
