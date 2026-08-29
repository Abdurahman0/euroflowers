/**
 * Rasm fayllarini yuklashdan OLDIN tayyorlash.
 *
 * Muammo: telefon surati ko'pincha `image/heic` / `image/heif` (iPhone,
 * yangi Samsung) bo'ladi yoki fayl menejeri MIME turini umuman bermaydi
 * (`file.type === ""`), bunday fayl eski qat'iy ro'yxatdan o'tmasdi.
 * Ustiga-ustak zamonaviy kamera surati 5MB dan oson oshadi.
 *
 * Yechim: turni kengroq qabul qilamiz, so'ng rasmni brauzerning o'zida
 * kichraytirib JPEG'ga o'giramiz — server har doim kichik va standart
 * fayl oladi. Dekodlab bo'lmasa (masalan Android Chrome HEIC'ni bilmaydi)
 * fayl o'zidek ketadi, faqat hajmi chegaradan oshmasa.
 */

/** Serverga ketishi kafolatlangan turlar. */
export const SAFE_TYPES = ["image/png", "image/jpeg", "image/webp"];
/** Qabul qilinadigan kengaytmalar — MIME bo'sh bo'lganda shu ishlaydi. */
export const IMAGE_EXT = /\.(png|jpe?g|jpe|webp|heic|heif|avif|gif|bmp|tiff?)$/i;

/** Fayl rasm sifatida qabul qilinadimi (MIME yoki kengaytma bo'yicha). */
export function isImageFile(name: string, type: string): boolean {
  if (type && type.toLowerCase().startsWith("image/")) return true;
  if (type) return false; // MIME bor, lekin rasm emas — pdf, video va h.k.
  return IMAGE_EXT.test(name);
}

/** Kengaytmani .jpg ga almashtirish: "IMG_0421.HEIC" → "IMG_0421.jpg". */
export function outputName(name: string): string {
  const base = (name || "rasm").replace(/\.[^./\\]+$/, "");
  return `${base || "rasm"}.jpg`;
}

/** Uzun tomonni `max` ga sig'dirish (nisbat saqlanadi, kattalashtirilmaydi). */
export function fitDimensions(w: number, h: number, max: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: max, h: max };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Fayl o'zgartirilmasdan ketaverishi mumkinmi. */
export function passesAsIs(type: string, size: number, maxBytes: number): boolean {
  return SAFE_TYPES.includes(type) && size <= maxBytes;
}

export function humanMB(bytes: number): string {
  return (bytes / 1048576).toFixed(1);
}

export class ImagePrepError extends Error {}

/**
 * Yuklash xatosi → foydalanuvchiga ko'rsatiladigan matn.
 *
 * ⚠️ Ilgari HAR QANDAY xato «Rasm yuklab bo'lmadi — qayta urinib ko'ring»
 * bo'lib chiqardi, ya'ni serverning haqiqiy sababi (masalan operatorda
 * `/api/uploads/` ga ruxsat yo'qligi) butunlay ko'rinmasdi.
 *
 * `ApiError` importsiz — status/message bo'yicha o'rdakcha tekshiruv, shunda
 * bu funksiya sof qoladi va lib/api ni tortmaydi.
 */
/**
 * Yuklash RUXSAT sababli rad etildimi (403).
 * ⚠️ Operator rolida `/api/uploads/` shunday qaytaradi — bunda maydon
 * «URL orqali» rejimiga O'ZI o'tadi, chunki katalog/AI-katalog kontrakti
 * faqat `image_url` (havola) qabul qiladi, faylni EMAS.
 */
export const isUploadForbidden = (e: unknown): boolean =>
  typeof e === "object" && e !== null && (e as { status?: unknown }).status === 403;

export function uploadErrorText(e: unknown): string {
  if (e instanceof ImagePrepError) return e.message;
  const o = typeof e === "object" && e !== null ? (e as { status?: unknown; message?: unknown }) : {};
  const status = typeof o.status === "number" ? o.status : 0;
  const msg = typeof o.message === "string" ? o.message.trim() : "";
  if (status === 403) return "Rasm yuklashga ruxsat yo'q — administratordan huquq so'rang yoki rasm havolasini qo'ying.";
  if (status === 401) return "Sessiya tugadi — tizimga qayta kiring.";
  if (status === 413) return "Rasm server uchun juda katta — kichikroq surat tanlang.";
  // tarmoq/timeout (status 0) da ham serverning O'Z matni foydali:
  // «So'rov vaqti tugadi…» / «Server bilan aloqa yo'q…»
  if (msg) return msg;
  return "Rasm yuklab bo'lmadi — qayta urinib ko'ring.";
}

/** Blobni rasmga dekodlash — avval createImageBitmap, so'ng <img>. */
async function decode(file: File): Promise<{ src: CanvasImageSource; w: number; h: number } | null> {
  if (typeof createImageBitmap === "function") {
    try {
      // EXIF burilishi hisobga olinsin (telefon suratlari yonboshlab ketmasin)
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { src: bmp, w: bmp.width, h: bmp.height };
    } catch {
      /* pastdagi <img> yo'liga tushamiz */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return { src: img, w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Yuklashga tayyor fayl qaytaradi: kerak bo'lsa kichraytirilgan JPEG.
 * @throws ImagePrepError — fayl rasm emas yoki o'qib bo'lmadi va juda katta.
 */
export async function prepareImage(
  file: File,
  { maxDim = 2000, maxBytes = 4 * 1024 * 1024, quality = 0.85 } = {},
): Promise<File> {
  if (!isImageFile(file.name, file.type)) {
    throw new ImagePrepError("Bu rasm fayli emas — surat yoki PNG/JPEG tanlang.");
  }
  if (passesAsIs(file.type, file.size, maxBytes)) return file;

  const img = await decode(file);
  if (!img) {
    // dekodlab bo'lmadi (masalan HEIC'ni bilmaydigan brauzer) — o'zidek yuboramiz,
    // faqat hajmi va turi xavfsiz bo'lsa
    if (passesAsIs(file.type, file.size, maxBytes)) return file;
    throw new ImagePrepError("Rasmni o'qib bo'lmadi — JPEG formatida qayta suratga oling yoki boshqa rasm tanlang.");
  }

  const { w, h } = fitDimensions(img.w, img.h, maxDim);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImagePrepError("Rasmni tayyorlab bo'lmadi — qayta urinib ko'ring.");
  ctx.drawImage(img.src, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new ImagePrepError("Rasmni tayyorlab bo'lmadi — qayta urinib ko'ring.");
  return new File([blob], outputName(file.name), { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * QO'LDA KIRITILGAN RASM HAVOLASI — tekshirish va tozalash.
 *
 * ⚠️ NEGA KERAK: `/api/uploads/` ruxsati yo'q rollar (operator) uchun havola
 * YAGONA yo'l, chunki katalog / AI-katalog kontrakti `image_url` ni URI
 * sifatida oladi (maxLength 200) — faylni EMAS. Noto'g'ri havola jimgina
 * saqlanib, keyin siniq rasm bo'lib qolmasin.
 */
export function normalizeImageUrl(raw: string): { url: string; error: string } {
  const v = (raw ?? "").trim();
  if (!v) return { url: "", error: "Havola bo'sh." };
  if (!/^https?:\/\/\S+$/i.test(v)) {
    return { url: "", error: "Havola http:// yoki https:// bilan boshlanishi kerak." };
  }
  if (v.length > 200) return { url: "", error: "Havola juda uzun — 200 belgidan oshmasin." };
  return { url: v, error: "" };
}
