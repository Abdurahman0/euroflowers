import { describe, it, expect } from "vitest";
import { visibleScreens, screenAllowedForBranch, pathAllowed, isBranchUser, buildUserBranchPayload, accountingBranchParam, accountingRowView, branchSplitParts, branchSplitLine } from "./branch";
import type { AccountingByBranch, AccountingFigures, PermissionPage } from "./types";

const ALL: PermissionPage[] = ["dashboard", "inventory", "catalog", "crm", "customers", "conversations", "social_posts", "notifications", "suppliers", "florists", "attendance", "settings", "ai_settings", "integrations", "users", "audit"];

describe("§1 — branch nav/route gating (pure)", () => {
  it("main admin (not branch) with all perms sees the full permitted set incl. Sklad/CRM", () => {
    const v = visibleScreens(false, ALL);
    expect(v).toContain("sklad");
    expect(v).toContain("crm");
    expect(v).toContain("branchReport");
  });
  it("branch user with FULL perms still sees ONLY Dashboard·Hisob·Katalog", () => {
    const v = visibleScreens(true, ALL);
    expect(new Set(v)).toEqual(new Set(["dashboard", "hisob", "katalog"]));
  });
  it("branch user with fewer perms sees the intersection, never more", () => {
    const v = visibleScreens(true, ["dashboard"]); // no catalog perm
    expect(new Set(v)).toEqual(new Set(["dashboard", "hisob"])); // katalog dropped (no catalog perm)
    expect(v).not.toContain("katalog");
    expect(v).not.toContain("sklad");
  });
  it("screenAllowedForBranch blocks non-branch screens for branch users only", () => {
    expect(screenAllowedForBranch("sklad", true)).toBe(false);
    expect(screenAllowedForBranch("sklad", false)).toBe(true);
    expect(screenAllowedForBranch("katalog", true)).toBe(true);
  });
});

describe("§1 — route guard (guard the routes, not just nav)", () => {
  it("branch user hitting /sklad is NOT allowed (→ redirect to Dashboard)", () => {
    expect(pathAllowed("/sklad", true, ALL)).toBe(false);
    expect(pathAllowed("/floristlar", true, ALL)).toBe(false);
    expect(pathAllowed("/filial-hisoboti", true, ALL)).toBe(false);
  });
  it("branch user CAN reach Dashboard/Hisob/Katalog", () => {
    expect(pathAllowed("/", true, ALL)).toBe(true);
    expect(pathAllowed("/hisob-kitob", true, ALL)).toBe(true);
    expect(pathAllowed("/katalog", true, ALL)).toBe(true);
  });
  it("main admin can reach any permitted route", () => {
    expect(pathAllowed("/sklad", false, ALL)).toBe(true);
  });
  it("unknown routes (e.g. /login) are not blocked", () => {
    expect(pathAllowed("/login", true, ALL)).toBe(true);
  });
  it("isBranchUser: null = main (unrestricted), a branch id = restricted", () => {
    expect(isBranchUser(null)).toBe(false);
    expect(isBranchUser(undefined)).toBe(false);
    expect(isBranchUser(2)).toBe(true);
  });
});

describe("§0.1 — user branch payload never silently moves people to main", () => {
  it("new user WITH a branch → sends it", () => {
    expect(buildUserBranchPayload(undefined, 2, false)).toEqual({ branch: 2 });
  });
  it("new user WITHOUT a branch → key omitted (defaults to main)", () => {
    expect(buildUserBranchPayload(undefined, null, false)).toEqual({});
  });
  it("edit UNCHANGED (branch user, untouched) → key omitted → stays on their branch", () => {
    expect(buildUserBranchPayload(2, 2, true)).toEqual({});
    expect(buildUserBranchPayload(null, null, true)).toEqual({});
  });
  it("edit main→branch → sends the new branch", () => {
    expect(buildUserBranchPayload(null, 2, true)).toEqual({ branch: 2 });
  });
  it("edit branch→main (intended) → explicitly sends null", () => {
    expect(buildUserBranchPayload(2, null, true)).toEqual({ branch: null });
  });
});

// ── HISOB-KITOB branch split helpers
const fig = (o: Partial<AccountingFigures>): AccountingFigures => ({
  total_quantity: 0, standard_quantity: 0, custom_quantity: 0, total_sales: "0",
  cash_total: "0", card_total: "0", unknown_total: "0", discount_total: "0",
  discounted_sales_count: 0, discounted_quantity: 0, cost_total: "0", net_profit: "0", ...o,
});
const money = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); // regular-space grouping (matches lib/format fmt)

describe("accountingBranchParam — selector → ?branch=", () => {
  it("all/main/id map correctly", () => {
    expect(accountingBranchParam("all")).toBe("all");
    expect(accountingBranchParam("main")).toBe("main");
    expect(accountingBranchParam(2)).toBe("2");
  });
});

describe("accountingRowView — one row-view for by_branch AND summary", () => {
  it("a by_branch row: parses strings, keeps branch name + share", () => {
    const v = accountingRowView(fig({ branch_name: "Parkent filiali", is_main: false, sales_count: 2, total_quantity: 2, flower_stems: 10, total_sales: "720000.00", cash_total: "320000.00", card_total: "400000.00", net_profit: "540000.00", share_percent: "8.55" }));
    expect(v).toMatchObject({ name: "Parkent filiali", salesCount: 2, buket: 2, stems: 10, sales: 720000, cash: 320000, card: 400000, net: 540000, share: 8.55 });
  });
  it("summary (no branch_name, no share) → 'Jami' at 100%", () => {
    const v = accountingRowView(fig({ total_sales: "8420000.00" }));
    expect(v.name).toBe("Jami");
    expect(v.share).toBe(100);
  });
});

describe("branchSplitParts / branchSplitLine — 1, 2 and 3+ branches", () => {
  const rows = (n: number): AccountingByBranch[] =>
    [fig({ branch_name: "Toshkent", total_sales: "7700000.00", share_percent: "91.45" }),
     fig({ branch_name: "Parkent", total_sales: "720000.00", share_percent: "8.55" }),
     fig({ branch_name: "Chilonzor", total_sales: "300000.00", share_percent: "3.00" })].slice(0, n);
  it("one branch → single part, no separator", () => {
    expect(branchSplitParts(rows(1), "total_sales")).toHaveLength(1);
    expect(branchSplitLine(rows(1), "total_sales", money)).toBe("Toshkent 7 700 000 (91.45%)");
  });
  it("two branches → separated line", () => {
    expect(branchSplitLine(rows(2), "total_sales", money)).toBe("Toshkent 7 700 000 (91.45%) · Parkent 720 000 (8.55%)");
  });
  it("three+ branches → all parts present (line must degrade in UI, not here)", () => {
    const parts = branchSplitParts(rows(3), "total_sales");
    expect(parts.map((p) => p.name)).toEqual(["Toshkent", "Parkent", "Chilonzor"]);
    expect(branchSplitLine(rows(3), "total_sales", money).split(" · ")).toHaveLength(3);
  });
  it("works for any money field (cash_total)", () => {
    const r = [fig({ branch_name: "T", cash_total: "500000", share_percent: "100" })];
    expect(branchSplitLine(r, "cash_total", money)).toBe("T 500 000 (100%)");
  });
});
