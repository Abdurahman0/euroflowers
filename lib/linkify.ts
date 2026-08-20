/**
 * MATNDAGI HAVOLALAR — pufak ichidagi matnni bo'laklarga ajratadi.
 *
 * ⚠️ NEGA KERAK: AI media handoff'da (euroflowers_ai_media_handoff_frontend.md)
 *    AI mijozning rasm/story/reel'ini tushunmasa, HAVOLANI operatorga uzatadi.
 *    Shu havola CRM chatida ham mijoz xabari sifatida turadi — u BOSILADIGAN
 *    bo'lmasa, operator uni qo'lda ko'chirib yozishga majbur bo'lardi.
 *
 * ⚠️ MEDIA pufaklariga TEGMAYDI: MessageMedia media URL'ini matndan olib
 *    tashlaydi (mediaBodyText), ya'ni bu yerga faqat media BO'LMAGAN havola tushadi.
 */
export type TextPart = { type: "text" | "url"; value: string };

// http(s) havola; yopuvchi qavs va oxiridagi tinish belgilari havolaga KIRMAYDI
const URL_RE = /https?:\/\/[^\s<>]+/gi;
const TRAILING_CHARS = new Set([".", ",", ";", ":", "!", "?", ")", "]", "}", "»", '"', "'", "…"]);
const count = (s: string, ch: string): number => s.split(ch).length - 1;

/** Havolaning oxiridagi tinish belgilarini qaytaradi: «(https://a.b/c).» → «https://a.b/c» */
const trimUrl = (raw: string): { url: string; tail: string } => {
  let url = raw;
  let tail = "";
  // BITTALAB kesamiz — «).» kabi ketma-ketlikda qavs qoidasi alohida tekshirilsin
  while (url.length > 0) {
    const ch = url[url.length - 1];
    if (!TRAILING_CHARS.has(ch)) break;
    // qavs havolaning O'ZIDA ochilgan bo'lsa (wiki_(x)) — u havolaga tegishli, kesmaymiz
    if (ch === ")" && count(url, "(") >= count(url, ")")) break;
    url = url.slice(0, -1);
    tail = ch + tail;
  }
  return { url, tail };
};

export function splitLinks(text: string): TextPart[] {
  if (!text) return [];
  const parts: TextPart[] = [];
  let last = 0;
  // ⚠️ matchAll YO'Q — tsconfig target ES5 (downlevelIteration o'chirilgan)
  const re = new RegExp(URL_RE.source, "gi");
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const start = m.index ?? 0;
    const { url, tail } = trimUrl(m[0]);
    if (!url || url === "http://" || url === "https://") continue;
    if (start > last) parts.push({ type: "text", value: text.slice(last, start) });
    parts.push({ type: "url", value: url });
    if (tail) parts.push({ type: "text", value: tail });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

/** Ko'rinadigan qisqa yorliq — uzun havola pufakni cho'zib yubormasin. */
export function linkLabel(url: string, max = 48): string {
  let label = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (label.length > max) label = `${label.slice(0, max - 1)}…`;
  return label;
}
