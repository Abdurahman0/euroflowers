import { describe, expect, it } from "vitest";
import { mediaUrl } from "./mediaUrl";

const API = "https://euroflowers.api.cognilabs.org";

describe("mediaUrl", () => {
  it("⚠️ ildizga nisbiy yo'l API domeniga bog'lanadi (sotuv rasmlari 404 bo'lardi)", () => {
    // jonli javob (29.08.2026): sale_image_url = "/media/sales/IMG_0220.jpeg"
    expect(mediaUrl("/media/sales/IMG_0220.jpeg")).toBe(`${API}/media/sales/IMG_0220.jpeg`);
  });
  it("mutlaq havola O'ZGARMAYDI (katalog image_url shunday keladi)", () => {
    const abs = `${API}/media/uploads/photo.jpg`;
    expect(mediaUrl(abs)).toBe(abs);
    expect(mediaUrl("http://boshqa.uz/a.png")).toBe("http://boshqa.uz/a.png");
    expect(mediaUrl("//cdn.uz/a.png")).toBe("//cdn.uz/a.png");
  });
  it("data: va blob: tegilmaydi (mahalliy ko'rinish)", () => {
    expect(mediaUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
    expect(mediaUrl("blob:http://localhost:3000/abc")).toBe("blob:http://localhost:3000/abc");
  });
  it("boshidagi slashsiz yo'l ham bog'lanadi, slash ikkilanmaydi", () => {
    expect(mediaUrl("media/x.jpg")).toBe(`${API}/media/x.jpg`);
    expect(mediaUrl("/media/x.jpg")).toBe(`${API}/media/x.jpg`);
  });
  it("bo'sh qiymat — bo'sh satr", () => {
    expect(mediaUrl("")).toBe("");
    expect(mediaUrl(null)).toBe("");
    expect(mediaUrl(undefined)).toBe("");
    expect(mediaUrl("   ")).toBe("");
  });
});
