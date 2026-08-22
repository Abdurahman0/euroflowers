"use client";
import { useMemo, useRef, useState } from "react";
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
import { formatStemsAndBunches } from "@/lib/inventory";
import { groupBatchesForIssue, allocateStems, mergeAllocations, type BatchGroup } from "@/lib/floristBatchGroups";
import type { FloristProfile, StockBatch } from "@/lib/types";

const floristName = (fp?: FloristProfile | null): string =>
  fp ? [fp.user_detail?.first_name, fp.user_detail?.last_name].filter(Boolean).join(" ") || fp.user_detail?.username || `#${fp.id}` : "—";

/** ⚠️ Qator endi PARTIYA emas, GURUH ustida ishlaydi (postavshik + gul turi + bo'yi):
    bir xil gulning bir necha partiyasi tanlagichda BITTA variant bo'lib chiqadi. */
type Row = { group: string; mode: QtyMode; qty: string };

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
  batchesLoading = false,
  florists,
  onClose,
  onDone,
}: {
  initialFlorist?: number;
  batches: StockBatch[];
  /** ⚠️ partiyalar forma OCHILGANDA olinadi — kelguncha tanlagich bo'sh ko'rinib
      «partiya yo'q» degan xato taassurot bermasligi uchun shu bayroq. */
  batchesLoading?: boolean;
  florists: FloristProfile[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useStore();
  const [florist, setFlorist] = useState(initialFlorist);
  const [rows, setRows] = useState<Row[]>([{ group: "", mode: "bunches", qty: "" }]);
  const [reason, setReason] = useState("");
  // ORQAGA SANA — yig'iq; belgilanmasa kalit umuman yuborilmaydi
  const [dateOn, setDateOn] = useState(false);
  const [issuedAt, setIssuedAt] = useState("");
  const [busy, setBusy] = useState(false);
  // ALL-OR-NOTHING: server matnida partiya raqami bo'lsa o'sha qatorga (batch id → matn) bog'laymiz
  const [rowErr, setRowErr] = useState<Record<number, string>>({});
  // umumiy tranzaksiya xatosi (partiya aniqlanmasa) — banner sifatida
  const [formErr, setFormErr] = useState<string | null>(null);
  const [flashGroup, setFlashGroup] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  // ⚠️ GURUHLAR — postavshik + gul turi (nav) + bo'yi bir xil bo'lgan partiyalar birlashadi.
  //    Qoldiq yig'indi bo'lib ko'rsatiladi, taqsimot yuborishda FIFO bilan qilinadi.
  const groups = useMemo(() => groupBatchesForIssue(batches), [batches]);
  const groupOf = (key: string): BatchGroup | undefined => groups.find((g) => g.key === key);
  /** pochka hisobi faqat partiyalar bir xil bo'lsa; aks holda DONA bilan ishlanadi */
  const spbOf = (key: string) => groupOf(key)?.stemsPerBunch ?? 1;
  const stemsOf = (r: Row) => { const n = parseFloat(r.qty) || 0; return r.mode === "bunches" ? Math.round(n * spbOf(r.group)) : Math.round(n); };
  const remainingOf = (key: string) => groupOf(key)?.remainingStems ?? 0;
  const overOf = (r: Row) => !!r.group && stemsOf(r) > remainingOf(r.group);

  const flash = (key: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashGroup(key);
    showToast("Mavjud qatorga qo'shildi");
    flashTimer.current = setTimeout(() => setFlashGroup(null), 600);
  };

  // ⚠️ TUGAGAN partiyalarni (remaining_stems <= 0) tanlagichda KO'RSATMAYMIZ — chiqarib bo'lmaydi.
  //    (Ota-sahifa ham refetch qiladi; bu esa modal ichidagi himoya — eski/tugagan partiya sirg'alib chiqmasin.)
  const batchOpts = useMemo(() => groups.map((g) => ({
    value: g.key,
    label: g.label,
    // ⚠️ Sarlavhada YIG'INDI qoldiq; nechta partiyadan yig'ilgani ham aytiladi (yashirilmaydi)
    sub: `${g.supplierName || "postavshiksiz"} · ${formatStemsAndBunches(g.remainingStems, g.stemsPerBunch ?? 1)}${g.items.length > 1 ? ` · ${g.items.length} partiya` : ""}`,
  })), [groups]);

  // DUBLIKAT partiya → mavjud qatorga qo'shiladi (composer bilan bir xil), aks holda qatorni belgilaymiz.
  // ⚠️ flash/toast setRows UPDATER'idan TASHQARIDA chaqiriladi (render paytida setState bermaslik uchun).
  const setBatchAt = (i: number, newKey: string) => {
    setRowErr({}); setFormErr(null);
    const dupIdx = rows.findIndex((r, j) => j !== i && r.group === newKey && !!newKey);
    if (dupIdx === -1) {
      const g = groupOf(newKey);
      // ⚠️ Pochka faqat partiyalar bir xil bo'lsa; aralash bo'lsa DONA rejimi majburiy
      setRows((rs) => rs.map((r, j) => (j === i ? { group: newKey, qty: "", mode: g?.stemsPerBunch ? defaultQtyMode(g.stemsPerBunch) : "stems" } : r)));
      return;
    }
    const spb = spbOf(newKey);
    const inc = stemsOf(rows[i]);
    setRows((rs) => rs
      .map((x, j) => {
        if (j !== dupIdx) return x;
        const cur = x.mode === "bunches" ? (parseFloat(x.qty) || 0) + inc / spb : (parseFloat(x.qty) || 0) + inc;
        return { ...x, qty: x.mode === "bunches" ? String(+cur.toFixed(2)) : String(Math.round(cur)) };
      })
      .filter((_, j) => j !== i));
    flash(newKey);
  };
  const setQtyAt = (i: number, qty: string) => { setRowErr({}); setFormErr(null); setRows((rs) => rs.map((r, j) => (j === i ? { ...r, qty } : r))); };
  const setModeAt = (i: number, mode: QtyMode) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, mode } : r)));
  const addRow = () => setRows((rs) => [...rs, { group: "", mode: "bunches", qty: "" }]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  const validRows = rows.filter((r) => !!r.group && stemsOf(r) > 0);
  const anyOver = rows.some(overOf);
  const totalStems = validRows.reduce((s, r) => s + stemsOf(r), 0);
  // ⚠️ TANNARX — taqsimot bo'yicha (har partiyaning O'Z tannarxi), o'rtacha emas
  const totalCost = validRows.reduce((s, r) => {
    const g = groupOf(r.group);
    if (!g) return s;
    return s + allocateStems(g.items, stemsOf(r)).reduce((c, a) => {
      const b = g.items.find((x) => x.id === a.batch);
      return c + a.quantity_stems * Math.round(+(b?.cost_per_stem ?? 0));
    }, 0);
  }, 0);

  const submit = async () => {
    if (!florist) return showToast("Floristni tanlang");
    if (validRows.length === 0) return showToast("Kamida bitta gul va sonini kiriting");
    if (anyOver) return showToast("Ba'zi qatorlar qoldiqdan oshib ketdi");
    setBusy(true); setRowErr({}); setFormErr(null);
    try {
      // ⚠️ BITTA TRANZAKSIYA — bitta gulda qoldiq yetmasa HECH BIRI chiqmaydi (all-or-nothing).
      // ⚠️ GURUH → PARTIYALAR: tanlangan dona FIFO bilan taqsimlanadi (eski partiyadan
      //    boshlab), bir partiyaga ikki qatordan tushsa BITTA qatorga jamlanadi.
      //    Backend baribir har partiyani alohida tekshiradi (all-or-nothing).
      const items = mergeAllocations(validRows.flatMap((r) => allocateStems(groupOf(r.group)?.items ?? [], stemsOf(r))));
      await api.floristStockBulkIssue({ florist, items, reason: reason.trim() || undefined, ...backdatePayload(dateOn ? issuedAt : "") });
      showToast(`✓ ${validRows.length} ta gul chiqarildi`);
      onDone(); // balanslar + partiya qoldiqlari qayta yuklanadi
      onClose();
    } catch (e) {
      // ⚠️ HECH NARSA chiqmadi — HAMMA qator qoladi. Server matnidagi partiya raqamiga qarab aybdorni belgilaymiz.
      const detail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? (e.body as { detail: unknown }).detail : null;
      const msg = Array.isArray(detail) ? detail.join("\n") : detail != null ? String(detail) : (e instanceof ApiError ? e.message : "Chiqarib bo'lmadi");
      const offending: Record<number, string> = {};
      // server matnida partiya raqami bo'lsa — o'sha partiya QAYSI qatordan kelganini topamiz
      rows.forEach((r, i) => {
        const g = groupOf(r.group);
        if (g && g.items.some((b) => b.batch_number && msg.includes(b.batch_number))) offending[i] = msg;
      });
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
          const g = groupOf(r.group);
          const spb = g?.stemsPerBunch ?? 1;
          const stems = stemsOf(r);
          const over = overOf(r);
          const flashing = flashGroup != null && r.group === flashGroup;
          const err = rowErr[i];
          return (
            <div key={i} className="rounded-[13px] border p-2.5 transition-colors duration-300"
              style={{ borderColor: over || err ? "var(--danger-ink)" : "var(--border)", background: flashing ? "color-mix(in srgb, var(--primary) 12%, transparent)" : (over || err) ? "var(--danger-soft, rgba(160,74,74,.08))" : undefined, boxShadow: flashing ? "inset 0 0 0 1.5px var(--primary)" : undefined }}>
              <div className="grid grid-cols-[1fr_32px] items-center gap-2">
                <Select value={r.group} onChange={(v) => setBatchAt(i, String(v))}
                  placeholder={batchesLoading && batchOpts.length === 0 ? "Partiyalar yuklanmoqda…" : "Gulni tanlang"}
                  searchable options={batchOpts} />
                {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>}
              </div>
              {g && (
                <div className="mt-2 rounded-[11px] border p-2" style={{ borderColor: "var(--border)" }}>
                  <StockLine
                    data={lineFromStockBatch(g.items[0])}
                    right={<span className="text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{formatStemsAndBunches(g.remainingStems, spb)}</span>}
                  />
                  {/* ⚠️ Guruh BIR NECHTA partiyadan yig'ilgan bo'lsa — yashirmaymiz: qaysi
                      partiyalardan ekani va eskisidan boshlab ketishi ochiq aytiladi. */}
                  {g.items.length > 1 && (
                    <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: "var(--muted)" }}>
                      {g.items.length} partiya birlashtirildi ({g.items.map((x) => `№${x.batch_number} ${x.remaining_stems}`).join(" · ")}) — eskisidan boshlab yechiladi
                    </p>
                  )}
                  {g.stemsPerBunch == null && (
                    <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>
                      Partiyalarda pochka soni har xil — faqat DONA bilan kiritiladi
                    </p>
                  )}
                </div>
              )}
              {!!r.group && (
                <div className="mt-2">
                  <DualQtyInput
                    mode={g?.stemsPerBunch ? r.mode : "stems"}
                    value={r.qty}
                    stemsPerBunch={spb}
                    onMode={(m) => { if (g?.stemsPerBunch) setModeAt(i, m); }}
                    onValue={(q) => setQtyAt(i, q)}
                    label="Soni"
                  />
                </div>
              )}
              {!!r.group && stems > 0 && (
                <div className="mt-1.5 rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: over ? "var(--danger-soft, rgba(160,74,74,.12))" : "var(--surface-2)", color: over ? "var(--danger-ink)" : "var(--text-2)" }}>
                  {over ? `Skladda atigi ${formatStemsAndBunches(remainingOf(r.group), spb)} bor`
                    : <>Qoldiq: {remainingOf(r.group).toLocaleString("ru")} → <b style={{ color: "var(--primary)" }}>{(remainingOf(r.group) - stems).toLocaleString("ru")}</b> dona</>}
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
