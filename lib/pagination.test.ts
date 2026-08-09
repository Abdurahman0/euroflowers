import { describe, it, expect } from "vitest";
import {
  ALL_PAGE_SIZE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE,
  buildListQuery, clampPage, clampPageSize, countMapOf, mapCount, pageNumbers,
  pageStateToParams, readPageInfo, readPageState, resetPageOnFilterChange,
  sourceMapOf, totalOf, totalsNum,
} from "./pagination";
import type { Paginated } from "./types";

/**
 * SAHIFALASH VA JAMILAR (lib/pagination.ts).
 *
 * ⚠️ NEGA SINALADI: bu yerdagi xatolar JIMGINA bo'ladi — ekranda ishonchli
 * ko'rinadigan, lekin NOTO'G'RI raqam chiqadi. Aynan shu tarzda audit jurnali
 * 2482 yozuvdan 500 tasini «jami» deb ko'rsatib yurgan edi.
 */

const body = <T,>(over: Partial<Paginated<T>> = {}): Paginated<T> => ({
  count: 154, page: 1, page_size: 30, total_pages: 6, has_next: true, has_previous: false,
  next: "https://x/api/catalog/?page=2", previous: null, results: [] as T[], ...over,
});

describe("clampPage / clampPageSize", () => {
  it("sahifa — 1 dan kichik yoki buzuq bo'lsa 1", () => {
    expect(clampPage(3)).toBe(3);
    expect(clampPage("4")).toBe(4);
    for (const v of [0, -2, "abc", null, undefined, NaN, ""]) expect(clampPage(v)).toBe(1);
  });
  it("⚠️ hajm SERVER SHIFTIGA soladi — 200 dan katta so'ralmaydi", () => {
    expect(clampPageSize(50)).toBe(50);
    expect(clampPageSize(201)).toBe(MAX_PAGE_SIZE);
    expect(clampPageSize(5000)).toBe(MAX_PAGE_SIZE);
  });
  it("buzuq hajm → sukut", () => {
    for (const v of ["abc", null, undefined, NaN]) expect(clampPageSize(v)).toBe(DEFAULT_PAGE_SIZE);
  });
  it("`all` / 0 / -1 — hammasi «hammasi» degani (spec)", () => {
    for (const v of ["all", "0", 0, -1]) expect(clampPageSize(v)).toBe(ALL_PAGE_SIZE);
  });
});

describe("URL — sahifa saqlanadi", () => {
  it("o'qish", () => {
    expect(readPageState("?page=4&page_size=50")).toEqual({ page: 4, pageSize: 50 });
    expect(readPageState("")).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });
  it("sukut qiymatlar URL'ga YOZILMAYDI (havola toza qoladi)", () => {
    expect(pageStateToParams({ page: 1, pageSize: DEFAULT_PAGE_SIZE })).toEqual({});
    expect(pageStateToParams({ page: 3, pageSize: 50 })).toEqual({ page: "3", page_size: "50" });
  });
  it("aylanma — yozilgani qayta o'qilganda AYNAN o'zi", () => {
    const st = { page: 7, pageSize: 100 };
    expect(readPageState("?" + new URLSearchParams(pageStateToParams(st)).toString())).toEqual(st);
  });
  it("buzuq URL yiqitmaydi", () => {
    expect(readPageState("?page=-3&page_size=9999")).toEqual({ page: 1, pageSize: MAX_PAGE_SIZE });
  });
});

describe("⚠️ FILTR o'zgarsa SAHIFA 1 GA qaytadi", () => {
  const cur = { page: 5, pageSize: 30 };
  it("filtr o'zgardi → 1-sahifa", () => {
    expect(resetPageOnFilterChange({ status: "" }, { status: "sold" }, cur).page).toBe(1);
  });
  it("filtr o'zgarmadi → sahifa JOYIDA (foydalanuvchi 5-sahifada qoladi)", () => {
    expect(resetPageOnFilterChange({ status: "sold" }, { status: "sold" }, cur).page).toBe(5);
  });
  it("yangi kalit qo'shilsa ham qaytadi", () => {
    expect(resetPageOnFilterChange({}, { florist: "3" }, cur).page).toBe(1);
  });
  it("undefined va bo'sh satr BIR XIL deb qaraladi (bekorga qaytarmaydi)", () => {
    expect(resetPageOnFilterChange({ q: undefined }, { q: "" }, cur).page).toBe(5);
  });
});

describe("buildListQuery", () => {
  it("bo'sh filtrlar TUSHIRILADI", () => {
    const q = buildListQuery({ a: "", b: undefined, c: null, d: false, e: "bor" }, { page: 1, pageSize: 30 });
    expect(q).toEqual({ e: "bor", page_size: 30 });
  });
  it("1-sahifada `page` yuborilmaydi (URL ham, so'rov ham toza)", () => {
    expect("page" in buildListQuery({}, { page: 1, pageSize: 30 })).toBe(false);
    expect(buildListQuery({}, { page: 3, pageSize: 30 }).page).toBe(3);
  });
  it("⚠️ `all` da `page` YUBORILMAYDI — bitta sahifa bor xolos", () => {
    const q = buildListQuery({}, { page: 4, pageSize: ALL_PAGE_SIZE });
    expect(q.page_size).toBe("all");
    expect("page" in q).toBe(false);
  });
});

describe("readPageInfo — ⚠️ SERVER raqamlari USTUN", () => {
  it("server bergan `total_pages` / `has_next` AYNAN olinadi", () => {
    const i = readPageInfo(body({ page: 2, total_pages: 6, has_next: true, has_previous: true, results: new Array(30).fill(0) }), { page: 2, pageSize: 30 });
    expect(i.totalPages).toBe(6);
    expect(i.hasNext).toBe(true);
    expect(i.hasPrevious).toBe(true);
    expect(i.count).toBe(154);
  });
  it("⚠️ server `total_pages` bergan bo'lsa, `count/page_size` dan HISOBLANMAYDI", () => {
    // ataylab «noto'g'ri» — 154/30 = 6 bo'lsa ham serverniki 99 desa, 99 chiqadi
    expect(readPageInfo(body({ total_pages: 99 }), { page: 1, pageSize: 30 }).totalPages).toBe(99);
  });
  it("eski javob (sahifa maydonlarisiz) — zaxira hisob ishlaydi", () => {
    const legacy = { count: 154, next: "x", previous: null, results: new Array(30).fill(0) } as Paginated<number>;
    const i = readPageInfo(legacy, { page: 2, pageSize: 30 });
    expect(i.totalPages).toBe(6);
    expect(i.hasNext).toBe(true);
    expect(i.page).toBe(2);
  });
  it("«31–60 / 154» oralig'i", () => {
    const i = readPageInfo(body({ page: 2, results: new Array(30).fill(0) }), { page: 2, pageSize: 30 });
    expect([i.from, i.to]).toEqual([31, 60]);
  });
  it("bo'sh ro'yxat — 0 dan 0 gacha (1–0 kabi bema'nilik chiqmaydi)", () => {
    const i = readPageInfo(body({ count: 0, total_pages: 1, has_next: false, results: [] }), { page: 1, pageSize: 30 });
    expect([i.from, i.to, i.count]).toEqual([0, 0, 0]);
  });
  it("javob YO'Q (hali yuklanmagan) — yiqilmaydi", () => {
    const i = readPageInfo(null, { page: 1, pageSize: 30 });
    expect([i.count, i.totalPages, i.hasNext]).toEqual([0, 1, false]);
  });
});

describe("pageNumbers", () => {
  it("kam sahifa — hammasi", () => expect(pageNumbers(1, 3)).toEqual([1, 2, 3]));
  it("bitta sahifa", () => expect(pageNumbers(1, 1)).toEqual([1]));
  it("o'rtada — ikki tomonda «…»", () => expect(pageNumbers(10, 20)).toEqual([1, -1, 9, 10, 11, -1, 20]));
  it("boshida — chapda «…» yo'q", () => expect(pageNumbers(2, 20)).toEqual([1, 2, 3, -1, 20]));
  it("oxirida — o'ngda «…» yo'q", () => expect(pageNumbers(19, 20)).toEqual([1, -1, 18, 19, 20]));
  it("takroriy raqam chiqmaydi", () => {
    const ns = pageNumbers(3, 5).filter((n) => n !== -1);
    expect(ns.length).toBe(new Set(ns).size);
  });
});

describe("⚠️ JAMI — `totals`/`count` dan, HECH QACHON results.length dan", () => {
  it("`totals` dagi kalit ustun", () => {
    expect(totalOf(body({ totals: { items: 154 }, results: new Array(30).fill(0) }), "items")).toBe(154);
  });
  it("`totals` yo'q → `count`", () => {
    expect(totalOf(body({ results: new Array(30).fill(0) }))).toBe(154);
  });
  it("⚠️ kalit YO'Q bo'lsa ham `results.length` GA TUSHMAYDI — `count` ga tushadi", () => {
    const b = body({ totals: { boshqa: 1 }, results: new Array(30).fill(0) });
    expect(totalOf(b, "items")).toBe(154);
    expect(totalOf(b, "items")).not.toBe(30);
  });
  it("javob yo'q → 0 (30 emas)", () => expect(totalOf(null, "items")).toBe(0));
});

describe("totals o'qish — pul STRING, sonlar int", () => {
  const totals = { items: 154, remaining_value: "26900000.00", cost_total: "68615500.00" };
  it("pul satri songa aylanadi", () => {
    expect(totalsNum(totals, "remaining_value")).toBe(26_900_000);
    expect(totalsNum(totals, "cost_total")).toBe(68_615_500);
  });
  it("yo'q kalit → 0 (NaN emas)", () => {
    expect(totalsNum(totals, "yoq")).toBe(0);
    expect(Number.isNaN(totalsNum(totals, "yoq"))).toBe(false);
    expect(totalsNum(undefined, "items")).toBe(0);
  });
});

describe("⚠️ by_* — FAQAT mavjud kalitlar keladi, `?? 0` bilan o'qiladi", () => {
  // jonli javob: bitta ham arxiv bo'lmasa `archived` kaliti UMUMAN kelmaydi
  const totals = { by_status: { available: 38, sold: 102 } };
  it("mavjud kalit", () => expect(mapCount(countMapOf(totals, "by_status"), "sold")).toBe(102));
  it("YO'Q kalit → 0, NaN emas", () => {
    const m = countMapOf(totals, "by_status");
    expect(mapCount(m, "archived")).toBe(0);
    expect(Number.isNaN(mapCount(m, "archived"))).toBe(false);
  });
  it("butun blok yo'q bo'lsa — bo'sh xarita", () => {
    expect(countMapOf({}, "by_status")).toEqual({});
    expect(countMapOf(undefined, "by_status")).toEqual({});
    expect(mapCount(countMapOf(undefined, "by_status"), "sold")).toBe(0);
  });
  it("by_source — {count, amount}, amount STRING dan songa", () => {
    const m = sourceMapOf({ by_source: { catalog: { count: 211, amount: "10380000.00" } } }, "by_source");
    expect(m.catalog).toEqual({ count: 211, amount: 10_380_000 });
    expect(m.yoq).toBeUndefined();
  });
});
