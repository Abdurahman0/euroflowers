/**
 * Ijtimoiy tarmoq ILOVASI ICHIDAGI brauzerlar (in-app webview) — Instagram,
 * Facebook, TikTok, Telegram. Ular `navigator.geolocation` ni ko'pincha
 * bloklaydi: so'rov hech qanday ruxsat oynasini ochmasdan darrov xatoga
 * tushadi (iOS'da Instagram webview'i geolokatsiya delegatini bermaydi,
 * Androidda WebView `onGeolocationPermissionsShowPrompt` ni ushlamaydi).
 *
 * Sahifa buni MAJBURAN ocholmaydi — yagona ishonchli yo'l: havolani tashqi
 * brauzerda ochish. Androidda buni `intent://` bilan bir bosishda qilamiz,
 * iOS'da esa foydalanuvchiga «…» menyusini ko'rsatamiz.
 */

export type InApp = "instagram" | "facebook" | "tiktok" | "telegram" | null;
export type Platform = "ios" | "android" | "other";

export function detectInApp(ua: string): InApp {
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "facebook";
  if (/BytedanceWebview|musical_ly|TikTok|Aweme/i.test(ua)) return "tiktok";
  if (/Telegram/i.test(ua)) return "telegram";
  return null;
}

export function detectPlatform(ua: string): Platform {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export const APP_LABEL: Record<NonNullable<InApp>, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  telegram: "Telegram",
};

/**
 * Androidda joriy havolani tashqi brauzerda ochadigan intent-manzil.
 * `package` berilmaydi — tizim foydalanuvchining standart brauzerini tanlaydi
 * (Chrome o'rnatilmagan telefonlarda ham ishlaydi).
 */
export function androidIntentUrl(href: string): string {
  const u = href.replace(/^https?:\/\//, "");
  return `intent://${u}#Intent;scheme=https;end`;
}

export type GeoAdvice = {
  /** asosiy xabar — nima bo'ldi */
  text: string;
  /** «tashqi brauzerda ochish» tugmasi ko'rsatilsinmi */
  openExternal: boolean;
  /** iOS'da qo'lda ochish yo'riqnomasi */
  hint: string;
};

/**
 * Geolokatsiya xatosi → mijozga ko'rsatiladigan maslahat.
 * `code`: 1 = ruxsat berilmadi, 2 = aniqlab bo'lmadi, 3 = vaqt tugadi,
 * 0 = brauzerda geolokatsiya umuman yo'q.
 */
export function geoAdvice(code: number, app: InApp, platform: Platform): GeoAdvice {
  if (app) {
    const name = APP_LABEL[app];
    return {
      text: `${name} ichidagi brauzer joylashuvni bermaydi.`,
      openExternal: true,
      hint:
        platform === "ios"
          ? `O'ng yuqoridagi «···» tugmasini bosib «Brauzerda ochish» ni tanlang — o'sha yerda joylashuv so'raladi.`
          : `Havolani brauzerda oching — o'sha yerda joylashuv so'raladi.`,
    };
  }
  if (code === 1)
    return {
      text: "Joylashuvga ruxsat berilmadi.",
      openExternal: false,
      hint: "Brauzer sozlamalaridan ruxsat bering yoki belgini xaritada qo'lda suring.",
    };
  if (code === 3)
    return {
      text: "Joylashuvni aniqlash uzoq davom etdi.",
      openExternal: false,
      hint: "Ochiq joyda qayta urinib ko'ring yoki belgini qo'lda suring.",
    };
  return {
    text: "Joylashuvni aniqlab bo'lmadi.",
    openExternal: false,
    hint: "Telefonda geolokatsiya yoqilganini tekshiring yoki belgini qo'lda suring.",
  };
}
