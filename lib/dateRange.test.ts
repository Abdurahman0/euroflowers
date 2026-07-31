import { describe, it, expect } from "vitest";
import { dashboardDateTo, accountingDateTo } from "./format";

/** ⚠️ Pins the undocumented backend `date_to` asymmetry so a future "cleanup" of the +1
 *  fails loudly here instead of silently dropping the last day of dashboard revenue. */
describe("endpoint date_to asymmetry — same user range, different date_to sent", () => {
  const userSelectedTo = "2026-07-31"; // inclusive end the operator picked

  it("dashboard/analytics get date_to + 1 (backend treats it EXCLUSIVE)", () => {
    expect(dashboardDateTo(userSelectedTo)).toBe("2026-08-01");
  });
  it("accounting gets date_to RAW (backend treats it INCLUSIVE)", () => {
    expect(accountingDateTo(userSelectedTo)).toBe("2026-07-31");
  });
  it("both cover the SAME inclusive range for the same user selection", () => {
    // dashboard's exclusive 08-01 and accounting's inclusive 07-31 both include 2026-07-31
    expect(dashboardDateTo(userSelectedTo)).not.toBe(accountingDateTo(userSelectedTo));
    // the difference is exactly one day — the boundary that hid the 1.8M in the audit
    expect(dashboardDateTo(userSelectedTo)).toBe("2026-08-01");
    expect(accountingDateTo(userSelectedTo)).toBe("2026-07-31");
  });
  it("rolls month/year boundaries correctly", () => {
    expect(dashboardDateTo("2026-12-31")).toBe("2027-01-01");
    expect(dashboardDateTo("2026-02-28")).toBe("2026-03-01");
  });
  it("undefined passes through as undefined for both", () => {
    expect(dashboardDateTo(undefined)).toBeUndefined();
    expect(accountingDateTo(undefined)).toBeUndefined();
  });
});
