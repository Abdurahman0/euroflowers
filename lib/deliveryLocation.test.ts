import { describe, expect, it } from "vitest";
import { coord, deliveryPayload, locOutcome, parseLeadId, readToken } from "./deliveryLocation";

describe("parseLeadId", () => {
  it("musbat butun sonni oladi", () => expect(parseLeadId("147")).toBe(147));
  it("catch-all segment massivini ham oladi", () => expect(parseLeadId(["147"])).toBe(147));
  it("son bo'lmasa null", () => {
    expect(parseLeadId("abc")).toBeNull();
    expect(parseLeadId("14.7")).toBeNull();
    expect(parseLeadId("-5")).toBeNull();
    expect(parseLeadId("0")).toBeNull();
    expect(parseLeadId(undefined)).toBeNull();
  });
});

describe("readToken", () => {
  it("kodni o'zgartirmaydi va kesmaydi", () => {
    expect(readToken("9f2b71a4c3")).toBe("9f2b71a4c3");
    expect(readToken(" 9f2b ")).toBe(" 9f2b "); // trim YO'Q — kod aynan qaytadi
    expect(readToken("AbC-_=+/")).toBe("AbC-_=+/");
  });
  it("kod yo'q bo'lsa bo'sh satr", () => {
    expect(readToken(null)).toBe("");
    expect(readToken(undefined)).toBe("");
  });
});

describe("coord", () => {
  it("7 kasr xonagacha yaxlitlaydi", () => {
    expect(coord(41.29950000000001)).toBe(41.2995);
    expect(coord(69.24012345678)).toBe(69.2401235);
  });
});

describe("deliveryPayload", () => {
  it("kontraktdagi maydonlarni beradi", () => {
    expect(deliveryPayload(147, "9f2b71a4c3", 41.2995, 69.2401, " Bobur ko'chasi 10 ")).toEqual({
      lead_id: 147,
      token: "9f2b71a4c3",
      latitude: 41.2995,
      longitude: 69.2401,
      address: "Bobur ko'chasi 10",
    });
  });
  it("manzil yo'q bo'lsa bo'sh satr yuboriladi", () => {
    expect(deliveryPayload(1, "t", 1, 2, "").address).toBe("");
  });
  it("manzil 255 belgidan uzun bo'lsa kesiladi", () => {
    expect(deliveryPayload(1, "t", 1, 2, "x".repeat(400)).address).toHaveLength(255);
  });
});

describe("locOutcome", () => {
  it("200 OK → qabul qilindi", () => expect(locOutcome(200, { status: "OK" })).toBe("ok"));
  it("200 SKIPPED → havola eskirgan", () => expect(locOutcome(200, { status: "SKIPPED" })).toBe("expired"));
  it("403 REJECTED → havola eskirgan", () => expect(locOutcome(403, { status: "REJECTED" })).toBe("expired"));
  it("400 → qaytadan belgilash", () => expect(locOutcome(400, { latitude: ["kerak"] })).toBe("retry"));
  it("500 yoki tanasiz javob → umumiy xatolik", () => {
    expect(locOutcome(500, null)).toBe("error");
    expect(locOutcome(0, null)).toBe("error");
  });
  it("200 tanasi bo'sh bo'lsa ham qabul qilingan deb hisoblaydi", () => {
    expect(locOutcome(200, null)).toBe("ok");
  });
});
