import { describe, it, expect } from "vitest";
import {
  buildExpenseQuery, expenseFiltersToParams, expensePageCount, expenseTotalsView,
  expenseNum, spentAtPayload, byDayChronological, byCategoryDesc,
  validateExpense, buildExpensePayload, buildExpenseEditPayload,
  EXPENSE_PAGE_SIZE_MAX, type ExpenseForm,
} from "./expenses";

// 2026-08-04 09:30 Toshkent
const NOW = Date.parse("2026-08-04T04:30:00Z");
const FORM = (o: Partial<ExpenseForm> = {}): ExpenseForm => ({
  amount: "150000", destination: "Kuryerga", category: "transport",
  payment_method: "cash", spent_at: "", note: "", ...o,
});

describe("expenseNum — `amount` STRING decimal keladi", () => {
  it("string decimal", () => expect(expenseNum("150000.00")).toBe(150000));
  it("number", () => expect(expenseNum(150000)).toBe(150000));
  it("bo'sh/null → 0", () => {
    expect(expenseNum("")).toBe(0);
    expect(expenseNum(null)).toBe(0);
  });
  it("⚠️ satr TAQQOSLANMAYDI: '90000' < '150000' satrda TESKARI, raqamda to'g'ri", () => {
    expect(expenseNum("90000.00") < expenseNum("150000.00")).toBe(true);
    expect("90000.00" < "150000.00").toBe(false); // satr taqqoslash — noto'g'ri
  });
});

describe("⚠️ buildExpenseQuery — RO'YXAT va YIG'INDI AYNAN bir xil filtr oladi", () => {
  const f = { dateFrom: "2026-08-01", dateTo: "2026-08-31", category: "rent",
    paymentMethod: "card", minAmount: "1000", maxAmount: "500000", search: "ijara", page: 3 };
  it("ro'yxat: filtrlar + sahifalash", () => {
    expect(buildExpenseQuery(f)).toEqual({
      date_from: "2026-08-01", date_to: "2026-08-31", category: "rent", payment_method: "card",
      min_amount: 1000, max_amount: 500000, search: "ijara", page: 3, page_size: 20,
    });
  });
  it("⚠️ yig'indi: AYNAN o'sha filtrlar, sahifalashsiz", () => {
    const sum = buildExpenseQuery(f, true);
    expect(sum).toEqual({
      date_from: "2026-08-01", date_to: "2026-08-31", category: "rent", payment_method: "card",
      min_amount: 1000, max_amount: 500000, search: "ijara",
    });
    // sahifalashdan boshqa HAMMA kalit bir xil bo'lishi SHART
    const list = buildExpenseQuery(f);
    delete (list as Record<string, unknown>).page;
    delete (list as Record<string, unknown>).page_size;
    expect(sum).toEqual(list);
  });
  it("bo'sh filtrlar yuborilmaydi", () => {
    expect(buildExpenseQuery({})).toEqual({ page_size: 20 });
    expect(buildExpenseQuery({ search: "   ", minAmount: "", category: "" })).toEqual({ page_size: 20 });
  });
  it("sukut tartib yuborilmaydi (ortiqcha parametr)", () => {
    expect("ordering" in buildExpenseQuery({ ordering: "-spent_at" })).toBe(false);
    expect(buildExpenseQuery({ ordering: "amount" }).ordering).toBe("amount");
  });
  it("page_size 100 dan oshmaydi", () => {
    expect(buildExpenseQuery({ pageSize: 999 }).page_size).toBe(EXPENSE_PAGE_SIZE_MAX);
  });
  it("summa oralig'i RAQAM sifatida ketadi", () => {
    expect(buildExpenseQuery({ minAmount: "1000" }).min_amount).toBe(1000);
  });
});

describe("expenseFiltersToParams — URL", () => {
  it("bo'shlari tushiriladi", () => expect(expenseFiltersToParams({})).toEqual({}));
  it("hammasi birga", () => {
    expect(expenseFiltersToParams({ dateFrom: "2026-08-01", category: "rent", paymentMethod: "cash", search: "x", page: 2 }))
      .toEqual({ date_from: "2026-08-01", category: "rent", pm: "cash", q: "x", page: "2" });
  });
});

describe("⚠️ spentAtPayload — BO'SH bo'lsa kalit YUBORILMAYDI (katalog/chiqimdan FARQLI)", () => {
  it("⚠️ BO'SH → {} — backend hozirgi vaqtni o'zi qo'yadi", () => {
    expect(spentAtPayload("", NOW)).toEqual({});
    expect(spentAtPayload(null, NOW)).toEqual({});
    expect(spentAtPayload(undefined, NOW)).toEqual({});
  });
  it("⚠️ sana tanlansa → T00:00:00+05:00 (spec: faqat sana bo'lsa yarim tun)", () => {
    expect(spentAtPayload("2026-08-01", NOW)).toEqual({ spent_at: "2026-08-01T00:00:00+05:00" });
  });
  it("BUGUN tanlansa ham yuboriladi (ongli tanlov)", () => {
    expect(spentAtPayload("2026-08-04", NOW)).toEqual({ spent_at: "2026-08-04T00:00:00+05:00" });
  });
  it("natijada 'Z' YO'Q, DOIM +05:00", () => {
    const p = spentAtPayload("2026-08-01", NOW).spent_at!;
    expect(p.endsWith("+05:00")).toBe(true);
    expect(p).not.toContain("Z");
  });
  it("KELAJAK → yuborilmaydi (klient himoyasi)", () => {
    expect(spentAtPayload("2026-12-31", NOW)).toEqual({});
  });
  it("buzuq satr → yuborilmaydi", () => {
    expect(spentAtPayload("2026-8-1", NOW)).toEqual({});
    expect(spentAtPayload("salom", NOW)).toEqual({});
  });
});

describe("⚠️ byDayChronological — server ENG YANGI KUNNI BIRINCHI beradi", () => {
  it("spec javobidagi tartib teskarisiga o'giriladi", () => {
    const server = [{ date: "2026-08-04", total: "200000.00" }, { date: "2026-08-01", total: "2500000.00" }];
    expect(byDayChronological(server).map((d) => d.date)).toEqual(["2026-08-01", "2026-08-04"]);
  });
  it("⚠️ grafik o'qi TESKARI bo'lib qolmasin — birinchi element ENG ESKI", () => {
    const r = byDayChronological([{ date: "2026-08-10" }, { date: "2026-08-02" }, { date: "2026-08-07" }]);
    expect(r.map((d) => d.date)).toEqual(["2026-08-02", "2026-08-07", "2026-08-10"]);
  });
  it("asl massiv O'ZGARMAYDI (nusxa qaytariladi)", () => {
    const src = [{ date: "2026-08-04" }, { date: "2026-08-01" }];
    byDayChronological(src);
    expect(src[0].date).toBe("2026-08-04");
  });
  it("bo'sh/yo'q → bo'sh", () => {
    expect(byDayChronological(null)).toEqual([]);
    expect(byDayChronological([])).toEqual([]);
  });
});

describe("byCategoryDesc — KATTADAN kichikka", () => {
  it("summa bo'yicha kamayish tartibida", () => {
    const r = byCategoryDesc([{ total: "1200000.00" }, { total: "2500000.00" }, { total: "300000" }]);
    expect(r.map((x) => expenseNum(x.total))).toEqual([2500000, 1200000, 300000]);
  });
});

describe("validateExpense — SERVER qoidasi bilan bir xil", () => {
  it("to'g'ri forma", () => expect(validateExpense(FORM()).ok).toBe(true));
  it("summa 0 → xato (server matni bilan bir xil)", () => {
    expect(validateExpense(FORM({ amount: "0" })).errors.amount).toBe("Summa noldan katta bo'lishi kerak");
  });
  it("summa bo'sh → xato", () => expect(validateExpense(FORM({ amount: "" })).ok).toBe(false));
  it("qayerga ketdi bo'sh → xato (server matni)", () => {
    expect(validateExpense(FORM({ destination: "  " })).errors.destination).toBe("Pul qayerga ketganini yozing");
  });
});

describe("buildExpensePayload", () => {
  it("sanasiz — spec'dagi POST namunasi", () => {
    expect(buildExpensePayload(FORM({ note: "Chilonzorga dastafka" }), NOW)).toEqual({
      amount: "150000", destination: "Kuryerga", category: "transport",
      payment_method: "cash", note: "Chilonzorga dastafka",
    });
  });
  it("⚠️ sanasiz payloadda `spent_at` kaliti UMUMAN YO'Q", () => {
    expect("spent_at" in buildExpensePayload(FORM(), NOW)).toBe(false);
  });
  it("sana bilan", () => {
    expect(buildExpensePayload(FORM({ spent_at: "2026-08-01" }), NOW).spent_at).toBe("2026-08-01T00:00:00+05:00");
  });
  it("bo'sh izoh → kalit yo'q", () => {
    expect("note" in buildExpensePayload(FORM({ note: "   " }), NOW)).toBe(false);
  });
});

describe("buildExpenseEditPayload — FAQAT o'zgargan kalitlar", () => {
  const orig = { amount: "150000.00", destination: "Kuryerga", category: "transport",
    payment_method: "cash", note: "eski", spent_at: "2026-08-01T00:00:00+05:00" };
  it("hech narsa o'zgarmadi → BO'SH", () => {
    expect(buildExpenseEditPayload(orig, FORM({ note: "eski", spent_at: "2026-08-01" }), NOW)).toEqual({});
  });
  it("faqat summa", () => {
    expect(buildExpenseEditPayload(orig, FORM({ amount: "200000", note: "eski", spent_at: "2026-08-01" }), NOW))
      .toEqual({ amount: "200000" });
  });
  it("⚠️ summa satrda «150000.00» ↔ «150000» — o'zgarish DEB HISOBLANMAYDI", () => {
    expect(buildExpenseEditPayload(orig, FORM({ amount: "150000", note: "eski", spent_at: "2026-08-01" }), NOW)).toEqual({});
  });
  it("sana boshqa kunga o'zgardi → yuboriladi", () => {
    expect(buildExpenseEditPayload(orig, FORM({ note: "eski", spent_at: "2026-08-03" }), NOW).spent_at)
      .toBe("2026-08-03T00:00:00+05:00");
  });
  it("sana tozalandi (bo'sh) → yuborilmaydi (tegilmagan deb qaraladi)", () => {
    expect("spent_at" in buildExpenseEditPayload(orig, FORM({ note: "eski", spent_at: "" }), NOW)).toBe(false);
  });
});

describe("expenseTotalsView / expensePageCount", () => {
  it("server jamilarini AYNAN o'qiydi", () => {
    expect(expenseTotalsView({
      period: { date_from: null, date_to: null },
      totals: { expense_count: 12, total: "4350000.00", average: "362500.00" },
      by_category: [], by_payment_method: [], by_day: [],
    })).toEqual({ count: 12, total: 4350000, average: 362500 });
  });
  it("yig'indi yo'q → nollar", () => {
    expect(expenseTotalsView(null)).toEqual({ count: 0, total: 0, average: 0 });
  });
  it("sahifalar soni", () => {
    expect(expensePageCount(41, 20)).toBe(3);
    expect(expensePageCount(0, 20)).toBe(1);
  });
});
