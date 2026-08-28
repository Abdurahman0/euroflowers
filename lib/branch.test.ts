import { describe, it, expect } from "vitest";
import { visibleScreens, showsSharedData, pathAllowed, isBranchUser, buildUserBranchPayload, accountingBranchParam, accountingRowView, branchSplitParts, branchSplitLine } from "./branch";
import type { AccountingByBranch, AccountingFigures, PermissionPage } from "./types";

const ALL: PermissionPage[] = ["dashboard", "inventory", "catalog", "crm", "customers", "conversations", "social_posts", "notifications", "suppliers", "florists", "attendance", "settings", "ai_settings", "integrations", "users", "audit"];

describe("§1 — RUXSAT HUKM QILADI (filial allowlist olib tashlandi, 2026-08-03)", () => {
  it("main admin with all perms sees the full permitted set", () => {
    const v = visibleScreens(false, ALL);
    expect(v).toContain("sklad");
    expect(v).toContain("crm");
    expect(v).toContain("branchReport");
  });
  it("branch user with FULL perms now sees the SAME set as a main user (no allowlist)", () => {
    expect(new Set(visibleScreens(true, ALL))).toEqual(new Set(visibleScreens(false, ALL)));
  });
  // ⚠️ ASOSIY REGRESSIYA: parkent_admin'ning jonli ruxsatlari (can_view=true bo'lganlari)
  it("branch user with X,Y,Z sees EXACTLY X,Y,Z — parkent_admin real case", () => {
    const perms: PermissionPage[] = ["dashboard", "catalog", "crm", "customers", "notifications"];
    const v = visibleScreens(true, perms);
    // dashboard → Dashboard + Analitika + Hisob-kitob + Filial hisoboti;
    // crm → Buyurtmalar + Bronlar + Qarzdorlar (qarz endpoint'lari ham `crm` talab qiladi)
    expect(new Set(v)).toEqual(new Set([
      "dashboard", "analitika", "hisob", "branchReport",
      "katalog", "crm", "bronlar", "qarzdorlar", "mijozlar", "bildirishnomalar",
    ]));
    // ⚠️ Qarz FILIAL bo'yicha ajratiladimi — spec JIM, Debt'da `branch` maydoni YO'Q
    // (LIST 2). Sukut: ruxsat bergan joyda ko'rsatamiz, yashirmaymiz.
    expect(v).toContain("qarzdorlar");
    // ilgari yashiringan sahifalar endi KO'RINADI (ruxsat bergan)
    expect(v).toContain("mijozlar");
    expect(v).toContain("crm");
    expect(v).toContain("bildirishnomalar");
    // ruxsat BERILMAGANLARI baribir yo'q
    expect(v).not.toContain("sklad");
    expect(v).not.toContain("floristlar");
    expect(v).not.toContain("xodimlar");
  });
  it("branch user without a perm still does not see that screen", () => {
    const v = visibleScreens(true, ["dashboard"]);
    expect(v).not.toContain("katalog");
    expect(v).not.toContain("mijozlar");
  });
});

describe("§1 — umumiy ma'lumot ogohlantirishi (yashirish o'rniga halol aytish)", () => {
  it("filial foydalanuvchisiga bo'linMAGAN ekranlarda ko'rsatiladi", () => {
    for (const id of ["crm", "bronlar", "mijozlar", "bildirishnomalar", "sklad", "floristlar"] as const) {
      expect(showsSharedData(id, true)).toBe(true);
    }
  });
  it("serverda BO'LINGAN ekranlarda ko'rsatilMAYDI (dashboard · hisob · katalog)", () => {
    for (const id of ["dashboard", "hisob", "katalog"] as const) {
      expect(showsSharedData(id, false)).toBe(false);
      expect(showsSharedData(id, true)).toBe(false);
    }
  });
  it("asosiy filial foydalanuvchisiga HECH QACHON ko'rsatilmaydi", () => {
    expect(showsSharedData("mijozlar", false)).toBe(false);
    expect(showsSharedData("crm", false)).toBe(false);
  });
});

describe("§1 — route guard NAV bilan AYNAN mos (ruxsat yagona mezon)", () => {
  it("nav va route guard bir xil javob beradi — URL orqali yashirin sahifa yo'q", () => {
    const perms: PermissionPage[] = ["dashboard", "catalog", "crm", "customers", "notifications"];
    // ko'rinadigan har bir ekran route'i ham OCHIQ
    expect(pathAllowed("/mijozlar", true, perms)).toBe(true);
    expect(pathAllowed("/buyurtmalar", true, perms)).toBe(true);
    expect(pathAllowed("/bronlar", true, perms)).toBe(true);
    expect(pathAllowed("/bildirishnomalar", true, perms)).toBe(true);
    expect(pathAllowed("/katalog", true, perms)).toBe(true);
    // ruxsat yo'q → nav'da ham yo'q, route ham YOPIQ
    expect(pathAllowed("/sklad", true, perms)).toBe(false);
    expect(pathAllowed("/floristlar", true, perms)).toBe(false);
    expect(pathAllowed("/xodimlar", true, perms)).toBe(false);
  });
  it("filial foydalanuvchisi endi /sklad'ga ruxsati BOR bo'lsa kira oladi (allowlist yo'q)", () => {
    expect(pathAllowed("/sklad", true, ALL)).toBe(true);
    expect(pathAllowed("/filial-hisoboti", true, ALL)).toBe(true);
  });
  it("main admin can reach any permitted route", () => {
    expect(pathAllowed("/sklad", false, ALL)).toBe(true);
  });
  it("unknown routes (e.g. /login) are not blocked", () => {
    expect(pathAllowed("/login", true, ALL)).toBe(true);
  });
  it("isBranchUser: null = main, a branch id = branch (chip uchun ishlatiladi)", () => {
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
  // ⚠️ TERMINAL — backend 28.08.2026: kartaga qo'shilmaydi, alohida ustun
  it("terminal_total alohida o'qiladi va kartaga QO'SHILMAYDI", () => {
    const v = accountingRowView(fig({ total_sales: "750000.00", cash_total: "250000.00", card_total: "250000.00", terminal_total: "250000.00", received_total: "750000.00" }));
    expect(v.terminal).toBe(250000);
    expect(v.card).toBe(250000);
    expect(v.cash + v.card + v.terminal).toBe(v.received);
  });
  it("eski javobda terminal_total yo'q → 0", () => {
    expect(accountingRowView(fig({ total_sales: "100" })).terminal).toBe(0);
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

describe("§4 — AI katalog ruxsati (`ai_catalog`)", () => {
  // ⚠️ Jonli matritsa (20.08.2026) 19 kalit yuboradi va ular orasida `ai_catalog` bor.
  //    Sahifa `ai_settings` bilan bog'langan edi: shu kalit berilgan xodim menyuda
  //    hech nima ko'rmasdi, developer esa (hamma kalit bor) ko'rardi.
  it("`ai_catalog` berilgan xodim menyuda AI katalogni KO'RADI", () => {
    expect(visibleScreens(false, ["ai_catalog"])).toContain("aiCatalog");
  });

  it("faqat `catalog` berilgan xodimga AI katalog KO'RINMAYDI", () => {
    const v = visibleScreens(false, ["catalog"]);
    expect(v).toContain("katalog");
    expect(v).not.toContain("aiCatalog");
  });

  it("`ai_settings` (AI yordamchi) o'zi AI katalogni ochmaydi", () => {
    const v = visibleScreens(false, ["ai_settings"]);
    expect(v).toContain("ai");
    expect(v).not.toContain("aiCatalog");
  });
});
