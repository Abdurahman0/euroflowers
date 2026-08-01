"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import DatePicker from "./DatePicker";
import DualQtyInput, { qtyPayload, defaultQtyMode, type QtyMode } from "./DualQtyInput";
import { CalendarClock } from "lucide-react";
import { Icon } from "./icons";
import { fmtDate } from "@/lib/format";
import { MOVEMENT_LABEL, MOVEMENT_HUE, stems, formatStemsAndBunches } from "@/lib/inventory";
import type { MovementType, StockBatch, StockMovement } from "@/lib/types";

const REDUCING = new Set<MovementType>(["waste", "out", "transfer_out"]);
const ADDING = new Set<MovementType>(["in", "transfer_in"]);

const MOVE_OPTS: { value: MovementType; label: string }[] = [
  { value: "waste", label: MOVEMENT_LABEL.waste },
  { value: "out", label: MOVEMENT_LABEL.out },
  { value: "adjustment", label: MOVEMENT_LABEL.adjustment },
  { value: "in", label: MOVEMENT_LABEL.in },
];
const REASON_CHIPS = ["Chiqit", "So'lgan", "Sinov", "Tuzatish"];

/** Qo'lda harakat / chiqit (POST /stock-batches/{id}/movement/). Dona/Pochka toggle + sabab chiplari. */
export function BatchMovementModal({ batch, onClose, onDone }: { batch: StockBatch; onClose: () => void; onDone: (updated: StockBatch) => void }) {
  const { showToast } = useStore();
  const [type, setType] = useState<MovementType>("waste");
  // ⚠️ DEFAULT = POCHKA (stock shu tarzda keladi) — spb yo'q/1 bo'lsa dona'ga tushamiz
  const [mode, setMode] = useState<QtyMode>(() => defaultQtyMode(batch.stems_per_bunch));
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // HARAKAT SANASI — ixtiyoriy; yoqilib o'zgartirilsagina yuboriladi (aks holda backend: hozir)
  const [dateOn, setDateOn] = useState(false);
  const [movedAt, setMovedAt] = useState("");

  const spb = batch.stems_per_bunch || 1;
  const projStems = mode === "bunches" ? Math.round((parseFloat(qty) || 0) * spb) : Math.round(parseFloat(qty) || 0);
  const before = batch.remaining_stems;
  const after = REDUCING.has(type) ? before - projStems : ADDING.has(type) ? before + projStems : before;
  const below = REDUCING.has(type) && after < 0;

  const save = async () => {
    const n = parseFloat(qty) || 0;
    if (n <= 0) return showToast("Miqdorni kiriting");
    if (below) return showToast(`Qoldiq yetarli emas: bor-yo'g'i ${stems(before)}`);
    setBusy(true);
    try {
      await api.batchMovement(batch.id, { movement_type: type, ...qtyPayload(mode, qty), reason: reason.trim(), ...(dateOn && movedAt ? { created_at: movedAt } : {}) });
      // javob shakli kafolatlanmagan — partiyani qayta o'qiymiz
      const fresh = await api.stockBatch(batch.id).catch(() => null);
      showToast("✓ Harakat qayd etildi");
      onDone(fresh ?? batch);
      onClose();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  const v = batch.variant_detail;
  return (
    <Modal onClose={onClose} width={440}>
      <ModalHeader icon={<Icon name="sklad" size={20} />} title="Harakat qo'shish" sub={`${v?.flower_detail?.name_uz ?? ""} ${v?.name_uz ?? ""} · №${batch.batch_number}`} onClose={onClose} />
      {/* qoldiq: hozirgi → proyeksiya, ikki birlikda; nolga tushsa amber + bloklanadi */}
      <div
        className="mt-2 rounded-[12px] px-3 py-2 text-[12.5px] font-semibold transition-colors"
        style={{
          background: below ? "var(--danger-soft, rgba(160,74,74,.12))" : "var(--surface-2)",
          color: below ? "var(--danger-ink)" : "var(--text-2)",
        }}
      >
        {projStems > 0 ? (
          <>
            Qoldiq: {before.toLocaleString("ru")} → <b style={{ color: below ? "var(--danger-ink)" : "var(--text)" }}>{after.toLocaleString("ru")}</b>
            {" dona · "}
            {(before / spb).toFixed(1).replace(/\.0$/, "")} → <b style={{ color: below ? "var(--danger-ink)" : "var(--text)" }}>{(after / spb).toFixed(1).replace(/\.0$/, "")}</b> bog&apos;lam
            {below && <span className="mt-1 block text-[11.5px]">Qoldiqdan ko&apos;p — {stems(before)} bor</span>}
          </>
        ) : (
          <>Joriy qoldiq: {formatStemsAndBunches(before, spb)}</>
        )}
      </div>
      <Section>Harakat</Section>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Turi" span>
          <Select value={type} onChange={(x) => setType(x as MovementType)} options={MOVE_OPTS} />
        </Field>
        <DualQtyInput mode={mode} value={qty} stemsPerBunch={batch.stems_per_bunch} onMode={setMode} onValue={setQty} label="Miqdor" autoFocus />
        <Field label="Sabab" span>
          <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: so'lib qolgan gullar" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {REASON_CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => setReason(c)} className="rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors duration-150 hover:bg-[var(--hover)]" style={{ borderColor: reason === c ? "var(--primary)" : "var(--border)", color: reason === c ? "var(--primary)" : "var(--text-2)" }}>
              {c}
            </button>
          ))}
        </div>
        {/* HARAKAT SANASI — ixtiyoriy; default hozir */}
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[13px] border px-3.5 py-2.5" style={{ borderColor: dateOn ? "var(--primary)" : "var(--border)", background: dateOn ? "var(--primary-soft)" : undefined }}>
          <span className="flex min-w-0 items-center gap-2">
            <CalendarClock size={15} strokeWidth={2} style={{ color: dateOn ? "var(--primary)" : "var(--muted)" }} />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-bold">Boshqa harakat sanasi</span>
              <span className="block text-[11px]" style={{ color: "var(--muted)" }}>Belgilanmasa — hozirgi vaqt</span>
            </span>
          </span>
          <input type="checkbox" checked={dateOn} onChange={(e) => { setDateOn(e.target.checked); if (!e.target.checked) setMovedAt(""); }} className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
        </label>
        {dateOn && <DatePicker value={movedAt} onChange={setMovedAt} withTime placeholder="Harakat sanasi va vaqti" ariaLabel="Harakat sanasi" />}
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy || below} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Qayd etish"}</button>
      </ModalFooter>
    </Modal>
  );
}

/** Bitta partiya harakatlari ro'yxati. */
export function BatchMovesModal({ batch, onClose }: { batch: StockBatch; onClose: () => void }) {
  const [moves, setMoves] = useState<StockMovement[] | null>(null);
  useEffect(() => {
    api.stockMovements({ batch: batch.id, ordering: "-created_at" }).then(setMoves).catch(() => setMoves([]));
  }, [batch.id]);
  const v = batch.variant_detail;
  return (
    <Modal onClose={onClose} width={460}>
      <ModalHeader icon={<Icon name="audit" size={20} />} title="Partiya harakatlari" sub={`${v?.flower_detail?.name_uz ?? ""} ${v?.name_uz ?? ""} · №${batch.batch_number}`} onClose={onClose} />
      <div className="mt-2 flex flex-col gap-1.5">
        {moves == null && <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
        {moves?.length === 0 && <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Harakat yo&apos;q.</p>}
        {moves?.map((m) => {
          const hue = MOVEMENT_HUE[m.movement_type as MovementType] ?? "var(--muted)";
          return (
            <div key={m.id} className="flex items-center gap-2.5 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--line2)" }}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hue }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">{MOVEMENT_LABEL[m.movement_type as MovementType] ?? m.movement_type}</span>
                {m.reason && <span className="block truncate text-[12px]" style={{ color: "var(--muted)" }}>{m.reason}</span>}
              </span>
              <span className="shrink-0 text-right text-[12.5px] font-bold tabular-nums" style={{ color: hue }} title={formatStemsAndBunches(Math.abs(m.quantity_stems), batch.stems_per_bunch)}>{formatStemsAndBunches(Math.abs(m.quantity_stems), batch.stems_per_bunch)}</span>
              <span className="shrink-0 text-[12px]" style={{ color: "var(--muted)" }}>{fmtDate(m.created_at)}</span>
            </div>
          );
        })}
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Yopish</button>
      </ModalFooter>
    </Modal>
  );
}
