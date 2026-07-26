"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import DualQtyInput, { qtyPayload, type QtyMode } from "./DualQtyInput";
import { Icon } from "./icons";
import { fmtDate } from "@/lib/format";
import { MOVEMENT_LABEL, MOVEMENT_HUE, stems } from "@/lib/inventory";
import type { MovementType, StockBatch, StockMovement } from "@/lib/types";

const MOVE_OPTS: { value: MovementType; label: string }[] = [
  { value: "waste", label: MOVEMENT_LABEL.waste },
  { value: "out", label: MOVEMENT_LABEL.out },
  { value: "adjustment", label: MOVEMENT_LABEL.adjustment },
  { value: "in", label: MOVEMENT_LABEL.in },
];
const REASON_CHIPS = ["Chiqit", "So'lgan", "Sinov", "Tuzatish"];

/** Qo'lda harakat / chiqit (POST /stock-batches/{id}/movement/). Dona/Bog'lam toggle + sabab chiplari. */
export function BatchMovementModal({ batch, onClose, onDone }: { batch: StockBatch; onClose: () => void; onDone: (updated: StockBatch) => void }) {
  const { showToast } = useStore();
  const [type, setType] = useState<MovementType>("waste");
  const [mode, setMode] = useState<QtyMode>("stems");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = parseFloat(qty) || 0;
    if (n <= 0) return showToast("Miqdorni kiriting");
    setBusy(true);
    try {
      await api.batchMovement(batch.id, { movement_type: type, ...qtyPayload(mode, qty), reason: reason.trim() });
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
      <div className="mt-2 rounded-[12px] bg-sfc px-3 py-2 text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
        Joriy qoldiq: {stems(batch.remaining_stems)}
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
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Qayd etish"}</button>
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
              <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color: hue }}>{stems(m.quantity_stems)}</span>
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
