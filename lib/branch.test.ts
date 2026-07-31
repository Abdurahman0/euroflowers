import { describe, it, expect } from "vitest";
import { visibleScreens, screenAllowedForBranch, pathAllowed, isBranchUser, buildUserBranchPayload } from "./branch";
import type { PermissionPage } from "./types";

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
