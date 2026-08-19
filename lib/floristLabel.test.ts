import { describe, it, expect } from "vitest";
import { floristLabel } from "./floristLabel";

/**
 * ⚠️ NEGA SINALADI: xato jimgina bo'ladi — ekranda ism o'rniga «#4» chiqadi va
 * hech narsa buzilmagandek ko'rinadi. Aynan shu holat jonli katalogda bo'lgan.
 */

describe("floristLabel — ikkala shakl ham", () => {
  it("⚠️ YUPQA shakl (katalog `florist_detail`) — `name` dan o'qiydi, «#4» EMAS", () => {
    const slim = { id: 4, name: "Abror", staff_type: "florist", phone: "", user: 8 };
    expect(floristLabel(slim)).toBe("Abror");
    expect(floristLabel(slim)).not.toBe("#4");
  });

  it("TO'LIQ shakl (/api/florists/) — user_detail dan", () => {
    expect(floristLabel({ id: 4, user_detail: { first_name: "Abror", last_name: "Rahimov" } })).toBe("Abror Rahimov");
    expect(floristLabel({ id: 4, user_detail: { username: "abror" } })).toBe("abror");
  });

  it("⚠️ tayyor `florist_name` — hammasidan USTUN", () => {
    expect(floristLabel({ id: 4, name: "Eski" }, "Abror")).toBe("Abror");
    expect(floristLabel(null, "Abror")).toBe("Abror");
    expect(floristLabel(undefined, "  Isroil  ")).toBe("Isroil");
  });

  it("bo'sh qiymatlar keyingi manbaga o'tadi", () => {
    expect(floristLabel({ id: 4, name: "   ", user_detail: { first_name: "Bekzod" } })).toBe("Bekzod");
    expect(floristLabel({ id: 4, name: "Abror" }, "   ")).toBe("Abror");
  });

  it("⚠️ ism UMUMAN yo'q — «#id» chiqadi (nosozlik yashirilmaydi)", () => {
    expect(floristLabel({ id: 7 })).toBe("#7");
    expect(floristLabel({ id: 7, user_detail: null })).toBe("#7");
  });

  it("florist yo'q → bo'sh satr (qator chizilmaydi)", () => {
    expect(floristLabel(null)).toBe("");
    expect(floristLabel(undefined)).toBe("");
    expect(floristLabel({})).toBe("");
  });

  it("jonli katalog javobidagi uchala florist", () => {
    expect(floristLabel({ id: 4, name: "Abror" })).toBe("Abror");
    expect(floristLabel({ id: 6, name: "Bekzod" })).toBe("Bekzod");
    expect(floristLabel({ id: 7, name: "Isroil" })).toBe("Isroil");
  });
});
