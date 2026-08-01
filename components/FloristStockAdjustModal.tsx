"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, Info, Scale, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader } from "./Modal";
import StockLine, { lineFromBatchDetail } from "./StockLine";
import { formatStemsAndBunches, stems as stemsFmt } from "@/lib/inventory";
import {
  buildAdjustRequest, canReturnToFlorist, previewBlocked, blockedBatches,
  totalUnplaced, floristRemainsAfter, formatChange,
} from "@/lib/floristStock";
import type { AdjustDirection, AdjustPreview, AdjustResult, FloristStockBalance } from "@/lib/types";

// Increase (Δ>0) va decrease (Δ<0) tintlari — MAVJUD semantik tokenlar (sage/rose),
// yangi rang IXTIRO QILINMAYDI. Ko'proq (+) → sage, kamroq (−) → rose.
const UP = "var(--success-ink, #3d8a5f)";
const DOWN = "var(--danger-ink)";
const tintOf = (sign: 1 | -1 | 0) => (sign > 0 ? UP : sign < 0 ? DOWN : "var(--text-2)");

/**
 * FLORIST GUL HISOBINI TO'G'RILASH — PREVIEW-DRIVEN modal (Modal qayta ishlatildi, yangi
 * pattern YO'Q). Yo'nalish/son o'zgarganda adjust-preview (GET, DESTRUKTIV EMAS) debounce
 * bilan qayta chaqiriladi; jadval TO'G'RIDAN-TO'G'RI javobdan chiziladi. Tasdiqlashda
 * `adjust` (POST) — u SOTILGAN kataloglar tannarxini ham qayta yozadi.
 *
 * Ikki kirish nuqtasi (endpoint semantikasiga mos):
 *   • per-florist (scoped=null) — batch YUBORILMAYDI, FAQAT to_catalog (hamma qoldiq bo'linadi).
 *   • per-batch  (scoped=balance) — o'sha partiya; ikkala yo'nalish ochiq.
 */
export default function FloristStockAdjustModal({
  florist,
  floristName,
  scoped = null,
  totalRemaining,
  onClose,
  onDone,
}: {
  florist: number;
  floristName: string;
  /** bitta partiyaga bog'langan bo'lsa (per-row). null = per-florist (barcha partiya). */
  scoped?: FloristStockBalance | null;
  /** per-florist header uchun jami qoldiq (dona) */
  totalRemaining?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useStore();
  const [direction, setDirection] = useState<AdjustDirection>("to_catalog");
  const [qty, setQty] = useState("");
  // per-florist blocked holatida bitta partiyaga QAYTA-SCOPE (bittalab bajarish)
  const [batchOverride, setBatchOverride] = useState<number | null>(null);

  const [preview, setPreview] = useState<AdjustPreview | null>(null);
  const [pLoading, setPLoading] = useState(false);
  const [pErr, setPErr] = useState<string | null>(null);
  const [needInput, setNeedInput] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdjustResult | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // effektiv partiya: qayta-scope > scoped > (per-florist: yo'q)
  const effBatch = batchOverride ?? scoped?.batch ?? null;
  const canToFlorist = canReturnToFlorist(effBatch);
  const qNum = qty ? Math.round(parseFloat(qty)) || 0 : 0;

  // yo'nalish/son/scope o'zgarganda preview — DEBOUNCE (har bosishda emas)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (result) return; // bajarilgan — preview qotib qoladi
    const built = buildAdjustRequest({ florist, direction, batch: effBatch, quantityStems: direction === "to_florist" ? qNum : null });
    if (!built.ok) { setPreview(null); setPErr(null); setNeedInput(built.reason); return; }
    setNeedInput(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPLoading(true); setPErr(null);
      api.floristStockAdjustPreview(built.req)
        .then((p) => { setPreview(p); })
        .catch((e) => { setPreview(null); setPErr(e instanceof ApiError ? e.message : "Oldindan ko'rib bo'lmadi"); })
        .finally(() => setPLoading(false));
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [florist, direction, effBatch, qNum, result]);

  const blocked = preview ? previewBlocked(preview) : false;
  const blockedList = preview ? blockedBatches(preview) : [];
  const unplaced = preview ? totalUnplaced(preview) : 0;
  const remains = preview ? floristRemainsAfter(preview) : 0;
  const isEmptyPreview = !!preview && preview.batches.length === 0;

  const headerRemaining = scoped
    ? formatStemsAndBunches(scoped.remaining_stems, scoped.batch_detail?.stems_per_bunch)
    : stemsFmt(totalRemaining ?? 0);

  const confirmDisabled = busy || !!result || !preview || isEmptyPreview || blocked || pLoading || (direction === "to_florist" && qNum <= 0);

  const doAdjust = async () => {
    if (confirmDisabled) return;
    const built = buildAdjustRequest({ florist, direction, batch: effBatch, quantityStems: direction === "to_florist" ? qNum : null });
    if (!built.ok) { showToast(built.reason); return; }
    if (blocked) { showToast("Bloklangan partiya bor — bittalab bajaring"); return; }
    setBusy(true); setSubmitErr(null);
    try {
      const res = await api.floristStockAdjust(built.req); // ⚠️ POST — tasdiqdan keyin
      setResult(res);
      showToast(`✓ ${res.moved_stems} dona to'g'rilandi`);
      onDone(); // balanslar + katalog + hisob-kitob/dashboard/analitika keshlari yangilanadi
    } catch (e) {
      const d = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : null;
      setSubmitErr(d || (e instanceof ApiError ? e.message : "Bajarib bo'lmadi"));
      setBusy(false);
    }
  };

  const dirOptions: { value: AdjustDirection; title: string; sub: string; disabled?: boolean; reason?: string }[] = [
    { value: "to_catalog", title: "Florist ko'proq ishlatgan", sub: "qoldiqni buketlarga bo'lish" },
    { value: "to_florist", title: "Florist kamroq ishlatgan", sub: "buketdan floristga qaytarish", disabled: !canToFlorist, reason: "Bir partiyani tanlang — qaytarish partiyaga bog'liq" },
  ];

  return (
    <Modal onClose={onClose} width={560}>
      <ModalHeader
        icon={<Scale size={19} strokeWidth={1.8} />}
        title="Gul hisobini to'g'rilash"
        sub={floristName}
        onClose={onClose}
      />

      {/* scope: bitta partiya bo'lsa gul qatori + qoldiq (ikki birlikda) */}
      {scoped ? (
        <div className="mt-1 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
          <StockLine data={lineFromBatchDetail(scoped.batch_detail)} right={<span className="text-[12.5px] font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{headerRemaining}</span>} />
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between rounded-[13px] border p-3" style={{ borderColor: "var(--border)" }}>
          <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>Hozir floristda (barcha partiya)</span>
          <span className="text-[13px] font-bold tabular-nums">{headerRemaining}</span>
        </div>
      )}

      {/* adjust vs close-issue — bir qatorli izoh (§4): avval chiqim yopiladi, adjust — KEYINGI tuzatish */}
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
        <Info size={12} strokeWidth={2.2} className="shrink-0" style={{ color: "var(--primary)" }} />
        Bu <b>keyingi tuzatish</b>. Agar chiqim hali yopilmagan bo&apos;lsa, avval «Chiqimni yopish»ni ishlating.
      </p>

      {result ? (
        /* ===== NATIJA (adjust'dan keyin) ===== */
        <ResultView result={result} onClose={onClose} />
      ) : (
        <>
          {/* ===== YO'NALISH ===== */}
          <div className="mt-4 flex flex-col gap-2">
            {dirOptions.map((o) => {
              const active = direction === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => { setDirection(o.value); }}
                  className="flex items-start gap-2.5 rounded-[13px] border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55"
                  style={{ borderColor: active ? "var(--primary)" : "var(--border)", background: active ? "var(--primary-soft)" : undefined }}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]" style={{ borderColor: active ? "var(--primary)" : "var(--border-strong, var(--border))" }}>
                    {active && <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold">{o.title}</span>
                    <span className="block text-[12px]" style={{ color: "var(--muted)" }}>{o.sub}</span>
                    {o.disabled && o.reason && <span className="mt-0.5 block text-[11px] font-semibold" style={{ color: "var(--mut)" }}>{o.reason}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* to_florist — QAYTARILADIGAN SON (faqat shu yo'nalishda, MAJBURIY) */}
          {direction === "to_florist" && (
            <label className="mt-3 flex flex-col gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              Qaytariladigan son (dona)
              <input className="inp" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))} placeholder="Masalan: 10" autoFocus />
            </label>
          )}

          {/* ===== PREVIEW ===== */}
          <div className="mt-4">
            {needInput ? (
              <div className="rounded-[12px] border border-dashed px-3 py-4 text-center text-[12.5px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--mut)" }}>{needInput}</div>
            ) : pLoading && !preview ? (
              <div className="rounded-[12px] border px-3 py-4 text-center text-[12.5px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Hisoblanmoqda…</div>
            ) : pErr ? (
              <p className="whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{pErr}</p>
            ) : isEmptyPreview ? (
              <div className="rounded-[12px] border border-dashed px-3 py-4 text-center" style={{ borderColor: "var(--border)" }}>
                <p className="text-[13px] font-semibold">Bo&apos;linadigan qoldiq yo&apos;q</p>
                <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>Bu florist qo&apos;lida ushbu yo&apos;nalish uchun gul qolmagan.</p>
              </div>
            ) : preview ? (
              <div className={pLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                {/* JOYLANMAGAN gullar — yashirmaymiz */}
                {unplaced > 0 && (
                  <div className="mb-2 flex items-center gap-2 rounded-[11px] px-3 py-2 text-[12.5px] font-bold" style={{ background: "color-mix(in srgb, #b3873a 16%, transparent)", color: "var(--warning-ink, #8a6d1f)" }}>
                    <TriangleAlert size={15} strokeWidth={2.2} className="shrink-0" />
                    {stemsFmt(unplaced)} joylanmaydi — hech qaysi katalogga tushmaydi.
                  </div>
                )}
                {/* BLOKLANGAN — butun amal to'xtaydi; bittalab bajarish taklifi */}
                {blocked && (
                  <div className="mb-2 rounded-[12px] border p-3" style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 40%, var(--border))", background: "var(--danger-soft, rgba(160,74,74,.10))" }}>
                    <div className="flex items-center gap-2 text-[12.5px] font-bold" style={{ color: "var(--danger-ink)" }}>
                      <Ban size={15} strokeWidth={2.2} className="shrink-0" /> Bloklangan partiya — hammasi to&apos;xtaydi
                    </div>
                    <p className="mt-1 text-[12px]" style={{ color: "var(--text-2)" }}>Bitta partiya bloklangani uchun butun amal bajarilmaydi (all-or-nothing). Bloklanmaganini bittalab bajaring:</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {blockedList.map((b) => (
                        <div key={b.batchId} className="text-[11.5px]" style={{ color: "var(--danger-ink)" }}>
                          <b>№{b.batchNumber}</b> — {b.reason || "sabab ko'rsatilmagan"}
                        </div>
                      ))}
                    </div>
                    {/* bloklanmaganlarni bittalab: shu partiyaga qayta-scope qilamiz */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {preview.batches.filter((b) => !b.blocked).map((b) => (
                        <button key={b.batch_id} type="button" onClick={() => { setBatchOverride(b.batch_id); }}
                          className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
                          №{b.batch_number}ni bajarish
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {batchOverride != null && (
                  <button type="button" onClick={() => setBatchOverride(null)} className="mb-2 text-[11.5px] font-bold" style={{ color: "var(--muted)" }}>← Barcha partiyaga qaytish</button>
                )}

                {/* PARTIYA bo'yicha JADVAL */}
                <div className="flex flex-col gap-3">
                  {preview.batches.map((b) => (
                    <div key={b.batch_id} className="rounded-[13px] border p-2.5" style={{ borderColor: b.blocked ? "color-mix(in srgb, var(--danger-ink) 40%, var(--border))" : "var(--border)", opacity: b.blocked ? 0.7 : 1 }}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[12.5px] font-bold">{b.flower}</span>
                        <span className="rounded-full bg-tint px-1.5 py-px text-[10.5px] font-bold text-tintink">№{b.batch_number}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ color: "var(--muted)" }}>
                              <th className="py-1 pr-2 text-left font-semibold">Katalog</th>
                              <th className="px-2 py-1 text-right font-semibold">Dona</th>
                              <th className="px-2 py-1 text-right font-semibold">Hozir → keyin</th>
                              <th className="px-2 py-1 text-right font-semibold">O&apos;zgarish</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.items.map((it) => {
                              const ch = formatChange(it.change_per_item, it.change_total);
                              const tint = tintOf(ch.sign);
                              return (
                                <tr key={it.catalog_item} className="border-t" style={{ borderColor: "var(--line2)" }}>
                                  <td className="py-1.5 pr-2 font-semibold">{it.catalog_name}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: "var(--text-2)" }}>{it.quantity_total}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{it.stems_per_item_now} → <b>{it.stems_per_item_after}</b></td>
                                  <td className="px-2 py-1.5 text-right tabular-nums font-bold" style={{ color: tint }}>
                                    <span>{ch.perItemLabel}</span>
                                    {it.quantity_total > 1 && <span className="ml-1 opacity-80">({ch.totalLabel})</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>

                {/* FOOTER liniyasi — preview'dan olingan, biz hisoblamaymiz */}
                <div className="mt-3 flex items-center justify-between rounded-[12px] px-3 py-2 text-[12.5px] font-bold" style={{ background: "var(--surface-2)" }}>
                  <span style={{ color: "var(--text-2)" }}>{direction === "to_florist" ? "Floristga qaytadi" : "Floristda qoladi"}</span>
                  <span className="tabular-nums" style={{ color: "var(--primary)" }}>{stemsFmt(remains)}</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* ⚠️ MAJBURIY OGOHLANTIRISH — ko'rmay o'tib bo'lmaydi */}
          {preview && !isEmptyPreview && (
            <div className="mt-3 flex items-start gap-2.5 rounded-[13px] border-[1.5px] p-3" style={{ borderColor: "var(--danger-ink)", background: "var(--danger-soft, rgba(160,74,74,.12))" }}>
              <AlertTriangle size={18} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--danger-ink)" }} />
              <p className="text-[12.5px] font-bold leading-snug" style={{ color: "var(--danger-ink)" }}>
                Sotilgan buketlar tannarxi ham o&apos;zgaradi — hisob-kitobdagi sof foyda siljiydi.
              </p>
            </div>
          )}

          {submitErr && <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{submitErr}</p>}

          <ModalFooter>
            <button onClick={onClose} className="btn-ghost">Bekor</button>
            <button onClick={doAdjust} disabled={confirmDisabled} className="btn-primary disabled:opacity-60">{busy ? "Bajarilmoqda…" : "Tasdiqlash"}</button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}

function ResultView({ result, onClose }: { result: AdjustResult; onClose: () => void }) {
  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-[13px] font-bold text-mintink" style={{ background: "var(--mint, rgba(61,138,95,.12))" }}>
        ✓ To&apos;g&apos;rilandi — {stemsFmt(result.moved_stems)} ko&apos;chirildi{result.unplaced_stems > 0 ? ` · ${stemsFmt(result.unplaced_stems)} joylanmadi` : ""}
      </div>
      <div className="flex flex-col gap-3">
        {result.batches.map((b) => (
          <div key={b.batch_id} className="rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-[12.5px] font-bold">{b.flower}</span>
              <span className="rounded-full bg-tint px-1.5 py-px text-[10.5px] font-bold text-tintink">№{b.batch_number}</span>
            </div>
            <div className="flex flex-col gap-1">
              {b.items.map((it) => (
                <div key={it.catalog_item} className="flex items-center justify-between text-[12px]">
                  <span className="truncate font-semibold">{it.catalog_name}</span>
                  <span className="tabular-nums" style={{ color: "var(--text-2)" }}>{it.stems_before} → <b>{it.stems_after}</b></span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>Floristda qoldi: {stemsFmt(b.florist_stems_after)}</div>
          </div>
        ))}
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-primary">Yopish</button>
      </ModalFooter>
    </div>
  );
}
