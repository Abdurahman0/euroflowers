import type { AdjustDirection, AdjustInput, AdjustPreview, CloseIssueInput, CloseIssuePreview } from "./types";

// NOTE: florist-balans KOMPOZITSIYA validatsiyasi (balanceRemaining / batchHeldByFlorist /
// stemsForBatch / isBatchOverBalance / CompStemRow) OLIB TASHLANDI — florist katalogi endi gul
// tanlamaydi (close-issue taqsimlaydi). ADJUST oqimi bu funksiyalarni ISHLATMAGAN.

/* ===== ADJUST (hisobni to'g'rilash) — sof mantiq (UI'dan mustaqil, testlanadi) ===== */

/** Modal holatidan adjust-preview / adjust so'rovini yasaydi.
    MAJBURIY MAYDON QOIDALARI (endpoint semantikasi):
      • to_florist — `batch` VA `quantity_stems` MAJBURIY (qaysi guldan qanchasi ortganini
        faqat nazoratchi biladi). Yetmasa `ok:false` + sabab qaytadi (server 400'iga TAYANMAYMIZ).
      • to_catalog — `batch` ixtiyoriy (berilmasa hamma qoldiq), `quantity_stems` YUBORILMAYDI.
    `batch` (per-florist barcha partiya holati) uchun batch=null/undefined bo'ladi. */
export function buildAdjustRequest(input: {
  florist: number;
  direction: AdjustDirection;
  batch?: number | null;
  quantityStems?: number | null;
}): { ok: true; req: AdjustInput } | { ok: false; reason: string } {
  const { florist, direction } = input;
  if (!florist) return { ok: false, reason: "Floristni tanlang" };
  const batch = input.batch || undefined; // 0/null → undefined
  if (direction === "to_florist") {
    if (!batch) return { ok: false, reason: "Katalogdan qaytarishda partiyani tanlash kerak" };
    const q = input.quantityStems ?? 0;
    if (!q || q <= 0) return { ok: false, reason: "Qaytariladigan gul sonini kiriting" };
    return { ok: true, req: { florist, direction, batch, quantity_stems: q } };
  }
  // to_catalog — quantity_stems umuman yuborilmaydi
  return { ok: true, req: batch ? { florist, direction, batch } : { florist, direction } };
}

/** to_florist FAQAT bitta partiya bilan ishlaydi — per-florist (batch=null) holatida
    o'chirib qo'yiladi. Bu funksiya shu yo'nalish tanlanishi mumkinligini aytadi. */
export const canReturnToFlorist = (scopedBatch: number | null | undefined): boolean => !!scopedBatch;

/** Preview'da bloklangan partiya bormi → BUTUN amal to'xtaydi (all-or-nothing).
    blocked_count'ga ham, har bir batch.blocked'ga ham qaraydi (mudofaa uchun ikkalasi). */
export const previewBlocked = (p: Pick<AdjustPreview, "blocked_count" | "batches">): boolean =>
  (p.blocked_count ?? 0) > 0 || (p.batches ?? []).some((b) => b.blocked);

/** Preview'dagi bloklangan partiyalar (sabab bilan) — foydalanuvchiga qaysi biri va nega. */
export const blockedBatches = (p: Pick<AdjustPreview, "batches">) =>
  (p.batches ?? []).filter((b) => b.blocked).map((b) => ({ batchId: b.batch_id, batchNumber: b.batch_number, flower: b.flower, reason: b.reason }));

/** Bloklanmagan (bittalab bajarish mumkin bo'lgan) partiyalar. */
export const unblockedBatches = (p: Pick<AdjustPreview, "batches">) => (p.batches ?? []).filter((b) => !b.blocked);

/** Joylanmagan gullar jami (unplaced_stems > 0 bo'lsa foydalanuvchini ogohlantiramiz). */
export const totalUnplaced = (p: Pick<AdjustPreview, "batches">): number =>
  (p.batches ?? []).reduce((s, b) => s + (b.unplaced_stems || 0), 0);

/** Preview'dan «Floristda qoladi: N dona» — BIZ mustaqil hisoblamaymiz, preview
    maydonlaridan olamiz:
      • to_catalog — joylangan gul katalogga ketadi, JOYLANMAGANI (unplaced) floristda qoladi.
      • to_florist — katalogdan olingan gul (item.change_total MANFIY) floristga QAYTADI;
        qaytgan miqdor = Σ(−change_total).
    Ikki holatda ham raqam to'g'ridan-to'g'ri preview'ning o'z sonlaridan chiqadi. */
export function floristRemainsAfter(p: Pick<AdjustPreview, "direction" | "batches">): number {
  const batches = p.batches ?? [];
  if (p.direction === "to_florist") {
    return batches.reduce((s, b) => s + (b.items ?? []).reduce((t, it) => t - (it.change_total || 0), 0), 0);
  }
  return batches.reduce((s, b) => s + (b.unplaced_stems || 0), 0);
}

/** Bir item uchun «X → Y (±Δ)» + jami «Δ_total» — per-item va total AJRATIB ko'rsatiladi
    (quantity_total > 1 da ular FARQ qiladi: 2 dona → +1/dona = +2 jami). */
export function formatChange(perItem: number, total: number): { perItemLabel: string; totalLabel: string; sign: 1 | -1 | 0 } {
  const sign = total > 0 ? 1 : total < 0 ? -1 : 0;
  const s = (n: number) => (n > 0 ? `+${n}` : String(n)); // manfiyda minus o'zi keladi
  return { perItemLabel: `${s(perItem)}/dona`, totalLabel: `${s(total)} jami`, sign };
}

/* ===== CHIQIMNI YOPISH (close-issue) — sof mantiq (UI'dan mustaqil, testlanadi) ===== */

/** return_stems ni [0, balans] oralig'iga qisadi (raqamsiz → 0; balansdan oshsa → balans). */
export function clampReturnStems(value: number | string | null | undefined, balance: number): number {
  const n = typeof value === "string" ? Math.floor(parseFloat(value) || 0) : Math.floor(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, Math.max(0, balance));
}

/** close-issue-preview / close-issue so'rovini yasaydi. batch MAJBURIY (har gul alohida).
    return_stems balansga qisiladi. Yetmasa {ok:false} + sabab (serverga TAYANMAYMIZ). */
export function buildCloseIssueRequest(input: {
  florist: number;
  batch: number | null | undefined;
  returnStems?: number | string | null;
  balance: number;
}): { ok: true; req: CloseIssueInput } | { ok: false; reason: string } {
  if (!input.florist) return { ok: false, reason: "Floristni tanlang" };
  if (!input.batch) return { ok: false, reason: "Gulni (partiyani) tanlang" };
  const return_stems = clampReturnStems(input.returnStems, input.balance);
  return { ok: true, req: { florist: input.florist, batch: input.batch, ...(return_stems > 0 ? { return_stems } : {}) } };
}

/** Hajm tarifi belgilanmagan turi+hajmlar bormi → yopish BLOKLANADI. */
export const closeIssueBlocked = (p: Pick<CloseIssuePreview, "missing_rates">): boolean =>
  (p.missing_rates ?? []).length > 0;

/** missing_rates yorliqlari — obyekt yoki tayyor string bo'lishi mumkin, ikkalasini ham qo'llaymiz. */
export const missingRateLabels = (p: Pick<CloseIssuePreview, "missing_rates">): string[] =>
  (p.missing_rates ?? []).map((m) => {
    if (typeof m === "string") return m;
    if (m.label) return m.label;
    return [m.arrangement_type, m.volume].filter(Boolean).join(" · ") || "—";
  });

/** return_stems balansga TENG → hammasi skladga qaytadi, taqsimot bo'lmaydi (share 0). */
export const allReturns = (p: Pick<CloseIssuePreview, "florist_stems_now" | "return_stems" | "share_stems">): boolean =>
  (p.share_stems ?? 0) === 0 && (p.return_stems ?? 0) >= (p.florist_stems_now ?? 0) && (p.florist_stems_now ?? 0) > 0;

/** «Kataloglarga bo'linadi» — preview'dan (biz hisoblamaymiz). */
export const shareStems = (p: Pick<CloseIssuePreview, "share_stems">): number => p.share_stems ?? 0;
