"use client";
import { useMemo, useRef, useState } from "react";
import { PackagePlus, Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import Select from "./Select";
import DualQtyInput, { defaultQtyMode, type QtyMode } from "./DualQtyInput";
import StockLine, { lineFromStockBatch } from "./StockLine";
import { fmt } from "@/lib/format";
import { formatStemsAndBunches, batchDeliveryTag } from "@/lib/inventory";
import type { FloristProfile, StockBatch } from "@/lib/types";

const floristName = (fp?: FloristProfile | null): string =>
  fp ? [fp.user_detail?.first_name, fp.user_detail?.last_name].filter(Boolean).join(" ") || fp.user_detail?.username || `#${fp.id}` : "—";

type Row = { batch: number; mode: QtyMode; qty: string };

/**
 * Skladdan floristga gul CHIQARISH — KO'P QATORLI (katalog kompozitsiya quruvchisi pattern'i).
 * Florist bir marta yuqorida tanlanadi; keyin N qator = partiya + Dona/Bog'lam soni + jonli
 * «Qoldiq: X → Y» preview. Bir xil partiya tanlansa mavjud qatorga QO'SHILADI (flash + toast).
 * ⚠️ Backend bitta so'rovda BITTA partiya qabul qiladi (FloristStockIssueRequest) → qatorlar
 * KETMA-KET yuboriladi, bitta amal sifatida ko'rsatiladi; qisman xatoda qaysi qator o'tgani/
 * o'tmagani (server matni bilan) aniq ko'rsatiladi.
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
  const [florist, setFlorist] = useState(initialFlorist);
  const [rows, setRows] = useState<Row[]>([{ batch: 0, mode: "bunches", qty: "" }]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // qisman xatoda: qaysi partiya qatoriga server nima dedi (batch id → matn)
  const [rowErr, setRowErr] = useState<Record<number, string>>({});
  const [flashBatch, setFlashBatch] = useState<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  const batchOf = (id: number) => batches.find((b) => b.id === id);
  const stemsOf = (r: Row) => { const spb = batchOf(r.batch)?.stems_per_bunch || 1; const n = parseFloat(r.qty) || 0; return r.mode === "bunches" ? Math.round(n * spb) : Math.round(n); };
  const remainingOf = (id: number) => batchOf(id)?.remaining_stems ?? 0;
  const overOf = (r: Row) => r.batch > 0 && stemsOf(r) > remainingOf(r.batch);

  const flash = (batch: number) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashBatch(batch);
    showToast("Mavjud qatorga qo'shildi");
    flashTimer.current = setTimeout(() => setFlashBatch(null), 600);
  };

  const batchOpts = useMemo(() => [...batches]
    .sort((a, b) => `${a.variant_detail?.flower_detail?.name_uz}`.localeCompare(`${b.variant_detail?.flower_detail?.name_uz}`))
    .map((b) => ({
      value: b.id,
      label: `${b.variant_detail?.flower_detail?.name_uz ?? ""} ${b.variant_detail?.name_uz ?? ""}${b.variant_detail?.color_uz ? ` · ${b.variant_detail.color_uz}` : ""}${b.height_label ? ` · ${b.height_label}` : ""}`,
      sub: `№${b.batch_number} · ${formatStemsAndBunches(b.remaining_stems, b.stems_per_bunch)}${batchDeliveryTag(b.delivery_detail) ? ` · ${batchDeliveryTag(b.delivery_detail)}` : ""}`,
    })), [batches]);

  // DUBLIKAT partiya → mavjud qatorga qo'shiladi (composer bilan bir xil), aks holda qatorni belgilaymiz.
  // ⚠️ flash/toast setRows UPDATER'idan TASHQARIDA chaqiriladi (render paytida setState bermaslik uchun).
  const setBatchAt = (i: number, newBatch: number) => {
    setRowErr({});
    const dupIdx = rows.findIndex((r, j) => j !== i && r.batch === newBatch && newBatch > 0);
    if (dupIdx === -1) {
      setRows((rs) => rs.map((r, j) => (j === i ? { batch: newBatch, qty: "", mode: defaultQtyMode(batchOf(newBatch)?.stems_per_bunch) } : r)));
      return;
    }
    const spb = batchOf(newBatch)?.stems_per_bunch || 1;
    const inc = stemsOf(rows[i]);
    setRows((rs) => rs
      .map((x, j) => {
        if (j !== dupIdx) return x;
        const cur = x.mode === "bunches" ? (parseFloat(x.qty) || 0) + inc / spb : (parseFloat(x.qty) || 0) + inc;
        return { ...x, qty: x.mode === "bunches" ? String(+cur.toFixed(2)) : String(Math.round(cur)) };
      })
      .filter((_, j) => j !== i));
    flash(newBatch);
  };
  const setQtyAt = (i: number, qty: string) => { setRowErr({}); setRows((rs) => rs.map((r, j) => (j === i ? { ...r, qty } : r))); };
  const setModeAt = (i: number, mode: QtyMode) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, mode } : r)));
  const addRow = () => setRows((rs) => [...rs, { batch: 0, mode: "bunches", qty: "" }]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  const validRows = rows.filter((r) => r.batch > 0 && stemsOf(r) > 0);
  const anyOver = rows.some(overOf);
  const totalStems = validRows.reduce((s, r) => s + stemsOf(r), 0);
  const totalCost = validRows.reduce((s, r) => s + stemsOf(r) * Math.round(+(batchOf(r.batch)?.cost_per_stem ?? 0)), 0);

  const submit = async () => {
    if (!florist) return showToast("Floristni tanlang");
    if (validRows.length === 0) return showToast("Kamida bitta gul va sonini kiriting");
    if (anyOver) return showToast("Ba'zi qatorlar qoldiqdan oshib ketdi");
    setBusy(true); setRowErr({});
    // ⚠️ KETMA-KET (backend bitta partiya/so'rov). Har qatorning natijasini yig'amiz.
    const errs: Record<number, string> = {};
    let ok = 0;
    for (const r of validRows) {
      try {
        await api.floristStockIssue({ florist, batch: r.batch, quantity_stems: stemsOf(r), reason: reason.trim() || undefined });
        ok++;
      } catch (e) {
        const detail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : null;
        errs[r.batch] = detail || (e instanceof ApiError ? e.message : "Chiqarib bo'lmadi");
      }
    }
    onDone(); // har holatda balanslarni + qoldiqlarni qayta yuklaymiz
    if (Object.keys(errs).length === 0) {
      showToast(`✓ ${ok} ta gul chiqarildi`);
      onClose();
      return;
    }
    // QISMAN: o'tgan qatorlarni olib tashlab, XATO qatorlarni matn bilan qoldiramiz
    showToast(`${ok} ta chiqarildi · ${Object.keys(errs).length} ta xato`);
    setRows(validRows.filter((r) => errs[r.batch]));
    setRowErr(errs);
    setBusy(false);
  };

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader icon={<PackagePlus size={19} strokeWidth={1.8} />} title="Skladdan chiqarish" sub="Floristga bir yoki bir nechta gul chiqarish" onClose={onClose} />

      <Field label="Florist" span>
        <Select value={florist} onChange={(v) => setFlorist(+v)} placeholder="Floristni tanlang" searchable options={florists.map((fp) => ({ value: fp.id, label: floristName(fp) }))} />
      </Field>

      <div className="mt-3 flex flex-col gap-2.5">
        {rows.map((r, i) => {
          const b = batchOf(r.batch);
          const spb = b?.stems_per_bunch || 1;
          const stems = stemsOf(r);
          const over = overOf(r);
          const flashing = flashBatch != null && r.batch === flashBatch;
          const err = r.batch > 0 ? rowErr[r.batch] : undefined;
          return (
            <div key={i} className="rounded-[13px] border p-2.5 transition-colors duration-300"
              style={{ borderColor: over || err ? "var(--danger-ink)" : "var(--border)", background: flashing ? "color-mix(in srgb, var(--primary) 12%, transparent)" : (over || err) ? "var(--danger-soft, rgba(160,74,74,.08))" : undefined, boxShadow: flashing ? "inset 0 0 0 1.5px var(--primary)" : undefined }}>
              <div className="grid grid-cols-[1fr_32px] items-center gap-2">
                <Select value={r.batch} onChange={(v) => setBatchAt(i, +v)} placeholder="Gulni tanlang" searchable options={batchOpts} />
                {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>}
              </div>
              {b && (
                <div className="mt-2 rounded-[11px] border p-2" style={{ borderColor: "var(--border)" }}>
                  <StockLine data={lineFromStockBatch(b)} right={<span className="text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{formatStemsAndBunches(b.remaining_stems, spb)}</span>} />
                </div>
              )}
              {r.batch > 0 && (
                <div className="mt-2">
                  <DualQtyInput mode={r.mode} value={r.qty} stemsPerBunch={spb} onMode={(m) => setModeAt(i, m)} onValue={(q) => setQtyAt(i, q)} label="Soni" />
                </div>
              )}
              {r.batch > 0 && stems > 0 && (
                <div className="mt-1.5 rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: over ? "var(--danger-soft, rgba(160,74,74,.12))" : "var(--surface-2)", color: over ? "var(--danger-ink)" : "var(--text-2)" }}>
                  {over ? `Skladda atigi ${formatStemsAndBunches(remainingOf(r.batch), spb)} bor`
                    : <>Qoldiq: {remainingOf(r.batch).toLocaleString("ru")} → <b style={{ color: "var(--primary)" }}>{(remainingOf(r.batch) - stems).toLocaleString("ru")}</b> dona</>}
                </div>
              )}
              {err && <p className="mt-1.5 whitespace-pre-line text-[12px] font-semibold" style={{ color: "var(--danger-ink)" }}>{err}</p>}
            </div>
          );
        })}
        <button type="button" onClick={addRow} className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3.5 py-1.5 text-[12px] font-bold">
          <Plus size={15} strokeWidth={1.75} /> Gul qo&apos;shish
        </button>
      </div>

      <Field label="Izoh (ixtiyoriy — hamma gulga)" span>
        <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: Ertangi buketlar uchun" />
      </Field>

      {/* XULOSA — nechta gul, jami dona, tannarx qiymati */}
      {validRows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[12px] px-3 py-2 text-[12.5px] font-bold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
          <span>{validRows.length} gul · <span style={{ color: "var(--primary)" }}>{totalStems.toLocaleString("ru")} dona</span></span>
          <span>Tannarx: <span style={{ color: "var(--acc)" }}>{fmt(totalCost)}</span></span>
        </div>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={submit} disabled={busy || anyOver || validRows.length === 0 || !florist} className="btn-primary disabled:opacity-60">{busy ? "Chiqarilmoqda…" : validRows.length > 1 ? `${validRows.length} gulni chiqarish` : "Chiqarish"}</button>
      </ModalFooter>
    </Modal>
  );
}
