import { describe, expect, it } from "vitest";
import { fitDimensions, humanMB, ImagePrepError, isImageFile, outputName, passesAsIs, SAFE_TYPES, uploadErrorText } from "./imageFile";

describe("isImageFile", () => {
  it("telefon suratlarini qabul qiladi (HEIC/HEIF)", () => {
    expect(isImageFile("IMG_0421.HEIC", "image/heic")).toBe(true);
    expect(isImageFile("20260828_120000.heif", "image/heif")).toBe(true);
  });
  it("odatiy turlar", () => {
    for (const t of SAFE_TYPES) expect(isImageFile("a.x", t)).toBe(true);
    expect(isImageFile("a.avif", "image/avif")).toBe(true);
  });
  it("MIME bo'sh bo'lsa kengaytmaga qaraydi", () => {
    expect(isImageFile("photo.jpg", "")).toBe(true);
    expect(isImageFile("photo.HEIC", "")).toBe(true);
    expect(isImageFile("hujjat.pdf", "")).toBe(false);
    expect(isImageFile("kengaytmasiz", "")).toBe(false);
  });
  it("rasm bo'lmagan MIME rad etiladi", () => {
    expect(isImageFile("kino.mp4", "video/mp4")).toBe(false);
    expect(isImageFile("hujjat.pdf", "application/pdf")).toBe(false);
  });
});

describe("outputName", () => {
  it("kengaytmani .jpg ga almashtiradi", () => {
    expect(outputName("IMG_0421.HEIC")).toBe("IMG_0421.jpg");
    expect(outputName("gul.png")).toBe("gul.jpg");
    expect(outputName("nomsiz")).toBe("nomsiz.jpg");
    expect(outputName("")).toBe("rasm.jpg");
  });
});

describe("fitDimensions", () => {
  it("uzun tomonni chegaraga tushiradi, nisbatni saqlaydi", () => {
    expect(fitDimensions(4000, 3000, 2000)).toEqual({ w: 2000, h: 1500 });
    expect(fitDimensions(3000, 4000, 2000)).toEqual({ w: 1500, h: 2000 });
  });
  it("kichik rasmni kattalashtirmaydi", () => {
    expect(fitDimensions(800, 600, 2000)).toEqual({ w: 800, h: 600 });
  });
  it("nol o'lchamda ham yiqilmaydi", () => {
    expect(fitDimensions(0, 0, 2000)).toEqual({ w: 2000, h: 2000 });
  });
});

describe("passesAsIs", () => {
  const MAX = 4 * 1024 * 1024;
  it("kichik va standart tur — tegilmaydi", () => {
    expect(passesAsIs("image/jpeg", 500 * 1024, MAX)).toBe(true);
  });
  it("katta yoki notanish tur — qayta ishlanadi", () => {
    expect(passesAsIs("image/jpeg", 9 * 1024 * 1024, MAX)).toBe(false);
    expect(passesAsIs("image/heic", 100 * 1024, MAX)).toBe(false);
    expect(passesAsIs("", 100 * 1024, MAX)).toBe(false);
  });
});

describe("humanMB", () => {
  it("MB da ko'rsatadi", () => expect(humanMB(8 * 1048576)).toBe("8.0"));
});

describe("uploadErrorText", () => {
  it("403 — operatorga aniq sabab aytiladi", () => {
    expect(uploadErrorText({ status: 403, message: "Ruxsat yo'q" })).toContain("ruxsat yo'q");
  });
  it("401 va 413 uchun alohida matn", () => {
    expect(uploadErrorText({ status: 401, message: "x" })).toContain("Sessiya tugadi");
    expect(uploadErrorText({ status: 413, message: "x" })).toContain("juda katta");
  });
  it("boshqa API xatosida serverning o'z xabari ko'rsatiladi", () => {
    expect(uploadErrorText({ status: 400, message: "Fayl buzuq" })).toBe("Fayl buzuq");
  });
  it("tayyorlash xatosi o'zidek qaytadi", () => {
    expect(uploadErrorText(new ImagePrepError("Rasmni o'qib bo'lmadi"))).toBe("Rasmni o'qib bo'lmadi");
  });
  it("tarmoq uzilishi (status 0) — umumiy matn", () => {
    expect(uploadErrorText({ status: 0, message: "Server bilan aloqa yo'q" })).toContain("qayta urinib");
    expect(uploadErrorText(new Error("boom"))).toContain("qayta urinib");
  });
});
