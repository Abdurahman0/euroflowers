import type { FloristProfile, FloristSalaryEntry } from "./types";

/**
 * QO'LDA YOZILADIGAN OFORMLENIYA HAQI — sof hisob qatlami.
 * Spec: FRONTEND_FLORIST_DECORATION_SALARY_API.md
 *
 * ⚠️ HOLAT (jonli OpenAPI, 2026-08-07 — 148 yo'l):
 *   `POST /api/florists/{id}/decoration/`  → YO'Q (hech qanday `decoration` yo'li yo'q)
 *   `FloristSalaryEntry.quantity/unit_amount` → YO'Q
 *   `extra_decoration` salary enum'da        → YO'Q
 *   `decoration_fee` florist modelida         → BOR ("5000.00", florist id=7 Isroil)
 *   `PATCH /api/florist-salary/{id}/`         → BOR
 *   `?source=` filtri                          → BOR
 *   `summary.decoration_salary_total`          → BOR
 * Ya'ni pastdagi hisob KONTRAKT bo'yicha yozilgan; deploydan keyin AYNAN tekshirilsin.
 */

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
};

/**
 * BITTASINING NARXI — «Boshqa narx» kiritilgan bo'lsa O'SHA, aks holda profildagi
 * `decoration_fee`. Bo'sh satr «berilmagan» degani (0 EMAS).
 */
export function decorationUnit(florist: Pick<FloristProfile, "decoration_fee"> | null | undefined, override: string): number {
  const o = override.trim();
  if (o !== "") return Math.max(Math.round(n(o)), 0);
  return Math.max(Math.round(n(florist?.decoration_fee)), 0);
}

/**
 * ⚠️ SERVER 400 BERADIGAN HOLAT: profilda `decoration_fee` nol/bo'sh VA «Boshqa narx»
 * ham kiritilmagan → «Oformleniya narxini kiriting — florist profilida ham yozilmagan».
 * Buni OLDINDAN aniqlaymiz: tugma o'chadi va sabab yoziladi, xatoga bormaydi.
 */
export const decorationBlocked = (
  florist: Pick<FloristProfile, "decoration_fee"> | null | undefined, override: string,
): boolean => decorationUnit(florist, override) <= 0;

/** Jonli hisob: «3 × 5 000 = 15 000 so'm» (admin Qo'shishdan OLDIN ko'radi). */
export const decorationTotal = (count: string | number, unit: number): number =>
  Math.max(Math.round(n(count)), 0) * Math.max(unit, 0);

export type DecorationCheck = { count: number; unit: number; total: number; ok: boolean; reason: string };

/** Formani tekshirish — sabab BO'SH bo'lsa Qo'shish yonadi. */
export function decorationCheck(args: {
  florist: Pick<FloristProfile, "decoration_fee"> | null | undefined;
  count: string; override: string;
}): DecorationCheck {
  const count = Math.round(n(args.count));
  const unit = decorationUnit(args.florist, args.override);
  const total = Math.max(count, 0) * unit;
  let reason = "";
  if (!(count >= 1)) reason = "Nechta oformleniya qilganini kiriting (kamida 1 ta)";
  else if (unit <= 0) reason = "Avval oformleniya narxini kiriting — profilda ham yozilmagan";
  return { count, unit, total, ok: reason === "", reason };
}

/**
 * POST /api/florists/{id}/decoration/ tanasi.
 * ⚠️ Bo'sh `unit_amount`/`note` UMUMAN yuborilmaydi (loyihadagi qoida): `unit_amount`
 * bo'sh bo'lsa server profildagi narxni oladi — "" yuborsak uni bekor qilardik.
 */
export function buildDecorationPayload(args: {
  count: string | number; workDate: string; override: string; note: string;
}): Record<string, unknown> {
  const p: Record<string, unknown> = { count: Math.max(Math.round(n(args.count)), 1) };
  // ⚠️ SANA — DATE (YYYY-MM-DD), datetime EMAS
  if (args.workDate.trim()) p.work_date = args.workDate.trim().slice(0, 10);
  if (args.override.trim()) p.unit_amount = String(Math.max(Math.round(n(args.override)), 0));
  if (args.note.trim()) p.note = args.note.trim();
  return p;
}

/* ═══════════ 200 vs 201 — BIRLASHDIMI YOKI YANGI QATORMI ═══════════ */

/**
 * ⚠️ ENG NOZIK JOY: o'sha kunga, o'sha narx bilan yana qo'shilsa YANGI QATOR
 * OCHILMAYDI — o'sha kunning qatoriga QO'SHILADI (200). Narx boshqa bo'lsa yangi
 * qator (201). Buni aytmasak, 3 ta qo'shib keyin 2 ta qo'shgan admin qatorda hamon
 * «3» ni ko'rib «ishlamadi» deb yana qo'shadi — ish haqi ikki barobar bo'lib ketadi.
 */
export function decorationOutcome(status: number, entry: Pick<FloristSalaryEntry, "quantity" | "amount"> | null | undefined): string {
  const qty = entry?.quantity ?? 0;
  const amt = Math.round(n(entry?.amount));
  const money = amt.toLocaleString("ru").replace(/ /g, " ");
  return status === 200
    ? `Bugungi qatorga qo'shildi: ${qty} ta · ${money} so'm`
    : `Yangi qator qo'shildi: ${qty} ta · ${money} so'm`;
}

/* ═══════════ TAHRIR — UCHTA XULQ, ULAR ARALASHMAYDI ═══════════ */

/** Tahrir rejimi: soni/narxi (summa O'ZI hisoblanadi) YOKI summani qo'lda yozish. */
export type SalaryEditMode = "calc" | "manual";

/**
 * PATCH /api/florist-salary/{id}/ tanasi.
 *
 * ⚠️ SERVER QOIDASI: `amount` yuborilsa U USTUN turadi va ko'paytirish BEKOR bo'ladi.
 * Demak `amount` ni `quantity`/`unit_amount` BILAN BIRGA yuborish — jimgina falokat:
 * operator sonini o'zgartiradi, biz o'zgarmagan `amount` ni ham yuboramiz, server esa
 * eski summani saqlab qoladi. Shuning uchun:
 *   • `calc`   rejimida — FAQAT o'zgargan `quantity` va/yoki `unit_amount`, `amount` HECH QACHON
 *   • `manual` rejimida — FAQAT `amount`, boshqasi HECH QACHON
 * Ikkalasi bir tanada BIR VAQTDA chiqmasligi Vitest bilan qulflangan.
 */
export function buildSalaryEditPayload(
  initial: Pick<FloristSalaryEntry, "quantity" | "unit_amount" | "amount">,
  draft: { quantity: string; unitAmount: string; amount: string },
  mode: SalaryEditMode,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (mode === "manual") {
    const was = Math.round(n(initial.amount));
    const now = Math.round(n(draft.amount));
    if (draft.amount.trim() !== "" && now !== was) out.amount = String(now);
    return out;
  }
  const wasQty = initial.quantity ?? 0;
  const nowQty = Math.round(n(draft.quantity));
  if (draft.quantity.trim() !== "" && nowQty !== wasQty) out.quantity = nowQty;

  const wasUnit = Math.round(n(initial.unit_amount));
  const nowUnit = Math.round(n(draft.unitAmount));
  if (draft.unitAmount.trim() !== "" && nowUnit !== wasUnit) out.unit_amount = String(nowUnit);
  return out;
}

/** Qatorda hisob ko'rsatiladimi — FAQAT ikkalasi ham > 0 bo'lganda (spec §6). */
export const hasArithmetic = (r: Pick<FloristSalaryEntry, "quantity" | "unit_amount">): boolean =>
  (r.quantity ?? 0) > 0 && n(r.unit_amount) > 0;

/** «3 × 5 000» — qatordagi hisob matni (summa alohida ustunda). */
export const arithmeticLabel = (r: Pick<FloristSalaryEntry, "quantity" | "unit_amount">): string =>
  `${r.quantity} × ${Math.round(n(r.unit_amount)).toLocaleString("ru").replace(/ /g, " ")}`;

/* ═══════════ RUXSAT ═══════════ */

/**
 * ⚠️ FLORIST O'ZIGA YOZA OLMAYDI — ruxsati bo'lsa ham server 403 qaytaradi (spec §7).
 * «Bu men» ni `/api/me/` dagi `user.id` va `FloristProfile.user` (user ID si) orqali
 * aniqlaymiz — ikkalasi ham AYNAN o'sha `User` jadvalining kaliti.
 */
export const isOwnProfile = (
  florist: Pick<FloristProfile, "user"> | null | undefined, meUserId: number | null | undefined,
): boolean => !!florist && meUserId != null && florist.user === meUserId;
