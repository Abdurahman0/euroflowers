/**
 * FLORIST ISMI — YAGONA manba.
 *
 * ⚠️ IKKI XIL SHAKL BOR va ular ARALASHIB KETADI:
 *
 *   1) TO'LIQ  — `GET /api/florists/` dan:
 *        { id, user_detail: { first_name, last_name, username } }
 *   2) YUPQA   — katalog javobi ichidagi `florist_detail`:
 *        { id, name: "Abror", staff_type, staff_type_label, phone, user }
 *      ⚠️ Bu shaklda `user_detail` UMUMAN YO'Q, ism esa to'g'ridan-to'g'ri `name` da.
 *
 * Ilgari har fayl o'z helperini yozgan va hammasi FAQAT `user_detail` ni o'qirdi.
 * Katalogda yupqa shakl kelgani uchun ism topilmay, oxirgi zaxira ishlagan va
 * ekranda ism o'rniga RAQAM chiqqan: «#4», «#6», «#7» (jonli: Abror, Bekzod, Isroil).
 *
 * ⚠️ Katalog ro'yxati tayyor ismni `florist_name` / `decoration_florist_name` da
 * ham beradi — u bo'lsa eng ishonchli manba, birinchi bo'lib o'qiladi.
 */

export type FloristLike =
  | {
      id?: number | null;
      /** yupqa shakl — katalog ichidagi `florist_detail` */
      name?: string | null;
      /** to'liq shakl — /api/florists/ */
      user_detail?: { first_name?: string | null; last_name?: string | null; username?: string | null } | null;
    }
  | null
  | undefined;

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * @param fp        florist obyekti (ikkala shakl ham bo'ladi)
 * @param readyName javobdagi tayyor ism (`florist_name`) — bo'lsa ustun turadi
 */
export function floristLabel(fp: FloristLike, readyName?: string | null): string {
  const ready = s(readyName);
  if (ready) return ready;                     // ⚠️ eng ishonchli — server tayyorlagan
  if (!fp) return "";
  const slim = s(fp.name);
  if (slim) return slim;                       // yupqa shakl
  const u = fp.user_detail;
  const full = [s(u?.first_name), s(u?.last_name)].filter(Boolean).join(" ");
  if (full) return full;                       // to'liq shakl
  const uname = s(u?.username);
  if (uname) return uname;
  // ⚠️ OXIRGI zaxira — ism umuman topilmadi. Raqam chiqishi NORMAL emas, shuning
  // uchun u alohida ko'rinadi va nosozlik yashirilmaydi.
  return fp.id != null ? `#${fp.id}` : "";
}
