import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dateAfterParam, dateFilterStart } from "./format";

/**
 * DAVR TANLAGICH — «oy» endi SURILUVCHI 30 kun EMAS, KALENDAR OYI.
 *
 * ⚠️ NEGA MUHIM: hisobot va kassa oy bo'yicha yuritiladi. «Oxirgi 30 kun»
 * 19-avgustda iyul oyining yarmini ham qo'shib yuborardi va oylik jamilar
 * kassa bilan hech qachon mos tushmasdi.
 */

const at = (iso: string) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); };
beforeEach(() => vi.useRealTimers());
afterEach(() => vi.useRealTimers());

describe("«oy» — shu oyning 1-kunidan bugungacha", () => {
  it("oy o'rtasida — 1-sanaga tushadi (oldingi oyga O'TMAYDI)", () => {
    at("2026-08-19T14:30:00+05:00");
    expect(dateAfterParam("oy")).toBe("2026-08-01");
  });

  it("⚠️ oyning 1-kunida — o'sha kunning o'zi (bir kunlik davr)", () => {
    at("2026-08-01T09:00:00+05:00");
    expect(dateAfterParam("oy")).toBe("2026-08-01");
  });

  it("oyning oxirgi kunida ham shu oyning 1-sanasi", () => {
    at("2026-08-31T23:00:00+05:00");
    expect(dateAfterParam("oy")).toBe("2026-08-01");
  });

  it("⚠️ yil chegarasi — 1-yanvarda oldingi yilga o'tib ketmaydi", () => {
    at("2027-01-05T10:00:00+05:00");
    expect(dateAfterParam("oy")).toBe("2027-01-01");
  });

  it("fevral (kabisa yili) ham 1-sana", () => {
    at("2028-02-29T12:00:00+05:00");
    expect(dateAfterParam("oy")).toBe("2028-02-01");
  });

  it("⚠️ ESKI xulosa bilan farq: 19-avgustda «30 kun» IYULGA tushardi", () => {
    at("2026-08-19T14:30:00+05:00");
    const eski = new Date("2026-08-19T14:30:00+05:00");
    eski.setDate(eski.getDate() - 29);
    expect(eski.getMonth()).toBe(6);              // iyul (0-indeks)
    expect(dateAfterParam("oy")).toBe("2026-08-01"); // endi avgust ichida qoladi
  });
});

describe("qolgan davrlar o'zgarmadi", () => {
  it("bugun — bugungi sana", () => {
    at("2026-08-19T14:30:00+05:00");
    expect(dateAfterParam("bugun")).toBe("2026-08-19");
  });
  it("hafta — bugun bilan birga 7 kun (bugun−6)", () => {
    at("2026-08-19T14:30:00+05:00");
    expect(dateAfterParam("hafta")).toBe("2026-08-13");
  });
  it("hafta oy chegarasidan orqaga o'tadi (bu TO'G'RI — u suriluvchi davr)", () => {
    at("2026-08-03T10:00:00+05:00");
    expect(dateAfterParam("hafta")).toBe("2026-07-28");
  });
});

describe("dateFilterStart — chip yorlig'i va so'rov BIR XIL manbadan", () => {
  it("kun boshiga tushiriladi (vaqt qismi natijaga ta'sir qilmaydi)", () => {
    at("2026-08-19T23:59:59+05:00");
    const d = dateFilterStart("oy");
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
    expect(d.getDate()).toBe(1);
  });
  it("dateAfterParam AYNAN dateFilterStart dan chiqadi", () => {
    at("2026-08-19T14:30:00+05:00");
    for (const f of ["bugun", "hafta", "oy"] as const) {
      const d = dateFilterStart(f);
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      expect(dateAfterParam(f)).toBe(s);
    }
  });
});
