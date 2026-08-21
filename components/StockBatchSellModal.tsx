"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ShoppingCart } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { applyMixedEdit, emptyMixed, focusMixedField, formatMoneyInput, mixedSellPayload, parseMoney, recalcOnTotalChange, validateMixed, type MixedState } from "@/lib/mixedPayment";
import { withTashkentOffset } from "@/lib/backdate";
import { fmt } from "@/lib/format";
import { batchTitleNoHeight } from "@/lib/stockLabel";
import type { StockBatch } from "@/lib/types";
import Modal, { Field, ModalFooter, ModalHeader } from "./Modal";
import DatePicker from "./DatePicker";

type Payment = "cash" | "card" | "debt" | "mixed";

export default function StockBatchSellModal({ batch, onClose, onDone }: { batch: StockBatch; onClose: () => void; onDone: (batch: StockBatch) => void }) {
  const showToast = useStore((s) => s.showToast);
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<Payment>("cash");
  const [mixed, setMixed] = useState<MixedState>(emptyMixed);
  const [reason, setReason] = useState("");
  const [dateOn, setDateOn] = useState(false);
  const [soldAt, setSoldAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const qty = Math.floor(+quantity || 0);
  const total = parseMoney(amount);
  const overStock = qty > batch.remaining_stems;
  const mixedValue = useMemo(() => validateMixed(mixed, total), [mixed, total]);
  const unitPrice = qty > 0 && total > 0 ? total / qty : 0;

  useEffect(() => { setMixed((prev) => recalcOnTotalChange(prev, total)); }, [total]);
  useEffect(() => { if (payment !== "mixed") setMixed(emptyMixed); }, [payment]);

  const submit = async () => {
    setError("");
    if (qty < 1) return setError("Dona sonini kiriting");
    if (overStock) return setError(`Qoldiq yetarli emas: ${batch.remaining_stems} dona mavjud`);
    if (total <= 0) return setError("Sotuv summasini kiriting");
    if (payment === "mixed" && !mixedValue.ok) return setError(mixedValue.message || "Naqd va karta yig'indisi sotuv summasiga teng bo'lsin");
    setBusy(true);
    try {
      const split = mixedSellPayload(payment === "mixed", mixed, total);
      if (payment === "mixed" && !split) return setError(mixedValue.message || "Aralash to'lovni tekshiring");
      await api.sellStockBatch(batch.id, { quantity_stems: qty, sale_amount: String(total), payment_type: payment, ...(split ?? {}), ...(reason.trim() ? { reason: reason.trim() } : {}), ...(dateOn && soldAt ? { sold_at: withTashkentOffset(soldAt) } : {}) });
      const fresh = await api.stockBatch(batch.id).catch(() => null);
      showToast(`✓ ${qty} dona gul sotildi · ${fmt(total)}`);
      onDone(fresh ?? batch);
      onClose();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Sotib bo'lmadi";
      setError(message);
      showToast(message);
    } finally { setBusy(false); }
  };

  return <Modal onClose={onClose} width={460}>
    <ModalHeader icon={<ShoppingCart size={20} />} title="Partiyadan dona sotish" sub={`${batchTitleNoHeight(batch)} · №${batch.batch_number}`} onClose={onClose} />
    <div className="mb-4 rounded-[13px] border px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>Mavjud qoldiq: <b style={{ color: "var(--primary)" }}>{batch.remaining_stems.toLocaleString("ru")} dona</b>{qty > 0 && <span style={{ color: overStock ? "var(--danger-ink)" : "var(--muted)" }}> · sotuvdan keyin {Math.max(batch.remaining_stems - qty, 0).toLocaleString("ru")} dona qoladi</span>}</div>
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3"><Field label="Dona soni"><input className="inp" type="number" min="1" max={batch.remaining_stems} value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} autoFocus /></Field><Field label="Sotuv summasi (so'm)"><input className="inp" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="Masalan: 250000" /></Field></div>
      {unitPrice > 0 && <p className="-mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>Hisoblangan dona narxi: <b style={{ color: "var(--text-2)" }}>{fmt(unitPrice)}</b></p>}
      <Field label="To'lov turi" span><div className="flex flex-wrap gap-1.5">{([['cash', 'Naqd'], ['card', 'Karta'], ['debt', 'Qarz'], ['mixed', 'Aralash']] as [Payment, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setPayment(value)} aria-pressed={payment === value} className="rounded-full border-[1.5px] px-3.5 py-1.5 text-[12.5px] font-bold" style={payment === value ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-2)" }}>{label}</button>)}</div></Field>
      {payment === "mixed" && <div className="grid grid-cols-2 gap-3"><Field label="Naqd summa"><input className="inp" inputMode="numeric" value={mixed.cash} onFocus={() => setMixed((p) => focusMixedField(p, "cash"))} onChange={(e) => setMixed((p) => applyMixedEdit(p, "cash", e.target.value, total))} placeholder="0" /></Field><Field label="Karta summa"><input className="inp" inputMode="numeric" value={mixed.card} onChange={(e) => setMixed((p) => applyMixedEdit(p, "card", e.target.value, total))} placeholder="0" /></Field><div className="col-span-2 rounded-[12px] px-3 py-2 text-[12px] font-bold" style={{ background: "var(--surface-2)", color: mixedValue.ok ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)" }}>Kiritildi: {formatMoneyInput(parseMoney(mixed.cash) + parseMoney(mixed.card))} · {mixedValue.ok ? `✓ ${fmt(total)}` : mixedValue.message}</div></div>}
      <Field label="Izoh" span><input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ixtiyoriy" /></Field>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[13px] border px-3.5 py-2.5" style={{ borderColor: dateOn ? "var(--primary)" : "var(--border)", background: dateOn ? "var(--primary-soft)" : undefined }}><span className="flex items-center gap-2"><CalendarClock size={15} style={{ color: dateOn ? "var(--primary)" : "var(--muted)" }} /><span><span className="block text-[12.5px] font-bold">Sotuv sanasi va vaqti</span><span className="block text-[11px]" style={{ color: "var(--muted)" }}>Belgilanmasa — hozirgi vaqt</span></span></span><input type="checkbox" checked={dateOn} onChange={(e) => { setDateOn(e.target.checked); if (!e.target.checked) setSoldAt(""); }} className="h-4 w-4 accent-[var(--primary)]" /></label>
      {dateOn && <DatePicker value={soldAt} onChange={setSoldAt} withTime placeholder="Sotuv sanasi va vaqti" ariaLabel="Sotuv sanasi" />}
      {error && <p className="rounded-[12px] bg-peach px-3 py-2 text-[12px] font-semibold text-peachink">{error}</p>}
    </div>
    <ModalFooter><button onClick={onClose} className="btn-ghost">Bekor</button><button onClick={submit} disabled={busy || qty < 1 || overStock || total <= 0 || (payment === "mixed" && !mixedValue.ok)} className={`btn-primary disabled:opacity-60 ${busy ? "btn-loading" : ""}`}>{busy ? "Sotilmoqda…" : "Sotish"}</button></ModalFooter>
  </Modal>;
}
