"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, PackageCheck, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader } from "./Modal";
import StockLine, { lineFromBatchDetail } from "./StockLine";
import { ARRANGEMENT_LABEL } from "./badges";
import { formatStemsAndBunches, stems as stemsFmt, VOLUME_LABEL } from "@/lib/inventory";
import { buildCloseIssueRequest, closeIssueBlocked, missingRateLabels, allReturns, clampReturnStems } from "@/lib/floristStock";
import type { CloseIssuePreview, CloseIssueResult, FloristStockBalance } from "@/lib/types";

const volLabel = (v: string) => VOLUME_LABEL[v as keyof typeof VOLUME_LABEL] ?? v; // "small"→Kichik; "S" o'zicha

/**
 * CHIQIMNI YOPISH — PREVIEW-DRIVEN modal (Modal qayta ishlatildi, issue/adjust bilan bir xil).
 * Chiqarilgan gulning ortiqchasi skladga qaytadi, qolgani guli yozilmagan kataloglarga
 * hajm standartiga qarab bo'linadi. Bu — BIRINCHI taqsimot (adjust — keyingi tuzatish).
 * ⚠️ close-issue-preview GET (bazaga tegmaydi) debounce bilan; POST faqat tasdiqdan keyin.
 */
export default function FloristCloseIssueModal({ balance, onClose, onDone }: {
  balance: FloristStockBalance;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useStore();
  const florist = balance.florist;
  const batch = balance.batch;
  const bal = balance.remaining_stems;

  const [returnStr, setReturnStr] = useState("");
  const [preview, setPreview] = useState<CloseIssuePreview | null>(null);
  const [pLoading, setPLoading] = useState(false);
  const [pErr, setPErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CloseIssueResult | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const retNum = clampReturnStems(returnStr, bal);

  // return_stems o'zgarganda preview — DEBOUNCE (har bosishda emas)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (result) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPLoading(true); setPErr(null);
      api.closeIssuePreview({ florist, batch, return_stems: retNum || undefined })
        .then((p) => setPreview(p))
        .catch((e) => { setPreview(null); setPErr(e instanceof ApiError ? e.message : "Oldindan ko'rib bo'lmadi"); })
        .finally(() => setPLoading(false));
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [florist, batch, retNum, result]);

  const blocked = preview ? closeIssueBlocked(preview) : false;
  const missing = preview ? missingRateLabels(preview) : [];
  const share = preview?.share_stems ?? 0;
  const unplaced = preview?.unplaced_stems ?? 0;
  const isAllReturns = preview ? allReturns(preview) : false;
  const jami = useMemo(() => (preview?.items ?? []).reduce((s, it) => s + (it.stems_total || 0), 0), [preview]);

  const confirmDisabled = busy || !!result || !preview || pLoading || blocked;

  const doClose = async () => {
    if (confirmDisabled) return;
    const built = buildCloseIssueRequest({ florist, batch, returnStems: returnStr, balance: bal });
    if (!built.ok) { showToast(built.reason); return; }
    if (blocked) { showToast("Hajm tarifi belgilanmagan — avval tarifni kiriting"); return; }
    setBusy(true); setSubmitErr(null);
    try {
      const res = await api.closeIssue(built.req); // ⚠️ POST — tasdiqdan keyin
      setResult(res);
      showToast(`✓ Chiqim yopildi — ${stemsFmt(res.shared_stems)} taqsimlandi`);
      onDone(); // balanslar + tarix + katalog + hisobot keshi
    } catch (e) {
      const d = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : null;
      setSubmitErr(d || (e instanceof ApiError ? e.message : "Yopib bo'lmadi"));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={580}>
      <ModalHeader icon={<PackageCheck size={19} strokeWidth={1.8} />} title="Chiqimni yopish" sub={balance.florist_name} onClose={onClose} />

      {/* GUL/PARTIYA + floristda qancha (ikki birlikda) */}
      <div className="mt-1 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
        <StockLine data={lineFromBatchDetail(balance.batch_detail)} right={<span className="text-[12.5px] font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{formatStemsAndBunches(bal, balance.batch_detail?.stems_per_bunch)}</span>} />
      </div>

      {/* adjust bilan farqi — bir qatorli izoh (§4) */}
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
        <Info size={12} strokeWidth={2.2} className="shrink-0" style={{ color: "var(--primary)" }} />
        Bu <b>birinchi</b> taqsimot. Yopilgandan keyin xato sezilsa «To&apos;g&apos;rilash» (adjust) ishlatiladi.
      </p>

      {result ? (
        <ResultView result={result} onClose={onClose} />
      ) : (
        <>
          {/* SKLADGA QAYTARILADI */}
          <label className="mt-3 flex flex-col gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
            Skladga qaytariladi (dona)
            <input className="inp" inputMode="numeric" value={returnStr} onChange={(e) => setReturnStr(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" />
            {returnStr && retNum !== Math.floor(parseFloat(returnStr) || 0) && (
              <span className="text-[11px] font-semibold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>Floristda atigi {bal} dona — {retNum} ga qisqartirildi</span>
            )}
          </label>

          {/* KATALOGLARGA BO'LINADI — preview'dan (biz hisoblamaymiz) */}
          <div className="mt-3 flex items-center justify-between rounded-[12px] px-3 py-2 text-[12.5px] font-bold" style={{ background: "var(--surface-2)" }}>
            <span style={{ color: "var(--text-2)" }}>Kataloglarga bo&apos;linadi</span>
            <span className="tabular-nums" style={{ color: "var(--primary)" }}>{stemsFmt(share)}</span>
          </div>

          {/* JOYLANMAGAN — yashirmaymiz */}
          {unplaced > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-[11px] px-3 py-2 text-[12.5px] font-bold" style={{ background: "color-mix(in srgb, #b3873a 16%, transparent)", color: "var(--warning-ink, #8a6d1f)" }}>
              <TriangleAlert size={15} strokeWidth={2.2} className="shrink-0" /> {stemsFmt(unplaced)} joylanmaydi — hech qaysi katalogga tushmaydi.
            </div>
          )}

          {/* MISSING RATES — yopish bloklanadi + matritsaga yo'l */}
          {blocked && (
            <div className="mt-2 rounded-[12px] border p-3" style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 40%, var(--border))", background: "var(--danger-soft, rgba(160,74,74,.10))" }}>
              <div className="text-[12.5px] font-bold" style={{ color: "var(--danger-ink)" }}>Hajm tarifi belgilanmagan — yopib bo&apos;lmaydi</div>
              <p className="mt-1 text-[12px]" style={{ color: "var(--text-2)" }}>Quyidagi hajmlarga tarif kiritilmagan (default_stems taqsimot og&apos;irligi). Avval tarifni to&apos;ldiring:</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {missing.map((m, i) => (
                  <span key={i} className="rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ background: "var(--danger-soft, rgba(160,74,74,.14))", color: "var(--danger-ink)" }}>{m}</span>
                ))}
              </div>
              <button type="button" onClick={() => { if (typeof window !== "undefined") window.location.assign(`/floristlar/${florist}#rates`); }} className="mt-2.5 rounded-full border px-3 py-1 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--danger-ink)", color: "var(--danger-ink)" }}>Hajm tariflari →</button>
            </div>
          )}

          {/* PREVIEW holatlari */}
          <div className="mt-3">
            {pErr ? (
              <p className="whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{pErr}</p>
            ) : pLoading && !preview ? (
              <div className="rounded-[12px] border px-3 py-4 text-center text-[12.5px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Hisoblanmoqda…</div>
            ) : isAllReturns ? (
              <div className="rounded-[12px] border border-dashed px-3 py-4 text-center" style={{ borderColor: "var(--border)" }}>
                <p className="text-[13px] font-semibold">Hammasi skladga qaytadi</p>
                <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>Taqsimot bo&apos;lmaydi (florist gul olib, hech narsa yasamagan). Xato ham chiqmaydi.</p>
              </div>
            ) : preview && !blocked && preview.items.length > 0 ? (
              <div className={pLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "var(--muted)" }}>
                        <th className="py-1 pr-2 text-left font-semibold">Katalog</th>
                        <th className="px-2 py-1 text-left font-semibold">Hajm</th>
                        <th className="px-2 py-1 text-right font-semibold">Standart</th>
                        <th className="px-2 py-1 text-right font-semibold">Tushadi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.map((it) => (
                        <tr key={it.catalog_item} className="border-t" style={{ borderColor: "var(--line2)" }}>
                          <td className="py-1.5 pr-2 font-semibold">{it.catalog_name}{it.quantity_total > 1 ? <span style={{ color: "var(--muted)" }}> ×{it.quantity_total}</span> : ""}</td>
                          <td className="px-2 py-1.5" style={{ color: "var(--text-2)" }}>{ARRANGEMENT_LABEL[it.arrangement_type] ?? it.arrangement_type} · {volLabel(it.volume)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{it.standard_stems}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-bold">
                            {it.stems_per_item}<span style={{ color: "var(--muted)" }}>/dona</span>
                            {it.quantity_total > 1 && <span className="ml-1 font-semibold" style={{ color: "var(--muted)" }}>({it.stems_total} jami)</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="py-1.5 pr-2 font-bold" colSpan={3}>Jami</td>
                        <td className="px-2 py-1.5 text-right font-extrabold tabular-nums" style={{ color: "var(--primary)" }}>{jami}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>Yopilgach bu kataloglarning tannarxi paydo bo&apos;ladi — hisob-kitobdagi foyda shundan keyin haqiqiy.</p>
              </div>
            ) : null}
          </div>

          {submitErr && <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{submitErr}</p>}

          <ModalFooter>
            <button onClick={onClose} className="btn-ghost">Bekor</button>
            <button onClick={doClose} disabled={confirmDisabled} className="btn-primary disabled:opacity-60">{busy ? "Yopilmoqda…" : "Yopish"}</button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}

function ResultView({ result, onClose }: { result: CloseIssueResult; onClose: () => void }) {
  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-[13px] font-bold text-mintink" style={{ background: "var(--mint, rgba(61,138,95,.12))" }}>
        <CheckCircle2 size={16} strokeWidth={2.2} /> Chiqim yopildi — {stemsFmt(result.shared_stems)} taqsimlandi
        {result.returned_stems > 0 ? ` · ${stemsFmt(result.returned_stems)} skladga qaytdi` : ""}
        {result.unplaced_stems > 0 ? ` · ${stemsFmt(result.unplaced_stems)} joylanmadi` : ""}
      </div>
      {result.items.length > 0 && (
        <div className="flex flex-col gap-1">
          {result.items.map((it) => (
            <div key={it.catalog_item} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate font-semibold">{it.catalog_name}{it.quantity_total > 1 ? ` ×${it.quantity_total}` : ""}</span>
              <span className="shrink-0 tabular-nums" style={{ color: "var(--text-2)" }}>{it.stems_per_item}/dona{it.quantity_total > 1 ? ` · ${it.stems_total} jami` : ""}</span>
            </div>
          ))}
        </div>
      )}
      <ModalFooter>
        <button onClick={onClose} className="btn-primary">Yopish</button>
      </ModalFooter>
    </div>
  );
}
