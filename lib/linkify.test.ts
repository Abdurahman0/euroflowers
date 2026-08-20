import { describe, it, expect } from "vitest";
import { splitLinks, linkLabel } from "./linkify";

// AI media handoff: mijoz Instagram havolasini yuboradi, AI tushunmaydi va
// havolani operatorga uzatadi — operator uni CRM chatida BOSA olishi kerak.

describe("LK1 — havolani matndan ajratish", () => {
  it("faqat havola", () => {
    expect(splitLinks("https://www.instagram.com/stories/shop/123")).toEqual([
      { type: "url", value: "https://www.instagram.com/stories/shop/123" },
    ]);
  });

  it("matn + havola + matn", () => {
    expect(splitLinks("Mana shu https://t.me/x qanchaga?")).toEqual([
      { type: "text", value: "Mana shu " },
      { type: "url", value: "https://t.me/x" },
      { type: "text", value: " qanchaga?" },
    ]);
  });

  it("bir nechta havola", () => {
    const out = splitLinks("https://a.uz/1 va https://b.uz/2");
    expect(out.filter((p) => p.type === "url").map((p) => p.value)).toEqual(["https://a.uz/1", "https://b.uz/2"]);
  });

  it("havolasiz matn butunligicha qoladi", () => {
    expect(splitLinks("Salom, narxi qancha?")).toEqual([{ type: "text", value: "Salom, narxi qancha?" }]);
  });

  it("bo'sh matn → bo'sh ro'yxat", () => {
    expect(splitLinks("")).toEqual([]);
  });
});

describe("LK2 — oxiridagi tinish belgisi havolaga KIRMAYDI", () => {
  it("nuqta", () => {
    expect(splitLinks("Qarang: https://euroflowers.uz/katalog.")).toEqual([
      { type: "text", value: "Qarang: " },
      { type: "url", value: "https://euroflowers.uz/katalog" },
      { type: "text", value: "." },
    ]);
  });

  it("qavs ichidagi havola", () => {
    const out = splitLinks("(https://a.uz/x)");
    expect(out.find((p) => p.type === "url")?.value).toBe("https://a.uz/x");
  });

  it("havolaning o'zidagi qavs saqlanadi", () => {
    expect(splitLinks("https://a.uz/w_(x)").find((p) => p.type === "url")?.value).toBe("https://a.uz/w_(x)");
  });

  it("yalang'och «https://» havola sifatida olinmaydi", () => {
    expect(splitLinks("https://").every((p) => p.type === "text")).toBe(true);
  });
});

describe("LK3 — yorliq", () => {
  it("protokol va oxirgi slash olib tashlanadi", () => {
    expect(linkLabel("https://www.instagram.com/p/ABC/")).toBe("www.instagram.com/p/ABC");
  });

  it("uzun havola qisqaradi", () => {
    const long = `https://cdn.example.com/${"a".repeat(80)}`;
    expect(linkLabel(long).length).toBeLessThanOrEqual(48);
    expect(linkLabel(long).endsWith("…")).toBe(true);
  });
});
