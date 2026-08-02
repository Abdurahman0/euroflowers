import { describe, it, expect } from "vitest";
import { reservationUrgency, addDays, paymentProgress } from "./reservation";

describe("reservationUrgency — desired_date shoshilinchligi", () => {
  const today = "2026-08-02";
  it("o'tgan sana → overdue", () => expect(reservationUrgency("2026-08-01", today)).toBe("overdue"));
  it("bugun → today", () => expect(reservationUrgency("2026-08-02", today)).toBe("today"));
  it("ertaga → soon", () => expect(reservationUrgency("2026-08-03", today)).toBe("soon"));
  it("keyinroq → future", () => expect(reservationUrgency("2026-08-10", today)).toBe("future"));
  it("sanasiz → none", () => { expect(reservationUrgency(null, today)).toBe("none"); expect(reservationUrgency("", today)).toBe("none"); });
  it("ISO datetime ham (faqat kun qismi olinadi)", () => expect(reservationUrgency("2026-08-02T18:00:00", today)).toBe("today"));
});

describe("addDays", () => {
  it("kun qo'shadi (oy chegarasida ham)", () => {
    expect(addDays("2026-08-02", 1)).toBe("2026-08-03");
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-08-02", -1)).toBe("2026-08-01");
  });
});

describe("paymentProgress — to'langan/qoldiq/foiz", () => {
  it("qisman to'langan", () => {
    expect(paymentProgress("200000", "500000")).toEqual({ paid: 200000, total: 500000, remaining: 300000, pct: 40, full: false });
  });
  it("to'liq to'langan → full, remaining 0, 100%", () => {
    expect(paymentProgress("500000", "500000")).toEqual({ paid: 500000, total: 500000, remaining: 0, pct: 100, full: true });
  });
  it("ortiqcha to'langan → 100% ceil, remaining 0, full", () => {
    expect(paymentProgress("600000", "500000")).toEqual({ paid: 600000, total: 500000, remaining: 0, pct: 100, full: true });
  });
  it("total 0 / null → 0%, full=false", () => {
    expect(paymentProgress("0", "0")).toEqual({ paid: 0, total: 0, remaining: 0, pct: 0, full: false });
    expect(paymentProgress(null, null)).toEqual({ paid: 0, total: 0, remaining: 0, pct: 0, full: false });
  });
});
