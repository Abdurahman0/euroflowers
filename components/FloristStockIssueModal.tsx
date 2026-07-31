"use client";
import { useMemo, useState } from "react";
import { PackagePlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import Select from "./Select";
import DualQtyInput, { type QtyMode } from "./DualQtyInput";
import StockLine, { lineFromStockBatch } from "./StockLine";
import { formatStemsAndBunches } from "@/lib/inventory";
import type { FloristProfile, StockBatch } from "@/lib/types";

const floristName = (fp?: FloristProfile | null): string =>
  fp ? [fp.user_detail?.first_name, fp.user_detail?.last_name].filter(Boolean).join(" ") || fp.user_detail?.username || `#${fp.id}` : "—";

/**
 * Skladdan floristga gul CHIQARISH — modal (Modal komponenti qayta ishlatildi, yangi
 * pattern YO'Q). Inline forma bilan aynan bir xil: florist select, qidiriladigan partiya
 * select (rasm bilan), Dona/Bog'lam, izoh, jonli «Qoldiq: X → Y» preview, oshib ketsa
 * bloklanadi, 400 da server `detail` AYNAN ko'rsatiladi. Muvaffaqiyatda: onDone (balanslarni
 * qayta yuklaydi — issue javobida stems_per_bunch yo'q) + yopiladi.
 */
export default function FloristStockIssueModal({
  initialFlorist = 0,
  batches,
  florists,
  onClose,
  onDone,
}: {
  initialFlorist?: number;
  batches: StockBatch[];
  florists: FloristProfile[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useStore();
  const [fFlorist, setFFlorist] = useState(initialFlorist);
  const [fBatch, setFBatch] = useState(0);
  const [fMode, setFMode] = useState<QtyMode>("stems");
  const [fQty, setFQty] = useState("");
  const [fReason, setFReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selBatch = batches.find((b) => b.id === fBatch);
  const spb = selBatch?.stems_per_bunch || 1;
  const fStems = fMode === "bunches" ? Math.round((parseFloat(fQty) || 0) * spb) : Math.round(parseFloat(fQty) || 0);
  const over = selBatch ? fStems > selBatch.remaining_stems : false;
  // depleted partiyalar allaqachon skladdan chiqarilgan (parent remaining>0 filtr qiladi)
  const batchOpts = useMemo(() => [...batches]
    .sort((a, b) => `${a.variant_detail?.flower_detail?.name_uz}`.localeCompare(`${b.variant_detail?.flower_detail?.name_uz}`))
    .map((b) => ({
      value: b.id,
      label: `${b.variant_detail?.flower_detail?.name_uz ?? ""} ${b.variant_detail?.name_uz ?? ""}${b.variant_detail?.color_uz ? ` · ${b.variant_detail.color_uz}` : ""}${b.height_label ? ` · ${b.height_label}` : ""}`,
      sub: `№${b.batch_number} · ${formatStemsAndBunches(b.remaining_stems, b.stems_per_bunch)}`,
    })), [batches]);

  const submit = async () => {
    if (!fFlorist) return showToast("Floristni tanlang");
    if (!fBatch) return showToast("Partiyani tanlang");
    if (fStems <= 0) return showToast("Miqdorni kiriting");
    if (over) return showToast(`Skladda atigi ${formatStemsAndBunches(selBatch!.remaining_stems, spb)} bor`);
    setBusy(true); setErr(null);
    try {
      await api.floristStockIssue({ florist: fFlorist, batch: fBatch, quantity_stems: fStems, reason: fReason.trim() || undefined });
      showToast(`✓ ${fStems} dona chiqarildi`);
      onDone(); // ⚠️ balanslarni QAYTA yuklaydi (issue javobida stems_per_bunch yo'q)
      onClose();
    } catch (e) {
      // 400: server `detail` AYNAN ko'rsatiladi
      const detail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : null;
      setErr(detail || (e instanceof ApiError ? e.message : "Chiqarib bo'lmadi"));
      showToast(e instanceof ApiError ? e.message : "Chiqarib bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={480}>
      <ModalHeader icon={<PackagePlus size={19} strokeWidth={1.8} />} title="Skladdan chiqarish" sub="Floristga gul chiqarish — u keyin katalog yasaydi" onClose={onClose} />

      <Field label="Florist" span>
        <Select value={fFlorist} onChange={(v) => setFFlorist(+v)} placeholder="Floristni tanlang" searchable options={florists.map((fp) => ({ value: fp.id, label: floristName(fp) }))} />
      </Field>

      <Field label="Partiya (skladdan)" span>
        <Select value={fBatch} onChange={(v) => { setFBatch(+v); setFQty(""); }} placeholder="Gulni tanlang" searchable options={batchOpts} />
      </Field>

      {/* tanlangan partiya — balanslar bilan BIR XIL qator grammatikasi (rasm + nomlar) */}
      {selBatch && (
        <div className="mt-3 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
          <StockLine data={lineFromStockBatch(selBatch)} right={<span className="text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{formatStemsAndBunches(selBatch.remaining_stems, spb)}</span>} />
        </div>
      )}

      <div className="mt-3">
        <DualQtyInput mode={fMode} value={fQty} stemsPerBunch={spb} onMode={setFMode} onValue={setFQty} label="Soni" autoFocus />
      </div>

      <Field label="Izoh (ixtiyoriy)" span>
        <input className="inp" value={fReason} onChange={(e) => setFReason(e.target.value)} placeholder="Masalan: Ertangi buketlar uchun" />
      </Field>

      {selBatch && fStems > 0 && (
        <div className="mt-3 rounded-[12px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: over ? "var(--danger-soft, rgba(160,74,74,.12))" : "var(--surface-2)", color: over ? "var(--danger-ink)" : "var(--text-2)" }}>
          {over ? `Skladda atigi ${formatStemsAndBunches(selBatch.remaining_stems, spb)} bor`
            : <>Qoldiq: {selBatch.remaining_stems.toLocaleString("ru")} → <b style={{ color: "var(--primary)" }}>{(selBatch.remaining_stems - fStems).toLocaleString("ru")}</b> dona</>}
        </div>
      )}

      {err && <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={submit} disabled={busy || over || fStems <= 0 || !fFlorist} className="btn-primary disabled:opacity-60">{busy ? "Chiqarilmoqda…" : "Chiqarish"}</button>
      </ModalFooter>
    </Modal>
  );
}
