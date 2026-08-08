"use client";
import { useMemo, useRef, useState } from "react";
import { batchTitleNoHeight, flowerName } from "@/lib/stockLabel";
import { PackagePlus, Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import BackdateField from "./BackdateField";
import { backdatePayload } from "@/lib/backdate";
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
  // ORQAGA SANA — yig'iq; belgilanmasa kalit umuman yuborilmaydi
  const [dateOn, setDateOn] = useState(false);
  const [issuedAt, setIssuedAt] = useState("");
  const [busy, setBusy] = useState(false);
  // ALL-OR-NOTHING: server matnida partiya raqami bo'lsa o'sha qatorga (batch id → matn) bog'laymiz
  const [rowErr, setRowErr] = useState<Record<number, string>>({});
  // umumiy tranzaksiya xatosi (partiya aniqlanmasa) — banner sifatida
  const [formErr, setFormErr] = useState<string | null>(null);
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

  // ⚠️ TUGAGAN partiyalarni (remaining_stems <= 0) tanlagichda KO'RSATMAYMIZ — chiqarib bo'lmaydi.
  //    (Ota-sahifa ham refetch qiladi; bu esa modal ichidagi himoya — eski/tugagan partiya sirg'alib chiqmasin.)
  const batchOpts = useMemo(() => [...batches]
    .filter((b) => (b.remaining_stems ?? 0) > 0)
    .sort((a, b) => flowerName(a).localeCompare(flowerName(b)))
    .map((b) => ({
      value: b.id,
      label: `${batchTitleNoHeight(b, "")}${b.height_label ? ` · ${b.height_label}` : ""}`,
      sub: `№${b.batch_number} · ${formatStemsAndBunches(b.remaining_stems, b.stems_per_bunch)}${batchDeliveryTag(b.delivery_detail) ? ` · ${batchDeliveryTag(b.delivery_detail)}` : ""}`,
    })), [batches]);

  // DUBLIKAT partiya → mavjud qatorga qo'shiladi (composer bilan bir xil), aks holda qatorni belgilaymiz.
  // ⚠️ flash/toast setRows UPDATER'idan TASHQARIDA chaqiriladi (render paytida setState bermaslik uchun).
  const setBatchAt = (i: number, newBatch: number) => {
    setRowErr({}); setFormErr(null);
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
  const setQtyAt = (i: number, qty: string) => { setRowErr({}); setFormErr(null); setRows((rs) => rs.map((r, j) => (j === i ? { ...r, qty } : r))); };
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
    setBusy(true); setRowErr({}); setFormErr(null);
    try {
      // ⚠️ BITTA TRANZAKSIYA — bitta gulda qoldiq yetmasa HECH BIRI chiqmaydi (all-or-nothing).
      await api.floristStockBulkIssue({ florist, items: validRows.map((r) => ({ batch: r.batch, quantity_stems: stemsOf(r) })), reason: reason.trim() || undefined, ...backdatePayload(dateOn ? issuedAt : "") });
      showToast(`✓ ${validRows.length} ta gul chiqarildi`);
      onDone(); // balanslar + partiya qoldiqlari qayta yuklanadi
      onClose();
    } catch (e) {
      // ⚠️ HECH NARSA chiqmadi — HAMMA qator qoladi. Server matnidagi partiya raqamiga qarab aybdorni belgilaymiz.
      const detail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? (e.body as { detail: unknown }).detail : null;
      const msg = Array.isArray(detail) ? detail.join("\n") : detail != null ? String(detail) : (e instanceof ApiError ? e.message : "Chiqarib bo'lmadi");
      const offending: Record<number, string> = {};
      for (const r of validRows) { const bn = batchOf(r.batch)?.batch_number; if (bn && msg.includes(bn)) offending[r.batch] = msg; }
      setRowErr(offending);
      setFormErr(msg); // umumiy banner (partiya aniq bo'lsa ham — all-or-nothing ekanini ta'kidlaydi)
      showToast(e instanceof ApiError ? e.message : "Chiqarib bo'lmadi");
      setBusy(false);
    }
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
        {/* ⚠️ BITTA sana — bulk-issue hamma qatorni SHU kunga yozadi */}
        <Field label="Chiqim sanasi" span>
          <BackdateField
            value={issuedAt} onChange={setIssuedAt} open={dateOn} onOpenChange={setDateOn}
            label="Chiqim sanasi" toggleTitle="Boshqa chiqim sanasi (ish qolib ketgan bo'lsa)"
            retroNote="Chiqim yozuvi VA sklad harakati o'sha kunga tushadi."
          />
      </Field>

      {/* XULOSA — nechta gul, jami dona, tannarx qiymati + ALL-OR-NOTHING eslatmasi */}
      {validRows.length > 0 && (
        <div className="mt-3 rounded-[12px] px-3 py-2" style={{ background: "var(--surface-2)" }}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12.5px] font-bold" style={{ color: "var(--text-2)" }}>
            <span>{validRows.length} gul · <span style={{ color: "var(--primary)" }}>{totalStems.toLocaleString("ru")} dona</span></span>
            <span>Tannarx: <span style={{ color: "var(--acc)" }}>{fmt(totalCost)}</span></span>
          </div>
          {validRows.length > 1 && <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>Bitta gulda qoldiq yetmasa, hech biri chiqarilmaydi (bitta tranzaksiya).</p>}
        </div>
      )}

      {/* TRANZAKSIYA XATOSI — hech narsa chiqmadi, server matni AYNAN */}
      {formErr && (
        <p className="mt-3 whitespace-pre-line rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          Hech biri chiqarilmadi — {formErr}
        </p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={submit} disabled={busy || anyOver || validRows.length === 0 || !florist} className="btn-primary disabled:opacity-60">{busy ? "Chiqarilmoqda…" : validRows.length > 1 ? `${validRows.length} gulni chiqarish` : "Chiqarish"}</button>
      </ModalFooter>
    </Modal>
  );
}
