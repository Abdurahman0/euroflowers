"use client";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalHeader, ModalFooter, Field } from "./Modal";
import DatePicker from "./DatePicker";
import { todayTashkent } from "@/lib/backdate";
import { fmt } from "@/lib/format";
import type { Supplier, SupplierPaymentMethod } from "@/lib/types";

/**
 * TO'LOV QO'SHISH — POST /api/supplier-payments/.
 *
 * ⚠️ QARZ QO'SHISH BILAN JUFT, LEKIN QARAMA-QARSHI: to'lov postavshikka bo'lgan
 * qarzni KAMAYTIRADI (`balance_total` tushadi), qo'lda qarz esa oshiradi. Ikkalasi
 * bitta oynada yonma-yon turgani uchun yo'nalish har ikkisida ochiq yozilgan.
 *
 * ⚠️ Bu yo'l JONLI SINALMAGAN (loyiha qoidasi: faqat GET). Payload jonli OpenAPI
 * bo'yicha: {supplier, amount, paid_at?, method?, note?}.
 */
const METHODS: { value: SupplierPaymentMethod; label: string }[] = [
  { value: "cash", label: "Naqd" },
  { value: "card", label: "Karta" },
  { value: "transfer", label: "O'tkazma" },
];

export default function SupplierPaymentModal({
  supplier, debtTotal, onClose, onSaved,
}: { supplier: Supplier; debtTotal?: number; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useStore();
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(todayTashkent());
  const [method, setMethod] = useState<SupplierPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string[]>([]);

  const n = Math.round(+amount || 0);
  const ok = n > 0;
  const debt = Math.round(debtTotal ?? 0);
  const left = debt > 0 ? Math.max(debt - n, 0) : 0;

  const save = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr([]);
    try {
      await api.createSupplierPayment({
        supplier: supplier.id,
        amount: String(n),
        ...(at ? { paid_at: at } : {}),
        method,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      showToast(`✓ To'lov qo'shildi: ${fmt(n)}`);
      onSaved();
    } catch (e) {
      const ae = e as ApiError;
      setErr(String(ae?.message ?? "Saqlab bo'lmadi").split("\n"));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={440}>
      <ModalHeader
        icon={<Wallet size={19} strokeWidth={1.8} />}
        title="To'lov qo'shish"
        sub={supplier.name}
        onClose={onClose}
      />

      {/* ⚠️ YO'NALISH — qarz qo'shish bilan adashtirmaslik uchun eng tepada */}
      <p className="mt-2 rounded-[11px] px-3 py-2 text-[12px] font-semibold leading-snug"
        style={{ background: "color-mix(in srgb, var(--success, #3d8a5f) 14%, transparent)", color: "var(--success-ink, #3d8a5f)" }}>
        Bu summa postavshikka bo&apos;lgan qarzni <b>KAMAYTIRADI</b>. Eski qarzni yozmoqchi
        bo&apos;lsangiz «Qarz qo&apos;shish» dan foydalaning.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Summa (so'm)" span>
          <input className="inp" inputMode="numeric" autoFocus value={amount}
            onChange={(e) => { setAmount(e.target.value.replace(/\D/g, "")); setErr([]); }}
            placeholder="Masalan: 500000" />
        </Field>
        <Field label="Qaysi kunga">
          <DatePicker value={at} onChange={setAt} maxDate={todayTashkent()} ariaLabel="To'lov sanasi" />
        </Field>
        <Field label="To'lov turi">
          <div className="flex gap-1 rounded-md border p-1" style={{ borderColor: "var(--border)" }}>
            {METHODS.map((m) => (
              <button key={m.value} type="button" onClick={() => setMethod(m.value)} aria-pressed={method === m.value}
                className="flex-1 rounded-sm py-1.5 text-[12.5px] font-bold transition-colors duration-150"
                style={method === m.value ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>
                {m.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Izoh (ixtiyoriy)" span>
          <input className="inp" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Masalan: 20-avgust uchun naqd" />
        </Field>
      </div>

      {n > 0 && (
        <p className="mt-2 rounded-[11px] px-3 py-2 text-center text-[13px] font-bold"
          style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
          {debt > 0
            ? <>Qarz {fmt(debt)} → <b style={{ color: left > 0 ? "var(--danger-ink)" : "var(--success-ink, #3d8a5f)" }}>{fmt(left)}</b>{n > debt ? ` · ${fmt(n - debt)} ortiqcha to'lov` : ""}</>
            : <>Qarz yo&apos;q — bu summa <b>ortiqcha to&apos;lov</b> bo&apos;lib qoladi</>}
        </p>
      )}

      {err.length > 0 && (
        <p className="mt-2 rounded-md px-3 py-2 text-[12px] font-semibold"
          style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          {err.map((l, i) => <span key={i} className="block">{l}</span>)}
        </p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={!ok || busy} className={`btn-primary disabled:opacity-60 ${busy ? "btn-loading" : ""}`}>
          To&apos;lov qo&apos;shish
        </button>
      </ModalFooter>
    </Modal>
  );
}
