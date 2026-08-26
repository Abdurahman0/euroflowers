import { describe, expect, it } from "vitest";
import { fmtCoords, pickAddress } from "./reverseGeocode";

describe("fmtCoords", () => {
  it("5 kasr xonagacha ko'rsatadi", () => {
    expect(fmtCoords(41.29950001, 69.2401)).toBe("41.29950, 69.24010");
  });
});

describe("pickAddress", () => {
  it("display_name ni oladi", () => {
    expect(pickAddress({ display_name: " Seul ko'chasi, Toshkent " })).toBe("Seul ko'chasi, Toshkent");
  });
  it("xato yoki bo'sh javobda bo'sh satr", () => {
    expect(pickAddress({ error: "Unable to geocode" })).toBe("");
    expect(pickAddress({})).toBe("");
    expect(pickAddress(null)).toBe("");
    expect(pickAddress("matn")).toBe("");
  });
});
