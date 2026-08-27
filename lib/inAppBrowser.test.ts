import { describe, expect, it } from "vitest";
import { androidIntentUrl, detectInApp, detectPlatform, geoAdvice } from "./inAppBrowser";

const IG_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 336.0.0.25.90 (iPhone14,3; iOS 17_5; en_US)";
const IG_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 336.0.0.34.109 Android";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";

describe("detectInApp", () => {
  it("Instagram webview'ini ikkala platformada ham taniydi", () => {
    expect(detectInApp(IG_IOS)).toBe("instagram");
    expect(detectInApp(IG_ANDROID)).toBe("instagram");
  });
  it("Facebook / TikTok / Telegram", () => {
    expect(detectInApp("... FBAN/FBIOS;FBAV/450.0 ...")).toBe("facebook");
    expect(detectInApp("... BytedanceWebview/d8a21c ...")).toBe("tiktok");
    expect(detectInApp("... Telegram-Android/10.2 ...")).toBe("telegram");
  });
  it("oddiy brauzerda null", () => {
    expect(detectInApp(SAFARI)).toBeNull();
    expect(detectInApp(CHROME)).toBeNull();
  });
});

describe("detectPlatform", () => {
  it("iOS va Android ajratiladi", () => {
    expect(detectPlatform(IG_IOS)).toBe("ios");
    expect(detectPlatform(IG_ANDROID)).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0)")).toBe("other");
  });
});

describe("androidIntentUrl", () => {
  it("https havolani intent'ga o'giradi, kodni saqlaydi", () => {
    expect(androidIntentUrl("https://euroflowers.cognilabs.org/loc/147?t=9f2b")).toBe(
      "intent://euroflowers.cognilabs.org/loc/147?t=9f2b#Intent;scheme=https;end",
    );
  });
});

describe("geoAdvice", () => {
  it("in-app brauzerda — tashqi brauzer taklif qilinadi", () => {
    const a = geoAdvice(1, "instagram", "ios");
    expect(a.openExternal).toBe(true);
    expect(a.text).toContain("Instagram");
    expect(a.hint).toContain("···");
  });
  it("Androidda in-app — yo'riqnoma menyusiz", () => {
    expect(geoAdvice(2, "instagram", "android").hint).not.toContain("···");
  });
  it("oddiy brauzerda ruxsat rad etilsa — tashqi brauzer taklif qilinmaydi", () => {
    const a = geoAdvice(1, null, "android");
    expect(a.openExternal).toBe(false);
    expect(a.text).toContain("ruxsat berilmadi");
  });
  it("timeout va noma'lum xato alohida matn beradi", () => {
    expect(geoAdvice(3, null, "ios").text).toContain("uzoq davom etdi");
    expect(geoAdvice(0, null, "other").text).toContain("aniqlab bo'lmadi");
  });
});
